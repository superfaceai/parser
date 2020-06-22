import * as ts from 'typescript';

const SCRIPT_OUTPUT_TARGET = ts.ScriptTarget.ES3;

export function transpileScript(
  input: string
): { output: string; sourceMap: string } {
  // This will transpile the code, generate a source map and run transformers
  let { outputText, sourceMapText } = ts.transpileModule(input, {
    compilerOptions: {
      allowJs: true,
      target: SCRIPT_OUTPUT_TARGET,
      sourceMap: true,
    },
    transformers: {
      after: AFTER_TRANSFORMERS,
    },
  });

  return {
    output: outputText,
    sourceMap: sourceMapText!!, // will be here because we requested it by setting the compiler flag
  };
}

const AFTER_TRANSFORMERS: ts.TransformerFactory<ts.SourceFile>[] = [
  function dummyTransformerFactory(context: ts.TransformationContext) {
    return (root: ts.SourceFile) => {
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
      let result = ts.visitNode(root, dummyVisitor.bind(null, 0));
      console.debug(stringTree);
      return result;
    };
  },
];
