import {
  AssignmentNode,
  CallStatementNode,
  HttpCallStatementNode,
  HttpRequestNode,
  HttpResponseHandlerNode,
  InlineCallNode,
  JessieExpressionNode,
  MapASTNode,
  MapDefinitionNode,
  MapDocumentNode,
  MapHeaderNode,
  ObjectLiteralNode,
  OperationDefinitionNode,
  OutcomeStatementNode,
  PrimitiveLiteralNode,
  SetStatementNode,
  StatementConditionNode,
} from '@superfaceai/ast';
import { MapVisitor } from '@superfaceai/sdk';

import { UnparserBase } from './common';

export class MapUnparser extends UnparserBase implements MapVisitor {
  private currentDefinitionContext: 'map' | 'operation';

  constructor(
    private readonly mapAst: MapASTNode,
    options?: { indent: string }
  ) {
    super(options);
    this.currentDefinitionContext = 'map';
  }

  unparse(): string {
    return this.visit(this.mapAst);
  }

  visit(node: MapASTNode): string {
    switch (node.kind) {
      case 'MapDocument':
        return this.visitMapDocumentNode(node);
      case 'MapHeader':
        return this.visitMapHeaderNode(node);
      case 'MapDefinition':
        return this.visitMapDefinitionNode(node);
      case 'OperationDefinition':
        return this.visitOperationDefinitionNode(node);

      case 'SetStatement':
        return this.visitSetStatementNode(node);
      case 'CallStatement':
        return this.visitCallStatementNode(node);
      case 'HttpCallStatement':
        return this.visitHttpCallStatementNode(node);
      case 'OutcomeStatement':
        return this.visitOutcomeStatementNode(node);

      case 'Assignment':
        return this.visitAssignmentNode(node);
      case 'StatementCondition':
        return this.visitStatementConditionNode(node);
      case 'HttpResponseHandler':
        return this.visitHttpResponseHandlerNode(node);
      case 'InlineCall':
        return this.visitInlineCallNode(node);

      case 'PrimitiveLiteral':
        return this.visitPrimitiveLiteralNode(node);
      case 'ObjectLiteral':
        return this.visitObjectLiteralNode(node);
      case 'JessieExpression':
        return this.visitJessieExpressionNode(node);

      default:
        throw 'unreachable';
    }
  }

  private visitCallHead(call: {
    operationName: string;
    arguments: AssignmentNode[];
  }): string {
    const args = call.arguments
      .map(a => this.stripLast(this.visit(a)).trimLeft())
      .join(', ');

    return `call ${call.operationName}(${args})`;
  }

  visitMapDocumentNode(document: MapDocumentNode): string {
    return (
      this.visitMapHeaderNode(document.header) +
      document.definitions.map(def => '\n' + this.visit(def)).join('')
    );
  }

  visitMapHeaderNode(header: MapHeaderNode): string {
    let profile = `${header.profile.name}@${header.profile.version.major}.${header.profile.version.minor}`;
    if (header.profile.scope !== undefined) {
      profile = `${header.profile.scope}/${profile}`;
    }

    return this.indentJoinLines(
      `profile = "${profile}"`,
      `provider = "${header.provider}"`,
      header.variant ? `variant = "${header.variant}"` : undefined
    );
  }

  visitMapDefinitionNode(map: MapDefinitionNode): string {
    this.currentDefinitionContext = 'map';

    const start = this.indentJoinLines(`map ${map.name} {`);
    const end = this.indentJoinLines('}');

    this.currentDepth += 1;
    const statements = map.statements.map(stmt => this.visit(stmt));
    this.currentDepth -= 1;

    return [start, ...statements, end].join('');
  }

  visitOperationDefinitionNode(operation: OperationDefinitionNode): string {
    this.currentDefinitionContext = 'operation';

    const start = this.indentJoinLines(`operation ${operation.name} {`);
    const end = this.indentJoinLines('}');

    this.currentDepth += 1;
    const statements = operation.statements.map(stmt => this.visit(stmt));
    this.currentDepth -= 1;

    return [start, ...statements, end].join('');
  }

  visitSetStatementNode(set: SetStatementNode): string {
    if (set.assignments.length > 1) {
      const start = this.indentJoinLines('set {');
      this.currentDepth += 1;
      const asses = set.assignments.map(ass => this.visit(ass)).join('');
      this.currentDepth -= 1;
      const end = this.indentJoinLines('}');

      return start + asses + end;
    } else {
      return this.visit(set.assignments[0]);
    }
  }

  visitCallStatementNode(call: CallStatementNode): string {
    const start = this.indentJoinLines(this.visitCallHead(call) + ' {');
    const end = this.indentJoinLines('}');

    this.currentDepth += 1;
    const statements = call.statements.map(stmt => this.visit(stmt)).join('\n');
    this.currentDepth -= 1;

    return start + statements + end;
  }

  visitHttpCallStatementNode(http: HttpCallStatementNode): string {
    const start = this.indentJoinLines(`http ${http.method} "${http.url}" {`);
    const end = this.indentJoinLines('}');

    this.currentDepth += 1;
    const request =
      http.request !== undefined
        ? this.visitHttpRequestNode(http.request) + '\n'
        : '';
    const handlers = http.responseHandlers.map(h => this.visit(h)).join('\n');
    this.currentDepth -= 1;

    return start + request + handlers + end;
  }

  visitOutcomeStatementNode(outcome: OutcomeStatementNode): string {
    let keyword;
    if (this.currentDefinitionContext === 'map') {
      if (outcome.isError) {
        keyword = 'map error ';
      } else {
        keyword = 'map result ';
      }

      if (outcome.terminateFlow) {
        keyword = 'return ' + keyword;
      }
    } else {
      if (outcome.isError) {
        keyword = 'fail ';
      } else {
        keyword = 'return ';
      }
    }

    const start = keyword;
    const condition =
      outcome.condition !== undefined ? this.visit(outcome.condition) : '';
    const value = this.stripLast(this.visit(outcome.value).trimLeft());

    return this.indentJoinLines(start + condition + value);
  }

  visitAssignmentNode(ass: AssignmentNode): string {
    return this.indentJoinLines(
      ass.key.join('.') +
        ' = ' +
        this.stripLast(this.visit(ass.value).trimLeft())
    );
  }

  visitStatementConditionNode(cond: StatementConditionNode): string {
    const expr = this.stripLast(this.visit(cond.expression)).trimLeft();

    return `if (${expr}) `;
  }

  visitHttpRequestNode(req: HttpRequestNode): string {
    let contentInfo = '';
    if (req.contentType) {
      contentInfo = `${contentInfo}"${req.contentType}" `;
    }
    if (req.contentLanguage) {
      contentInfo = `${contentInfo}"${req.contentLanguage}" `;
    }

    const start = this.indentJoinLines(`request ${contentInfo}{`);
    const end = this.indentJoinLines('}');

    this.currentDepth += 1;
    let query = '';
    if (req.query !== undefined) {
      query =
        this.stripLast(this.indentJoinLines('query ')) +
        this.visit(req.query).trimLeft();
    }

    let headers = '';
    if (req.headers !== undefined) {
      headers =
        this.stripLast(this.indentJoinLines('headers ')) +
        this.visit(req.headers).trimLeft();
    }

    let body = '';
    if (req.body !== undefined) {
      // TODO: assignment
      body =
        this.stripLast(this.indentJoinLines('body ')) +
        this.visit(req.body).trimLeft();
    }
    this.currentDepth -= 1;

    return start + query + headers + body + end;
  }

  visitHttpResponseHandlerNode(hand: HttpResponseHandlerNode): string {
    let filter = '';
    if (hand.statusCode !== undefined) {
      filter = `${filter}${hand.statusCode} `;
    }
    if (hand.contentType !== undefined) {
      filter = `${filter}"${hand.contentType}" `;
    }
    if (hand.contentLanguage !== undefined) {
      filter = `${filter}"${hand.contentLanguage}" `;
    }

    const start = this.indentJoinLines(`response ${filter}{`);
    const end = this.indentJoinLines('}');

    this.currentDepth += 1;
    const statements = hand.statements.map(s => this.visit(s)).join('\n');
    this.currentDepth -= 1;

    return start + statements + end;
  }

  visitInlineCallNode(call: InlineCallNode): string {
    return this.indentJoinLines(this.visitCallHead(call));
  }

  visitPrimitiveLiteralNode(ape: PrimitiveLiteralNode): string {
    let value = ape.value.toString();
    if (typeof ape.value === 'string') {
      value = '"' + value + '"';
    }

    return this.indentJoinLines(value);
  }

  visitObjectLiteralNode(object: ObjectLiteralNode): string {
    const start = this.indentJoinLines('{');
    const end = this.indentJoinLines('}');

    this.currentDepth += 1;
    const fields = object.fields.map(s => this.visit(s));
    this.currentDepth -= 1;

    return [start, ...fields, end].join('');
  }

  visitJessieExpressionNode(jessie: JessieExpressionNode): string {
    // TODO: formatting of inner indentation
    return this.indentJoinLines(jessie.source ?? jessie.expression);
  }
}
