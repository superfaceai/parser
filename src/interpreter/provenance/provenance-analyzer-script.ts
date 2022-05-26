import createDebug from 'debug';
import * as ts from 'typescript';

import { ScriptExpressionCompiler } from '../../common/script';
import { ProvenanceItem } from './items';

const debug = createDebug('superface-parser:provenance-analyzer-script');

export class ScriptProvenanceAnalyzer {
  private constructor(
    /** Current variables present in this context */
    private variables: Record<string, ProvenanceItem>
  ) {}

  static analyzeExpression(
    variables: Record<string, ProvenanceItem>,
    expression: string
  ): ProvenanceItem {
    debug(`Analyzing expression "${expression}" with variables`, variables);

    const tree = new ScriptExpressionCompiler(expression).rawExpressionNode;
    const analyzer = new ScriptProvenanceAnalyzer(variables);

    const result = analyzer.visit(tree);

    return result;
  }

  private visit(node: ts.Node): ProvenanceItem {
    if (ts.isIdentifier(node)) {
      return this.visitIdentifier(node);
    }

    if (ts.isNumericLiteral(node)) {
      // TODO: is there no way to get the literal from the typescript ast?
      return ProvenanceItem.literal(node.text);
    } else if (ts.isStringLiteral(node)) {
      return ProvenanceItem.literal(node.text);
    } else if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return ProvenanceItem.literal(true);
    } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return ProvenanceItem.literal(false);
    }

    throw new Error('TODO');
  }

  private visitIdentifier(node: ts.Identifier): ProvenanceItem {
    // if a variable with this name exists, return it
    const variable = this.variables[node.text];
    if (variable !== undefined) {
      return variable;
    }

    // resolve known sources, as long as they weren't overriden by variable names
    if (node.text === 'input') {
      return {
        kind: 'source',
        sourceKind: 'input',
      };
    }

    if (node.text === 'parameters') {
      return {
        kind: 'source',
        sourceKind: 'parameters',
      };
    }

    // TODO: http response should probably come from variables

    return {
      kind: 'placeholder',
      placeholderKind: 'missing',
    };
  }
}
