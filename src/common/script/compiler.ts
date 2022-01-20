import * as ts from 'typescript';

import { CharIndexSpan } from '../source';
import { validateScript, ValidatorDiagnostic } from './validator/validator';

export type ScriptDiagnostic = {
  detail: string;
  hints: string[];
  relativeSpan: CharIndexSpan;
};

// Most of the functionality of this class comes from typescript src/services/transpile.ts
// and related typescript modules which are sadly internal
export class ScriptCompiler {
  private static SOURCE_NAME = 'module.ts';
  private static TRANSPILE_TARGET = ts.ScriptTarget.ES3;

  protected readonly sourceFile: ts.SourceFile;
  protected readonly tsProgram: ts.Program;

  constructor(protected readonly sourceText: string) {
    const compilerOptions = ScriptCompiler.buildTranspileOptions();

    this.sourceFile = ts.createSourceFile(
      ScriptCompiler.SOURCE_NAME,
      this.sourceText,
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.JS
    );

    const host = ScriptCompiler.buildCompilerHost(
      ScriptCompiler.SOURCE_NAME,
      this.sourceFile,
      ScriptCompiler.getNewLineCharacter(compilerOptions)
    );

    this.tsProgram = ts.createProgram(
      [ScriptCompiler.SOURCE_NAME],
      compilerOptions,
      host
    );
  }

  private static buildTranspileOptions(): ts.CompilerOptions {
    const options: ts.CompilerOptions = {
      ...ts.getDefaultCompilerOptions(),
      ...{
        allowJs: true,
        target: ScriptCompiler.TRANSPILE_TARGET,
        sourceMap: true,
      },
      // these are forced for transpilation mode by typescript
      // incremental: undefined,
      // lib: undefined,
      // declaration: undefined,
      // declarationMap: undefined,
      // emitDeclarationOnly: undefined,
      // outFile: undefined,
      // composite: undefined,
      // tsBuildInfoFile: undefined,
      // noEmit: undefined,
      isolatedModules: true,
      // paths: undefined,
      // rootDirs: undefined,
      // types: undefined,
      // out: undefined,
      noLib: true,
      noResolve: true,
      // noEmitOnError: undefined,
      // declarationDir: undefined
    };

    return options;
  }

  private static getNewLineCharacter(options: ts.CompilerOptions): string {
    const carriageReturnLineFeed = '\r\n';
    const lineFeed = '\n';

    switch (options.newLine) {
      case ts.NewLineKind.CarriageReturnLineFeed:
        return carriageReturnLineFeed;
      case ts.NewLineKind.LineFeed:
        return lineFeed;
    }

    return ts.sys ? ts.sys.newLine : carriageReturnLineFeed;
  }

  private static buildCompilerHost(
    fileName: string,
    sourceFile: ts.SourceFile,
    newLine: string
  ): ts.CompilerHost {
    const host: ts.CompilerHost = {
      getSourceFile: name => {
        if (name === ScriptCompiler.SOURCE_NAME) {
          return sourceFile;
        } else {
          return undefined;
        }
      },
      writeFile: (_name, _text) => undefined,
      getDefaultLibFileName: () => 'lib.d.ts',
      useCaseSensitiveFileNames: () => false,
      getCanonicalFileName: name => name,
      getCurrentDirectory: () => '',
      getNewLine: () => newLine,
      fileExists: (name): boolean => name === fileName,
      readFile: () => '',
      directoryExists: () => true,
      getDirectories: () => [],
    };

    return host;
  }

  diagnose(): ScriptDiagnostic[] {
    return [
      ...this.tsProgram.getSyntacticDiagnostics(this.sourceFile),
      ...this.tsProgram.getOptionsDiagnostics(),
    ].map(diag => {
      let detail = diag.messageText;
      if (typeof detail === 'object') {
        detail = detail.messageText;
      }

      return {
        detail,
        relativeSpan: {
          start: diag.start ?? 0,
          end: (diag.start ?? 0) + Math.max(1, diag.length ?? 0),
        },
        hints: [],
      };
    });
  }

  validate(): ValidatorDiagnostic[] {
    return validateScript(this.sourceFile, this.sourceText);
  }

  transpile(): { output: string; sourceMap: string } {
    let outputRaw: string | undefined;
    let sourceMapRaw: string | undefined;

    this.tsProgram.emit(
      undefined,
      (name, text) => {
        if (name.endsWith('.map')) {
          sourceMapRaw = text;
        } else {
          outputRaw = text;
        }
      },
      undefined,
      undefined,
      // TODO: transformers?
      undefined
    );

    if (outputRaw === undefined || sourceMapRaw === undefined) {
      throw new Error('Unexpected compiler state');
    }

    const output = outputRaw
      .replace('//# sourceMappingURL=module.js.map', '')
      .trimRight();

    const sourceMapJson: unknown = JSON.parse(sourceMapRaw);
    ScriptCompiler.assertSourceMapFormat(sourceMapJson);

    return { output, sourceMap: sourceMapJson.mappings };
  }

  private static assertSourceMapFormat(
    input: unknown
  ): asserts input is { mappings: string } {
    // This is necessary because TypeScript cannot correctly narrow type of object properties yet
    const hasMappings = (inp: unknown): inp is { mappings: unknown } =>
      typeof inp === 'object' && inp !== null && 'mappings' in inp;

    if (!hasMappings(input) || typeof input.mappings !== 'string') {
      throw 'Source map JSON is not an object in the correct format';
    }
  }
}

export class ScriptExpressionCompiler extends ScriptCompiler {
  private static SCRIPT_WRAP = {
    start: 'let __jessieValue = ',
    end: ';',
    varName: '__jessieValue',
    transpiled: {
      start: 'var __jessieValue = ',
      end: ';',
      varName: '__jessieValue',
    },
  };

  /** @internal */
  static fixupRelativeSpan(relativeSpan: CharIndexSpan): CharIndexSpan {
    return {
      start:
        relativeSpan.start - ScriptExpressionCompiler.SCRIPT_WRAP.start.length,
      end: relativeSpan.end - ScriptExpressionCompiler.SCRIPT_WRAP.start.length,
    };
  }

  constructor(sourceExpression: string) {
    super(
      ScriptExpressionCompiler.SCRIPT_WRAP.start +
        sourceExpression +
        ScriptExpressionCompiler.SCRIPT_WRAP.end
    );
  }

  /** @internal */
  get rawExpressionNode(): ts.Expression {
    const statement = this.sourceFile.statements[0];
    if (statement.kind !== ts.SyntaxKind.VariableStatement) {
      throw new Error('Invalid script compiler state');
    }
    const declaration: ts.VariableDeclaration = (
      statement as ts.VariableStatement
    ).declarationList.declarations[0];

    if (
      declaration === undefined ||
      declaration.kind !== ts.SyntaxKind.VariableDeclaration ||
      declaration.name.getText() !==
        ScriptExpressionCompiler.SCRIPT_WRAP.varName ||
      declaration.initializer === undefined
    ) {
      throw new Error('Invalid script compiler state');
    }

    return declaration.initializer;
  }

  override diagnose(): ScriptDiagnostic[] {
    return super.diagnose().map(diag => {
      diag.relativeSpan = ScriptExpressionCompiler.fixupRelativeSpan(
        diag.relativeSpan
      );

      return diag;
    });
  }

  override validate(): ValidatorDiagnostic[] {
    return validateScript(this.rawExpressionNode, this.sourceText).map(diag => {
      diag.relativeSpan = ScriptExpressionCompiler.fixupRelativeSpan(
        diag.relativeSpan
      );

      return diag;
    });
  }

  override transpile(): { output: string; sourceMap: string } {
    const { output: outputWrapped, sourceMap: sourceMapWrapped } =
      super.transpile();

    // With some syntax the transpiler creates a polyfill for the function
    // For example for the spread operator `...`
    // Here we detect that case and wrap the output in an immediatelly invoked function expression
    let output;
    if (
      !outputWrapped.startsWith(
        ScriptExpressionCompiler.SCRIPT_WRAP.transpiled.start
      )
    ) {
      output = `(function() {\n${outputWrapped}\nreturn ${ScriptExpressionCompiler.SCRIPT_WRAP.transpiled.varName};\n})()`;
    } else {
      // strip the prefix and postfix added by the processing here (to force expression position)
      output = outputWrapped.slice(
        ScriptExpressionCompiler.SCRIPT_WRAP.transpiled.start.length,
        outputWrapped.length -
          ScriptExpressionCompiler.SCRIPT_WRAP.transpiled.end.length
      );
    }

    // TODO: Should patch the source map as well
    return { output, sourceMap: sourceMapWrapped };
  }
}
