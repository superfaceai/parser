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

import { ProfileId, VersionRange } from '../../common';
import {
  isValidIdentifierChar,
  isValidIdentifierStartChar,
} from '../../common/source';
import { BlockToken, UnparserToken, UnparserTokenGroup } from '../common/tree';
import { UnparserBase } from '../common/visitor';
import {
  MapUnparserConfiguration,
  transformMapUnparserConfiguration,
} from './configuration';
import { UnparserTokenMap as Tok } from './tree';

export class MapUnparser
  extends UnparserBase<MapASTNode>
  implements MapAstVisitor
{
  private currentContext: 'map' | 'operation';

  constructor(configuration: MapUnparserConfiguration) {
    super(transformMapUnparserConfiguration(configuration));
    this.currentContext = 'map';
  }

  visit(node: MapASTNode): UnparserTokenGroup {
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
        return [this.visitPrimitiveLiteralNode(node)];
      case 'ObjectLiteral':
        return [this.visitObjectLiteralNode(node)];
      case 'JessieExpression':
        return [this.visitJessieExpressionNode(node)];

      default:
        throw new Error('MapUnparser: unreachable node kind ' + node.kind);
    }
  }

  protected visitCallHead(call: {
    operationName: string;
    condition?: ConditionAtomNode;
    iteration?: IterationAtomNode;
    arguments: AssignmentNode[];
  }): UnparserTokenGroup {
    return Tok.withSpaces(
      'call',
      call.iteration ? this.visit(call.iteration) : undefined,
      [
        Tok.atom(call.operationName),
        Tok.callBlock(...call.arguments.map(a => this.visit(a))),
      ],
      call.condition ? this.visit(call.condition) : undefined
    );
  }

  visitPrimitiveLiteralNode(ape: PrimitiveLiteralNode): UnparserToken {
    let value = ape.value.toString();
    if (typeof ape.value === 'string') {
      value = `"${value}"`;
    }

    return Tok.atom(value);
  }

  visitObjectLiteralNode(object: ObjectLiteralNode): BlockToken {
    return Tok.objectBlock(...object.fields.map(f => this.visit(f)));
  }

  visitJessieExpressionNode(node: JessieExpressionNode): UnparserToken {
    // TODO: formatting of inner indentation
    return Tok.atom(node.source ?? node.expression);
  }

  visitAssignmentNode(ass: AssignmentNode): UnparserTokenGroup {
    const key = ass.key
      .map(key => {
        const isValidIdentifier =
          isValidIdentifierStartChar(key.charCodeAt(0)) &&
          Array.from(key).every(ch => isValidIdentifierChar(ch.charCodeAt(0)));

        if (isValidIdentifier) {
          return key;
        } else {
          return `"${key}"`;
        }
      })
      .join('.');

    return Tok.withSpaces(key, '=', this.visit(ass.value));
  }

  visitConditionAtomNode(ana: ConditionAtomNode): UnparserTokenGroup {
    return [
      Tok.atom('if'),
      Tok.space(),
      Tok.conditionBlock(this.visit(ana.expression)),
    ];
  }

  visitIterationAtomNode(iter: IterationAtomNode): UnparserTokenGroup {
    return [
      Tok.atom('foreach'),
      Tok.space(),
      Tok.foreachBlock(
        Tok.withSpaces(iter.iterationVariable, 'of', this.visit(iter.iterable))
      ),
    ];
  }

  visitSetStatementNode(set: SetStatementNode): UnparserTokenGroup {
    if (set.assignments.length > 1 || set.condition !== undefined) {
      return Tok.withSpaces(
        'set',
        set.condition !== undefined ? this.visit(set.condition) : undefined,
        Tok.setBlock(...set.assignments.map(ass => this.visit(ass)))
      );
    } else {
      return this.visit(set.assignments[0]);
    }
  }

  visitCallStatementNode(call: CallStatementNode): UnparserTokenGroup {
    return Tok.withSpaces(
      this.visitCallHead(call),
      Tok.statementBlock(...call.statements.map(s => this.visit(s)))
    );
  }

  visitHttpRequestNode(req: HttpRequestNode): UnparserTokenGroup {
    let security: UnparserTokenGroup = [
      Tok.if('httpCallDefaultSecurity', [
        ...Tok.withSpaces('security', 'none'),
        Tok.newline(),
      ]),
    ];
    if (req.security.length > 0) {
      security = req.security.flatMap(s => [
        ...Tok.withSpaces('security', `"${s.id}"`),
        Tok.newline(),
      ]);
    }

    let contentSettings: string[] = [];
    if (req.contentLanguage !== undefined) {
      contentSettings = [
        req.contentType !== undefined ? `"${req.contentType}"` : '"*"',
        `"${req.contentLanguage}"`,
      ];
    } else if (req.contentType !== undefined) {
      contentSettings = [`"${req.contentType}"`];
    }

    const requestStatements: UnparserTokenGroup[] = [];

    if (req.query !== undefined) {
      requestStatements.push(
        Tok.withSpaces('query', this.visitObjectLiteralNode(req.query))
      );
    }
    if (req.headers !== undefined) {
      requestStatements.push(
        Tok.withSpaces('headers', this.visitObjectLiteralNode(req.headers))
      );
    }
    if (req.body !== undefined) {
      if (req.body.kind === 'ObjectLiteral') {
        requestStatements.push(
          Tok.withSpaces('body', this.visitObjectLiteralNode(req.body))
        );
      } else {
        requestStatements.push(
          Tok.withSpaces('body', '=', this.visit(req.body))
        );
      }
    }

    // TODO lol
    return [
      ...security,
      ...Tok.withSpaces(
        'request',
        ...contentSettings,
        Tok.statementBlock(...requestStatements)
      ),
    ];
  }

  visitHttpResponseHandlerNode(
    hand: HttpResponseHandlerNode
  ): UnparserTokenGroup {
    const status =
      hand.statusCode !== undefined ? hand.statusCode.toString() : undefined;
    let contentFilters: string[] = [];
    if (hand.contentLanguage !== undefined) {
      contentFilters = [
        hand.contentType !== undefined ? `"${hand.contentType}"` : '"*"',
        `"${hand.contentLanguage}"`,
      ];
    } else if (hand.contentType !== undefined) {
      contentFilters = [`"${hand.contentType}"`];
    }

    return Tok.withSpaces(
      'response',
      status,
      ...contentFilters,
      Tok.statementBlock(...hand.statements.map(s => this.visit(s)))
    );
  }

  visitHttpCallStatementNode(http: HttpCallStatementNode): UnparserTokenGroup {
    let service: UnparserToken | string = Tok.if(
      'httpCallDefaultService',
      Tok.atom('default')
    );
    if (http.serviceId !== undefined) {
      service = `"${http.serviceId}"`;
    }

    const statements: UnparserTokenGroup[] = [];
    if (http.request !== undefined) {
      statements.push(this.visitHttpRequestNode(http.request));
    }
    statements.push(...http.responseHandlers.map(h => this.visit(h)));

    return Tok.withSpaces(
      'http',
      http.method,
      service,
      `"${http.url}"`,
      Tok.statementBlock(...statements)
    );
  }

  visitMapDefinitionNode(map: MapDefinitionNode): UnparserTokenGroup {
    this.currentContext = 'map';

    return Tok.withSpaces(
      'map',
      map.name,
      Tok.statementBlock(...map.statements.map(s => this.visit(s)))
    );
  }

  visitMapHeaderNode(header: MapHeaderNode): UnparserTokenGroup {
    const profile =
      ProfileId.fromParameters({
        scope: header.profile.scope,
        name: header.profile.name,
      }).withoutVersion +
      '@' +
      VersionRange.fromParameters({
        major: header.profile.version.major,
        minor: header.profile.version.minor,
      }).toString();

    const result = [
      ...Tok.withSpaces('profile', '=', `"${profile}"`),
      Tok.newline(),
      ...Tok.withSpaces('provider', '=', `"${header.provider}"`),
      Tok.newline(),
    ];
    if (header.variant !== undefined) {
      result.push(
        ...Tok.withSpaces('variant', '=', `"${header.variant}"`),
        Tok.newline()
      );
    }

    return result;
  }

  visitOperationDefinitionNode(
    operation: OperationDefinitionNode
  ): UnparserTokenGroup {
    this.currentContext = 'operation';

    return Tok.withSpaces(
      'operation',
      operation.name,
      Tok.statementBlock(...operation.statements.map(s => this.visit(s)))
    );
  }

  visitOutcomeStatementNode(outcome: OutcomeStatementNode): UnparserTokenGroup {
    let keyword;
    if (this.currentContext === 'map') {
      if (outcome.isError) {
        keyword = 'map error';
      } else {
        keyword = 'map result';
      }

      if (outcome.terminateFlow) {
        keyword = 'return ' + keyword;
      }
    } else {
      if (outcome.isError) {
        keyword = 'fail';
      } else {
        keyword = 'return';
      }
    }

    return Tok.withSpaces(
      keyword,
      outcome.condition ? this.visit(outcome.condition) : undefined,
      this.visit(outcome.value)
    );
  }

  visitInlineCallNode(call: InlineCallNode): UnparserTokenGroup {
    return this.visitCallHead(call);
  }

  visitMapDocumentNode(document: MapDocumentNode): UnparserTokenGroup {
    return [
      ...this.visit(document.header),
      Tok.newline(),
      ...Tok.addGlue(
        [Tok.newline(), Tok.newline()],
        document.definitions.map(d => this.visit(d))
      ),
    ];
  }
}
