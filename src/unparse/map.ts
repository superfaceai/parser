import {
  AssignmentNode,
  CallStatementNode,
  ConditionAtomNode,
  HttpCallStatementNode,
  HttpRequestNode,
  HttpResponseHandlerNode,
  InlineCallNode,
  IterationAtomNode,
  JessieExpressionNode,
  MapASTNode,
  MapAstVisitor,
  MapDefinitionNode,
  MapDocumentNode,
  MapHeaderNode,
  ObjectLiteralNode,
  OperationDefinitionNode,
  OutcomeStatementNode,
  PrimitiveLiteralNode,
  SetStatementNode,
} from '@superfaceai/ast';

import { UnparserBase } from './common';

export class MapUnparser extends UnparserBase implements MapAstVisitor {
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
      case 'ConditionAtom':
        return this.visitConditionAtomNode(node);
      case 'IterationAtom':
        return this.visitIterationAtomNode(node);
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
        throw 'unreachable: ' + node.kind;
    }
  }

  private visitCallHead(call: {
    operationName: string;
    condition?: ConditionAtomNode;
    iteration?: IterationAtomNode;
    arguments: AssignmentNode[];
  }): string {
    const cond =
      call.condition !== undefined
        ? ' ' + this.visitConditionAtomNode(call.condition)
        : '';
    const iter =
      call.iteration !== undefined
        ? this.visitIterationAtomNode(call.iteration) + ' '
        : '';

    const args = call.arguments
      .map(a => this.stripLast(this.visit(a)).trimStart())
      .join(', ');

    return `call ${iter}${call.operationName}(${args})${cond}`;
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

    return [start, statements.join('\n'), end].join('');
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
    if (set.assignments.length > 1 || set.condition !== undefined) {
      let start = this.indentJoinLines('set {');
      if (set.condition !== undefined) {
        const condition = this.visit(set.condition);
        start = this.indentJoinLines(`set ${condition} {`);
      }

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
      outcome.condition !== undefined
        ? this.visit(outcome.condition) + ' '
        : '';
    const value = this.stripLast(this.visit(outcome.value).trimStart());

    return this.indentJoinLines(start + condition + value);
  }

  visitAssignmentNode(ass: AssignmentNode): string {
    return this.indentJoinLines(
      ass.key.join('.') +
        ' = ' +
        this.stripLast(this.visit(ass.value).trimStart())
    );
  }

  visitConditionAtomNode(cond: ConditionAtomNode): string {
    const expr = this.stripLast(this.visit(cond.expression)).trimStart();

    return `if (${expr})`;
  }

  visitIterationAtomNode(iter: IterationAtomNode): string {
    const expr = this.stripLast(this.visit(iter.iterable)).trimStart();

    return `foreach (${iter.iterationVariable} of ${expr})`;
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
        this.visit(req.query).trimStart();
    }

    let headers = '';
    if (req.headers !== undefined) {
      headers =
        this.stripLast(this.indentJoinLines('headers ')) +
        this.visit(req.headers).trimStart();
    }

    let body = '';
    if (req.body !== undefined) {
      // TODO: assignment
      body =
        this.stripLast(this.indentJoinLines('body ')) +
        this.visit(req.body).trimStart();
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
