/* eslint-disable no-fallthrough */
import * as ts from 'typescript';

import { ALLOWED_SYNTAX, FORBIDDEN_CONSTRUCTS } from './constructs';

export enum ValidationErrorType {
  ForbiddenConstruct,
}

export interface ValidationError {
  message: string;
  hint?: string;
  type: ValidationErrorType;
  position: {
    start: number;
    end: number;
  };
}

export class ScriptValidationReport {
  errors: ValidationError[] = [];

  public get isValid(): boolean {
    return this.errors.length === 0;
  }

  public addError(
    error: string,
    errorType: ValidationErrorType,
    node: ts.Node,
    hint?: string
  ): void {
    this.errors.push({
      message: error,
      type: errorType,
      hint: hint,
      position: {
        start: node.pos,
        end: node.end,
      },
    });
  }
}

export function validateScript(input: string): ScriptValidationReport {
  const report = new ScriptValidationReport();

  const rootNode = ts.createSourceFile(
    'scripts.js',
    input,
    ts.ScriptTarget.ES2015,
    true,
    ts.ScriptKind.JS
  );

  let debugTree = '';
  let debugDepth = 0;
  function nodeVisitor<T extends ts.Node>(node: T): void {
    const nodeCode = input
      .substring(node.pos, node.end)
      .replace('\r\n', ' ')
      .trim();
    const treeIndent = ''.padStart(debugDepth, '\t');
    debugTree += `${treeIndent}NODE ${ts.SyntaxKind[node.kind]} "${nodeCode}"`;

    // Go over forbidden constructs and check if any of them applies
    let anyRuleBroken = false;
    const rules = FORBIDDEN_CONSTRUCTS[node.kind] ?? [];
    for (const rule of rules) {
      if (rule.predicate?.(node) ?? true) {
        anyRuleBroken = true;

        report.addError(
          `${ts.SyntaxKind[node.kind]} construct is not supported`,
          ValidationErrorType.ForbiddenConstruct,
          node,
          rule.hint(input, node)
        );
      }
    }
    if (anyRuleBroken) {
      debugTree += ' [R]';
    }

    // If none of the rules applied, but the syntax is not valid anyway, add an error without a hint
    if (!anyRuleBroken && !ALLOWED_SYNTAX.includes(node.kind)) {
      debugTree += ' [S]';

      report.addError(
        `${ts.SyntaxKind[node.kind]} construct is not supported`,
        ValidationErrorType.ForbiddenConstruct,
        node
      );
    }

    debugTree += '\n';

    // Recurse into children
    debugDepth += 1;
    ts.forEachChild(node, nodeVisitor);
    debugDepth -= 1;
  }
  nodeVisitor(rootNode);
  if (process.env.LOG_LEVEL === 'debug') {
    console.debug(debugTree);
  }

  return report;
}
