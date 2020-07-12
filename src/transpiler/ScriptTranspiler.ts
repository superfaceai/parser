import * as ts from 'typescript';

const SCRIPT_OUTPUT_TARGET = ts.ScriptTarget.ES3;

const AFTER_TRANSFORMERS: ts.TransformerFactory<ts.SourceFile>[] = [
  function dummyTransformerFactory(context: ts.TransformationContext) {
    return (root: ts.SourceFile): ts.SourceFile => {
      let stringTree = '';

      function dummyVisitor(depth: number, node: ts.Node): ts.Node {
        // Recursively log kind of each node
        let depthIndent = '';
        for (let index = 0; index < depth; index++) {
          depthIndent += '\t';
        }
        stringTree += `${depthIndent}${ts.SyntaxKind[node.kind]}\n`;

        ts.visitEachChild(node, dummyVisitor.bind(null, depth + 1), context);

        // Return the unmodified node.
        return node;
      }

      // The transformer will visit the root node and the visitor will drive the recursion.
      const result = ts.visitNode(root, dummyVisitor.bind(null, 0));
      if (process.env.LOG_LEVEL === 'debug') {
        console.debug(stringTree);
      }

      return result;
    };
  },
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
