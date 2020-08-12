import * as ts from 'typescript';

/**
 * Empty script transformer.
 * 
 * Scripts that contain no statements are transformed into scripts of one `undefined` literal statement.
*/
export default function emptyScriptTransformerFactory(_context: ts.TransformationContext) {
	return (root: ts.SourceFile): ts.SourceFile => {
		if (root.statements.length === 0) {
			root.statements = ts.createNodeArray(
				[
					ts.createExpressionStatement(
						ts.createIdentifier('undefined')
					)
				]
			)
		}

		return root;
	}
}