import * as ts from 'typescript';

import { ProtoError, SyntaxErrorCategory } from '../../error';
import { ALLOWED_SYNTAX, FORBIDDEN_CONSTRUCTS } from './constructs';

function constructDebugVisualTree(root: ts.Node): string {
  let debugTree = '';
  let debugDepth = 0;

  function nodeVisitor<T extends ts.Node>(node: T): void {
    const nodeCode = node.getText().replace('\r\n', ' ').trim();
    const treeIndent = ''.padStart(debugDepth, '\t');
    debugTree += `${treeIndent}NODE ${ts.SyntaxKind[node.kind]} "${nodeCode}"`;

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
    }

    // If none of the rules applied, but the syntax is not valid anyway, add an error without a hint
    if (!anyRuleBroken && !ALLOWED_SYNTAX.includes(node.kind)) {
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

export type ForbiddenConstructProtoError = ProtoError & {
  detail: string;
  category: SyntaxErrorCategory.JESSIE_FORBIDDEN_CONSTRUCT;
};
export function validateScript(input: string): ForbiddenConstructProtoError[] {
  const errors: ForbiddenConstructProtoError[] = [];

  const rootNode = ts.createSourceFile(
    'scripts.js',
    input,
    ts.ScriptTarget.ES2015,
    true,
    ts.ScriptKind.JS
  );

  function nodeVisitor<T extends ts.Node>(node: T): void {
    // Go over forbidden constructs and check if any of them applies
    let anyRuleBroken = false;
    const rules = FORBIDDEN_CONSTRUCTS[node.kind] ?? [];
    for (const rule of rules) {
      if (rule.predicate?.(node) ?? true) {
        anyRuleBroken = true;

        errors.push({
          detail: `${ts.SyntaxKind[node.kind]} construct is not supported`,
          hint: rule.hint(input, node),
          relativeSpan: { start: node.pos, end: node.end },
          category: SyntaxErrorCategory.JESSIE_FORBIDDEN_CONSTRUCT,
        });
      }
    }

    // If none of the rules applied, but the syntax is not valid anyway, add an error without a hint
    if (!anyRuleBroken && !ALLOWED_SYNTAX.includes(node.kind)) {
      errors.push({
        detail: `${ts.SyntaxKind[node.kind]} construct is not supported`,
        relativeSpan: { start: node.pos, end: node.end },
        category: SyntaxErrorCategory.JESSIE_FORBIDDEN_CONSTRUCT,
      });
    }

    // Recurse into children
    ts.forEachChild(node, nodeVisitor);
  }
  nodeVisitor(rootNode);

  if (process.env.LOG_LEVEL === 'debug') {
    if (errors.length > 0) {
      console.debug(constructDebugVisualTree(rootNode));
    }
  }

  return errors;
}
