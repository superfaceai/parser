import * as ts from 'typescript';

import emptyScriptTransformerFactory from './transformer/emptyScript';

const SCRIPT_OUTPUT_TARGET = ts.ScriptTarget.ES3;

const AFTER_TRANSFORMERS: ts.TransformerFactory<ts.SourceFile>[] = [
  emptyScriptTransformerFactory
];

export function transpileScript(
  input: string
): { output: string; sourceMap: string } {
  // This will transpile the code, generate a source map and run transformers
  const { outputText, sourceMapText } = ts.transpileModule(input, {
    compilerOptions: {
      allowJs: true,
      target: SCRIPT_OUTPUT_TARGET,
      sourceMap: true,
    },
    transformers: {
      after: AFTER_TRANSFORMERS,
    },
  });

  // Strip the source mapping comment from the end of the output
  const outputTextStripped = outputText
    .replace('//# sourceMappingURL=module.js.map', '')
    .trimRight();

  // `sourceMapText` will be here because we requested it by setting the compiler flag
  if (!sourceMapText) {
    throw 'Source map text is not present';
  }
  const sourceMapJson: { mappings: string } = JSON.parse(sourceMapText);

  return {
    output: outputTextStripped,
    sourceMap: sourceMapJson.mappings,
  };
}
