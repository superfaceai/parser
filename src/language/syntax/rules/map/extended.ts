import {
  CallStatementNode,
  HttpCallStatementNode,
  HttpRequestNode,
  HttpResponseHandlerNode,
  InlineCallNode,
  JessieExpressionNode,
  LiteralNode,
  MapDefinitionNode,
  ObjectLiteralNode,
  OperationDefinitionNode,
  OutcomeStatementNode,
  PrimitiveLiteralNode,
  SetStatementNode,
} from '@superindustries/language';

import { JessieExpressionTerminationToken } from '../../../lexer/sublexer/jessie/expression';
import { SyntaxRule, SyntaxRuleOr } from '../../rule';
import {
  documentedNode,
  SLOT_DEFINITION_FACTORY,
  SrcNode,
  SyntaxRuleSrc,
} from '../common';
import {
  ASSIGNMENT_FACTORY,
  consumeLocalTerminators,
  JESSIE_EXPRESSION_FACTORY,
  MAP_DOCUMENT_FACTORY,
  MAYBE_CONTENT_TYPE,
  PRIMITIVE_LITERAL,
  STATEMENT_CONDITION,
  terminatorLookahead,
} from './common';

// ASSIGNMENTS //

/**
 * Factory for matching rhs expressions (after '=').
 */
export function RHS_EXPRESSION_FACTORY(
  ...terminators: ReadonlyArray<JessieExpressionTerminationToken>
): SyntaxRuleSrc<PrimitiveLiteralNode | InlineCallNode | JessieExpressionNode> {
  return terminatorLookahead(PRIMITIVE_LITERAL, ...terminators).or(
    JESSIE_EXPRESSION_FACTORY(...terminators)
  );
}

export const ARGUMENT_LIST_ASSIGNMENT = ASSIGNMENT_FACTORY(
  (...terminators) =>
    SyntaxRule.operator('=')
      .followedBy(RHS_EXPRESSION_FACTORY(...terminators))
      .map(([_op, value]) => value),
  ',',
  ')'
);

const CALL_STATEMENT_HEAD = SyntaxRule.identifier('call')
  .followedBy(SyntaxRule.identifier())
  .andFollowedBy(SyntaxRule.separator('('))
  .andFollowedBy(
    SyntaxRule.optional(SyntaxRule.repeat(ARGUMENT_LIST_ASSIGNMENT))
  )
  .andFollowedBy(SyntaxRule.separator(')'));
export const INLINE_CALL: SyntaxRuleSrc<InlineCallNode> = CALL_STATEMENT_HEAD.map(
  ([key, name, _sepArgStart, maybeArguments, sepArgEnd]): SrcNode<
    InlineCallNode
  > => {
    return {
      kind: 'InlineCall',
      operationName: name.data.identifier,
      arguments: maybeArguments ?? [],
      location: key.location,
      span: {
        start: key.span.start,
        end: sepArgEnd.span.end,
      },
    };
  }
);

export const SET_BLOCK_ASSIGNMENT = ASSIGNMENT_FACTORY(
  (...terminators) =>
    SyntaxRule.operator('=')
      .followedBy(INLINE_CALL.or(RHS_EXPRESSION_FACTORY(...terminators)))
      .map(([_op, value]) => value),
  '\n',
  ';',
  '}'
);

export const OBJECT_LITERAL_ASSIGNMENT = ASSIGNMENT_FACTORY(
  (...terminators) =>
    SyntaxRule.operator('=')
      .followedBy(INLINE_CALL.or(RHS_EXPRESSION_FACTORY(...terminators)))
      .map(([_op, value]) => value),
  '\n',
  ',',
  '}'
);

// ATOMS //

export const OBJECT_LITERAL: SyntaxRuleSrc<ObjectLiteralNode> = SyntaxRule.separator(
  '{'
)
  .followedBy(SyntaxRule.optional(SyntaxRule.repeat(OBJECT_LITERAL_ASSIGNMENT)))
  .andFollowedBy(SyntaxRule.separator('}'))
  .map(
    ([sepStart, maybeFields, sepEnd]): SrcNode<ObjectLiteralNode> => {
      return {
        kind: 'ObjectLiteral',
        fields: maybeFields ?? [],
        location: sepStart.location,
        span: {
          start: sepStart.span.start,
          end: sepEnd.span.end,
        },
      };
    }
  );

export const STATEMENT_RHS_VALUE: SyntaxRuleSrc<LiteralNode> = OBJECT_LITERAL.peekUnknown().or(
  consumeLocalTerminators(
    RHS_EXPRESSION_FACTORY('\n', ';', '}'),
    '\n',
    ';',
    '}'
  )
);

// SET STATEMENTS //

/**
 * set <?condition> { <...assignment> }
 */
const SET_STATEMENT_FULL: SyntaxRuleSrc<SetStatementNode> = SyntaxRule.identifier(
  'set'
)
  .followedBy(SyntaxRule.optional(STATEMENT_CONDITION))
  .andFollowedBy(SyntaxRule.separator('{'))
  .andFollowedBy(SyntaxRule.repeat(SET_BLOCK_ASSIGNMENT))
  .andFollowedBy(SyntaxRule.separator('}'))
  .map(
    ([key, maybeCondition, _sepStart, assignments, sepEnd]): SrcNode<
      SetStatementNode
    > => {
      return {
        kind: 'SetStatement',
        condition: maybeCondition,
        assignments,
        location: key.location,
        span: {
          start: key.span.start,
          end: sepEnd.span.end,
        },
      };
    }
  );

const SET_STATEMENT_RAW: SyntaxRuleSrc<SetStatementNode> = SET_BLOCK_ASSIGNMENT.map(
  (assignment): SrcNode<SetStatementNode> => {
    return {
      kind: 'SetStatement',
      assignments: [assignment],
      location: assignment.location,
      span: assignment.span,
    };
  }
);

export const SET_STATEMENT: SyntaxRuleSrc<SetStatementNode> = SET_STATEMENT_FULL.or(
  SET_STATEMENT_RAW
);

// CALL STATEMENT //

/**
 * call name(<...arguments>) <?condition> { <...statements> }
 */
export function CALL_STATEMENT_FACTORY(
  substatementRule: SyntaxRuleSrc<OutcomeStatementNode>
): SyntaxRuleSrc<CallStatementNode> {
  return CALL_STATEMENT_HEAD.andFollowedBy(
    SyntaxRule.optional(STATEMENT_CONDITION)
  )
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(
      SyntaxRule.optional(SyntaxRule.repeat(SET_STATEMENT.or(substatementRule)))
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([
        key,
        name,
        _sepArgStart,
        maybeArguments,
        _sepArgEnd,
        maybeCondition,
        _sepStart,
        statements,
        sepEnd,
      ]): SrcNode<CallStatementNode> => {
        return {
          kind: 'CallStatement',
          condition: maybeCondition,
          operationName: name.data.identifier,
          arguments: maybeArguments ?? [],
          statements: statements ?? [],
          location: key.location,
          span: {
            start: key.span.start,
            end: sepEnd.span.end,
          },
        };
      }
    );
}

// HTTP STATEMENT //

const HTTP_CALL_STATEMENT_REQUEST_QUERY_SLOT = SLOT_DEFINITION_FACTORY(
  'query',
  OBJECT_LITERAL
);
const HTTP_CALL_STATEMENT_REQUEST_HEADERS_SLOT = SLOT_DEFINITION_FACTORY(
  'headers',
  OBJECT_LITERAL
);
const HTTP_CALL_STATEMENT_REQUEST_BODY_SLOT = SLOT_DEFINITION_FACTORY(
  'body',
  OBJECT_LITERAL.or(
    SyntaxRule.operator('=')
      .followedBy(RHS_EXPRESSION_FACTORY('\n', '}'))
      .map(([_op, value]) => value)
  )
);

export const HTTP_REQUEST_VARIABLES_BLOCK = SyntaxRule.separator('{')
  .followedBy(SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST_QUERY_SLOT))
  .andFollowedBy(SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST_HEADERS_SLOT))
  .andFollowedBy(SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST_BODY_SLOT))
  .andFollowedBy(SyntaxRule.separator('}'))
  .map(([sepStart, maybeQuery, maybeHeaders, maybeBody, sepEnd]) => {
    return {
      query: maybeQuery?.[1],
      headers: maybeHeaders?.[1],
      body: maybeBody?.[1],
      span: {
        start: sepStart.span.start,
        end: sepEnd.span.end,
      },
    };
  });

export const HTTP_REQUEST_VARIABLES_SHORTHAND = SyntaxRuleOr.chainOr<{
  query?: HttpRequestNode['query'];
  headers?: HttpRequestNode['headers'];
  body?: HttpRequestNode['body'];
  span: SrcNode<HttpRequestNode>['span'];
}>(
  HTTP_CALL_STATEMENT_REQUEST_QUERY_SLOT.map(([_, value]) => {
    return {
      query: value,
      span: value.span,
    };
  }),
  HTTP_CALL_STATEMENT_REQUEST_HEADERS_SLOT.map(([_, value]) => {
    return {
      headers: value,
      span: value.span,
    };
  }),
  HTTP_CALL_STATEMENT_REQUEST_BODY_SLOT.map(([_, value]) => {
    return {
      body: value,
      span: value.span,
    };
  })
);

export const HTTP_REQUEST: SyntaxRuleSrc<HttpRequestNode> = SyntaxRule.identifier(
  'request'
)
  .followedBy(MAYBE_CONTENT_TYPE)
  .andFollowedBy(
    SyntaxRule.optional(SyntaxRule.string()) // content language
  )
  .andFollowedBy(
    HTTP_REQUEST_VARIABLES_BLOCK.or(HTTP_REQUEST_VARIABLES_SHORTHAND)
  )
  .map(
    ([key, maybeContentType, maybeContentLanguage, variablesBlock]): SrcNode<
      HttpRequestNode
    > => {
      return {
        kind: 'HttpRequest',
        contentType: maybeContentType,
        contentLanguage: maybeContentLanguage?.data.string,
        query: variablesBlock.query,
        headers: variablesBlock.headers,
        body: variablesBlock.body,
        location: key.location,
        span: {
          start: key.span.start,
          end: variablesBlock.span.end,
        },
      };
    }
  );

function HTTP_CALL_STATEMENT_RESPONSE_HANDLER(
  substatementRule: SyntaxRuleSrc<OutcomeStatementNode>
): SyntaxRuleSrc<HttpResponseHandlerNode> {
  return SyntaxRule.identifier('response')
    .followedBy(
      SyntaxRule.optional(
        SyntaxRule.literal().andThen(
          match =>
            typeof match.data.literal === 'number'
              ? { kind: 'match', value: match.data.literal }
              : { kind: 'nomatch' },
          'number literal'
        )
      )
    )
    .andFollowedBy(MAYBE_CONTENT_TYPE)
    .andFollowedBy(
      SyntaxRule.optional(SyntaxRule.string()) // content language
    )
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(
      SyntaxRule.optional(SyntaxRule.repeat(SET_STATEMENT.or(substatementRule)))
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([
        key,
        maybeStatusCode,
        maybeContentType,
        maybeContentLanguage,
        _sepStart,
        maybeSubstatements,
        sepEnd,
      ]): SrcNode<HttpResponseHandlerNode> => {
        return {
          kind: 'HttpResponseHandler',
          statusCode: maybeStatusCode,
          contentType: maybeContentType,
          contentLanguage: maybeContentLanguage?.data.string,
          statements: maybeSubstatements ?? [],
          location: key.location,
          span: {
            start: key.span.start,
            end: sepEnd.span.end,
          },
        };
      }
    );
}

export function HTTP_CALL_STATEMENT_FACTORY(
  substatementRule: SyntaxRuleSrc<OutcomeStatementNode>
): SyntaxRuleSrc<HttpCallStatementNode> {
  return SyntaxRule.identifier('http')
    .followedBy(
      SyntaxRule.identifier() // verb
    )
    .andFollowedBy(
      SyntaxRule.string() // url
    )
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(SyntaxRule.optional(HTTP_REQUEST))
    .andFollowedBy(
      SyntaxRule.optional(
        SyntaxRule.repeat(
          HTTP_CALL_STATEMENT_RESPONSE_HANDLER(substatementRule)
        )
      )
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([
        key,
        verb,
        url,
        _sepStart,
        maybeRequest,
        maybeResponseHandlers,
        sepEnd,
      ]): SrcNode<HttpCallStatementNode> => {
        return {
          kind: 'HttpCallStatement',
          method: verb.data.identifier,
          url: url.data.string,
          request: maybeRequest,
          responseHandlers: maybeResponseHandlers ?? [],
          location: key.location,
          span: {
            start: key.span.start,
            end: sepEnd.span.end,
          },
        };
      }
    );
}

// CONTEXTUAL STATEMENTS //

/**
 * return? map result/error <?condition> <value>;
 */
export const MAP_OUTCOME_STATEMENT: SyntaxRuleSrc<OutcomeStatementNode> = SyntaxRule.optional(
  SyntaxRule.identifier('return')
)
  .followedBy(SyntaxRule.identifier('map'))
  .andFollowedBy(
    SyntaxRule.identifier('result').or(SyntaxRule.identifier('error'))
  )
  .andFollowedBy(SyntaxRule.optional(STATEMENT_CONDITION))
  .andFollowedBy(STATEMENT_RHS_VALUE)
  .map(
    ([maybeReturn, keyMap, keyType, maybeCondition, value]): SrcNode<
      OutcomeStatementNode
    > => {
      return {
        kind: 'OutcomeStatement',
        isError: keyType.data.identifier === 'error',
        terminateFlow: maybeReturn !== undefined,
        condition: maybeCondition,
        value,
        location: (maybeReturn ?? keyMap).location,
        span: {
          start: (maybeReturn ?? keyMap).span.start,
          end: value.span.end,
        },
      };
    }
  );

/**
 * return/fail <?condition> <value>;
 */
export const OPERATION_OUTCOME_STATEMENT: SyntaxRuleSrc<OutcomeStatementNode> = SyntaxRule.identifier(
  'return'
)
  .or(SyntaxRule.identifier('fail'))
  .followedBy(SyntaxRule.optional(STATEMENT_CONDITION))
  .andFollowedBy(STATEMENT_RHS_VALUE)
  .map(
    ([keyType, maybeCondition, value]): SrcNode<OutcomeStatementNode> => {
      return {
        kind: 'OutcomeStatement',
        isError: keyType.data.identifier === 'fail',
        terminateFlow: true,
        condition: maybeCondition,
        value,
        location: keyType.location,
        span: {
          start: keyType.span.start,
          end: value.span.end,
        },
      };
    }
  );

function DEFINITION_SUBSTATEMENTS_FACTORY(
  substatements: SyntaxRuleSrc<OutcomeStatementNode>
): SyntaxRule<
  | OutcomeStatementNode
  | CallStatementNode
  | HttpCallStatementNode
  | SetStatementNode
> {
  return substatements
    .or(CALL_STATEMENT_FACTORY(substatements))
    .or(HTTP_CALL_STATEMENT_FACTORY(substatements))
    .or(SET_STATEMENT);
}
export const MAP_SUBSTATEMENT = DEFINITION_SUBSTATEMENTS_FACTORY(
  MAP_OUTCOME_STATEMENT
);
export const OPERATION_SUBSTATEMENT = DEFINITION_SUBSTATEMENTS_FACTORY(
  OPERATION_OUTCOME_STATEMENT
);

// MAP DEFINITION //

export const MAP_DEFINITION: SyntaxRuleSrc<MapDefinitionNode> = documentedNode(
  SyntaxRule.identifier('map')
    .followedBy(SyntaxRule.identifier())
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(SyntaxRule.optional(SyntaxRule.repeat(MAP_SUBSTATEMENT)))
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([key, name, _sepStart, maybeStatements, sepEnd]): SrcNode<
        MapDefinitionNode
      > => {
        return {
          kind: 'MapDefinition',
          name: name.data.identifier,
          usecaseName: name.data.identifier,
          statements: maybeStatements ?? [],
          location: key.location,
          span: {
            start: key.span.start,
            end: sepEnd.span.end,
          },
        };
      }
    )
);

// OPERATION DEFINITION //

export const OPERATION_DEFINITION: SyntaxRuleSrc<OperationDefinitionNode> = documentedNode(
  SyntaxRule.identifier('operation')
    .followedBy(SyntaxRule.identifier())
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(
      SyntaxRule.optional(SyntaxRule.repeat(OPERATION_SUBSTATEMENT))
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([key, name, _sepStart, maybeStatements, sepEnd]): SrcNode<
        OperationDefinitionNode
      > => {
        return {
          kind: 'OperationDefinition',
          name: name.data.identifier,
          statements: maybeStatements ?? [],
          location: key.location,
          span: {
            start: key.span.start,
            end: sepEnd.span.end,
          },
        };
      }
    )
);

// DOCUMENT //

export const MAP_DOCUMENT_DEFINITION: SyntaxRuleSrc<
  MapDefinitionNode | OperationDefinitionNode
> = MAP_DEFINITION.or(OPERATION_DEFINITION);

export const MAP_DOCUMENT = MAP_DOCUMENT_FACTORY(MAP_DOCUMENT_DEFINITION);
