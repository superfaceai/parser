import * as ts from 'typescript';

import { ProtoError, SyntaxErrorCategory } from '../../error';

const SCRIPT_OUTPUT_TARGET = ts.ScriptTarget.ES3;

const AFTER_TRANSFORMERS: ts.TransformerFactory<ts.SourceFile>[] = [];

export type JessieSyntaxProtoError = ProtoError & {
  category: SyntaxErrorCategory.SCRIPT_SYNTAX;
};

export function transpileScript(
  input: string,
  reportDiagnostics: true
): {
  output: string;
  sourceMap: string;
  syntaxProtoError: JessieSyntaxProtoError;
};
export function transpileScript(
  input: string,
  reportDiagnostics?: false
): { output: string; sourceMap: string };

export function transpileScript(
  input: string,
  reportDiagnostics?: boolean
): {
  output: string;
  sourceMap: string;
  syntaxProtoError?: JessieSyntaxProtoError;
} {
  // This will transpile the code, generate a source map and run transformers
  const { outputText, diagnostics, sourceMapText } = ts.transpileModule(input, {
    compilerOptions: {
      allowJs: true,
      target: SCRIPT_OUTPUT_TARGET,
      sourceMap: true,
    },
    transformers: {
      after: AFTER_TRANSFORMERS,
    },
    reportDiagnostics,
  });

  // Strip the source mapping comment from the end of the output
  const outputTextStripped = outputText
    .replace('//# sourceMappingURL=module.js.map', '')
    .trimRight();

  // `sourceMapText` will be here because we requested it by setting the compiler flag
  if (!sourceMapText) {
    throw 'Source map text is not present';
  }

  const sourceMapJson: unknown = JSON.parse(sourceMapText);
  function assertSourceMapFormat(
    input: unknown
  ): asserts input is { mappings: string } {
    // This is necessary because TypeScript cannot correctly narrow type of object properties yet
    const hasMappings = (inp: unknown): inp is { mappings: unknown } =>
      typeof inp === 'object' && inp !== null && 'mappings' in inp;

    if (!hasMappings(input) || typeof input.mappings !== 'string') {
      throw 'Source map JSON is not an object in the correct format';
    }
  }
  assertSourceMapFormat(sourceMapJson);

  let syntaxProtoError: JessieSyntaxProtoError | undefined;
  if (diagnostics && diagnostics.length > 0) {
    const diag = diagnostics[0];
    let detail = diag.messageText;
    if (typeof detail === 'object') {
      detail = detail.messageText;
    }

    syntaxProtoError = {
      category: SyntaxErrorCategory.SCRIPT_SYNTAX,
      relativeSpan: {
        start: diag.start ?? 0,
        end: (diag.start ?? 0) + Math.max(1, diag.length ?? 0),
      },
      detail,
      hints: [],
    };
  }

  return {
    output: outputTextStripped,
    syntaxProtoError,
    sourceMap: sourceMapJson.mappings,
  };
}
