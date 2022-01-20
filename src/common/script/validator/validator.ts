import * as ts from 'typescript';

import { CharIndexSpan } from '../../source';
import { ALLOWED_SYNTAX, FORBIDDEN_CONSTRUCTS } from './constructs';

function constructDebugVisualTree(root: ts.Node): string {
  let debugTree = '';
  let debugDepth = 0;

  function nodeVisitor<T extends ts.Node>(node: T): void {
    const nodeCode = node.getFullText();
    const treeIndent = ''.padStart(debugDepth, '\t');
    debugTree += `${treeIndent}NODE kind: ${ts.SyntaxKind[node.kind]}, full: [${
      node.pos
    }, ${
      node.end
    }], text: [${node.getStart()}, ${node.getEnd()}] - "${nodeCode}"`;

    // Go over forbidden constructs and check if any of them applies
    let anyRuleBroken = false;
    const rules = FORBIDDEN_CONSTRUCTS[node.kind] ?? [];
    for (const rule of rules) {
      if (rule.predicate?.(node) ?? true) {
        anyRuleBroken = true;
      }
    }
    if (anyRuleBroken) {
      debugTree += ' [R]';
    } else if (!ALLOWED_SYNTAX.includes(node.kind)) {
      // If none of the rules applied, but the syntax is not valid anyway, add an error without a hint
      debugTree += ' [S]';
    }

    debugTree += '\n';

    // Recurse into children
    debugDepth += 1;
    ts.forEachChild(node, nodeVisitor);
    debugDepth -= 1;
  }
  nodeVisitor(root);

  return debugTree;
}

export type ValidatorDiagnostic = {
  detail: string;
  hints: string[];
  relativeSpan: CharIndexSpan;
};
export function validateScript(
  sourceNode: ts.Node,
  sourceText: string
): ValidatorDiagnostic[] {
  const diagnostics: ValidatorDiagnostic[] = [];

  function nodeVisitor<T extends ts.Node>(node: T): void {
    // Go over forbidden constructs and check if any of them applies
    let anyRuleBroken = false;
    const rules = FORBIDDEN_CONSTRUCTS[node.kind] ?? [];
    for (const rule of rules) {
      if (rule.predicate?.(node) ?? true) {
        anyRuleBroken = true;

        diagnostics.push({
          detail: `${ts.SyntaxKind[node.kind]} construct is not supported`,
          hints: [rule.hint(sourceText, node)],
          relativeSpan: { start: node.getStart(), end: node.getEnd() },
        });
      }
    }

    // If none of the rules applied, but the syntax is not valid anyway, add an error without a hint
    if (!anyRuleBroken && !ALLOWED_SYNTAX.includes(node.kind)) {
      diagnostics.push({
        detail: `${ts.SyntaxKind[node.kind]} construct is not supported`,
        relativeSpan: { start: node.getStart(), end: node.getEnd() },
        hints: [],
      });
    }

    // Recurse into children
    ts.forEachChild(node, nodeVisitor);
  }
  nodeVisitor(sourceNode);

  if (process.env.LOG_LEVEL === 'debug') {
    if (diagnostics.length > 0) {
      console.debug(constructDebugVisualTree(sourceNode));
    }
  }

  return diagnostics;
}
