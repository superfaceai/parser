import {
  AssignmentNode,
  CallStatementNode,
  HttpCallStatementNode,
  HttpRequestNode,
  HttpResponseHandlerNode,
  HttpSecurityRequirement,
  InlineCallNode,
  JessieExpressionNode,
  LiteralNode,
  MapDefinitionNode,
  ObjectLiteralNode,
  OperationDefinitionNode,
  OutcomeStatementNode,
  PrimitiveLiteralNode,
  SetStatementNode,
} from '@superfaceai/ast';

import { LexerTokenKind } from '../../../lexer';
import { TerminationTokens } from '../../../lexer/token';
import {
  SyntaxRuleFeatureOr,
  SyntaxRuleFeatureSubstitute,
} from '../../features';
import { SyntaxRule, SyntaxRuleMutable, SyntaxRuleOr } from '../../rule';
import {
  ASSIGNMENT_PATH_KEY,
  documentedNode,
  expectTerminated,
  LocationInfo,
  mapAssignmentPath,
  TERMINATOR_TOKEN_FACTORY,
  WithLocationInfo,
} from '../common';
import {
  CONDITION_ATOM,
  ITERATION_ATOM,
  JESSIE_EXPRESSION_FACTORY,
  MAP_DOCUMENT_FACTORY,
  MAYBE_CONTENT_TYPE,
  PRIMITIVE_LITERAL,
} from './common';

// ASSIGNMENTS //

/**
 * Factory for matching rhs expressions (after '=').
 */
function RHS_EXPRESSION_FACTORY<T>(
  nonJessieAttempt: SyntaxRule<WithLocationInfo<T>>,
  ...terminators: ReadonlyArray<TerminationTokens>
): SyntaxRule<WithLocationInfo<T> | WithLocationInfo<JessieExpressionNode>> {
  return nonJessieAttempt
    .lookahead(TERMINATOR_TOKEN_FACTORY(...terminators))
    .or(JESSIE_EXPRESSION_FACTORY(...terminators))
    .skip(
      SyntaxRule.optional(
        TERMINATOR_TOKEN_FACTORY(
          ...terminators.filter(ter => ter === ',' || ter === ';')
        )
      )
    );
}

function ASSIGNMENT_FACTORY(
  rhs: SyntaxRule<WithLocationInfo<LiteralNode>>
): SyntaxRule<WithLocationInfo<AssignmentNode>> {
  return ASSIGNMENT_PATH_KEY.followedBy(rhs).map(
    ([path, value]): WithLocationInfo<AssignmentNode> => {
      return {
        kind: 'Assignment',
        key: mapAssignmentPath(path),
        value,
        location: path[0].location,
        span: {
          start: path[0].span.start,
          end: value.span.end,
        },
      };
    }
  );
}

export const ARGUMENT_LIST_ASSIGNMENT = ASSIGNMENT_FACTORY(
  SyntaxRule.operator('=').forgetFollowedBy(
    RHS_EXPRESSION_FACTORY<PrimitiveLiteralNode>(PRIMITIVE_LITERAL, ',', ')')
  )
);

const CALL_STATEMENT_HEAD = SyntaxRule.identifier('call')
  .followedBy(SyntaxRule.optional(ITERATION_ATOM))
  .andFollowedBy(SyntaxRule.identifier())
  .andFollowedBy(SyntaxRule.separator('('))
  .andFollowedBy(
    SyntaxRule.optional(SyntaxRule.repeat(ARGUMENT_LIST_ASSIGNMENT))
  )
  .andFollowedBy(SyntaxRule.separator(')'))
  .andFollowedBy(SyntaxRule.optional(CONDITION_ATOM))
  .map(
    ([
      key,
      maybeIteration,
      name,
      _sepStart,
      maybeArguments,
      sepEnd,
      maybeCondition,
    ]) => {
      return {
        iteration: maybeIteration,
        condition: maybeCondition,
        operationName: name.data.identifier,
        arguments: maybeArguments ?? [],
        location: key.location,
        span: {
          start: key.span.start,
          end: (maybeCondition ?? sepEnd).span.end,
        },
      };
    }
  );

export const INLINE_CALL: SyntaxRule<WithLocationInfo<InlineCallNode>> =
  CALL_STATEMENT_HEAD.map((head): WithLocationInfo<InlineCallNode> => {
    return {
      kind: 'InlineCall',
      ...head,
    };
  });

// ATOMS //

const OBJECT_LITERAL_MUT = new SyntaxRuleMutable<
  WithLocationInfo<ObjectLiteralNode>
>();
export const OBJECT_LITERAL_ASSIGNMENT = ASSIGNMENT_FACTORY(
  new SyntaxRuleFeatureOr(
    SyntaxRule.operator('=').forgetFollowedBy(
      RHS_EXPRESSION_FACTORY<PrimitiveLiteralNode | InlineCallNode>(
        INLINE_CALL.or(PRIMITIVE_LITERAL),
        '\n',
        ',',
        '}'
      )
    ),
    'nested_object_literals',
    expectTerminated(OBJECT_LITERAL_MUT, '\n', ',', '}')
  )
);

export const OBJECT_LITERAL = SyntaxRule.separator('{')
  .followedBy(SyntaxRule.optional(SyntaxRule.repeat(OBJECT_LITERAL_ASSIGNMENT)))
  .andFollowedBy(SyntaxRule.separator('}'))
  .map(
    ([sepStart, maybeFields, sepEnd]): WithLocationInfo<ObjectLiteralNode> => {
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
OBJECT_LITERAL_MUT.rule = OBJECT_LITERAL;

export const SET_BLOCK_ASSIGNMENT = ASSIGNMENT_FACTORY(
  new SyntaxRuleFeatureOr(
    SyntaxRule.operator('=').forgetFollowedBy(
      RHS_EXPRESSION_FACTORY<PrimitiveLiteralNode | InlineCallNode>(
        INLINE_CALL.or(PRIMITIVE_LITERAL),
        '\n',
        ';',
        '}'
      )
    ),
    'nested_object_literals',
    expectTerminated(OBJECT_LITERAL, '\n', ';', '}')
  )
);

// SET STATEMENTS //

/**
 * set <?condition> { <...assignment> }
 */
const SET_STATEMENT_FULL: SyntaxRule<WithLocationInfo<SetStatementNode>> =
  SyntaxRule.identifier('set')
    .followedBy(SyntaxRule.optional(CONDITION_ATOM))
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(SyntaxRule.repeat(SET_BLOCK_ASSIGNMENT))
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([
        key,
        maybeCondition,
        _sepStart,
        assignments,
        sepEnd,
      ]): WithLocationInfo<SetStatementNode> => {
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

const SET_STATEMENT_RAW: SyntaxRule<WithLocationInfo<SetStatementNode>> =
  SET_BLOCK_ASSIGNMENT.map((assignment): WithLocationInfo<SetStatementNode> => {
    return {
      kind: 'SetStatement',
      assignments: [assignment],
      location: assignment.location,
      span: assignment.span,
    };
  });

export const SET_STATEMENT: SyntaxRule<WithLocationInfo<SetStatementNode>> =
  SET_STATEMENT_FULL.or(SET_STATEMENT_RAW);

// CALL STATEMENT //

/**
 * call name(<...arguments>) <?condition> { <...statements> }
 */
export function CALL_STATEMENT_FACTORY(
  substatementRule: SyntaxRule<WithLocationInfo<OutcomeStatementNode>>
): SyntaxRule<WithLocationInfo<CallStatementNode>> {
  return CALL_STATEMENT_HEAD.followedBy(SyntaxRule.separator('{'))
    .andFollowedBy(
      SyntaxRule.optional(SyntaxRule.repeat(SET_STATEMENT.or(substatementRule)))
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([
        head,
        _sepStart,
        statements,
        sepEnd,
      ]): WithLocationInfo<CallStatementNode> => {
        return {
          kind: 'CallStatement',
          ...head,
          statements: statements ?? [],
          span: {
            start: head.span.start,
            end: sepEnd.span.end,
          },
        };
      }
    );
}

// HTTP STATEMENT //

const HTTP_CALL_STATEMENT_SECURITY_REQUIREMENT: SyntaxRule<
  {
    id?: HttpSecurityRequirement['id'];
    scheme?: HttpSecurityRequirement['scheme'];
  } & LocationInfo
> = SyntaxRule.identifier('security')
  .followedBy(SyntaxRule.string().or(SyntaxRule.identifier('none')))
  .lookahead(SyntaxRule.newline())
  .map(([key, id]) => {
    let idString = undefined;
    if (id.data.kind === LexerTokenKind.STRING) {
      idString = id.data.string;
    }

    return {
      id: idString,
      location: key.location,
      span: {
        start: key.span.start,
        end: id.span.end,
      },
    };
  });

const HTTP_CALL_STATEMENT_SECURITY_REQUIREMENTS =
  new SyntaxRuleFeatureSubstitute(
    HTTP_CALL_STATEMENT_SECURITY_REQUIREMENT.map(s => [s]),
    'multiple_security_schemes',
    SyntaxRule.repeat(HTTP_CALL_STATEMENT_SECURITY_REQUIREMENT)
  ).map(arr => {
    const first = arr[0];
    const last = arr[arr.length - 1];

    const requirements: HttpSecurityRequirement[] = arr
      .filter(elem => elem.id !== undefined)
      .map(req => {
        if (typeof req.id !== 'string') {
          // .filter API is.. lacking
          throw 'unreachable';
        }

        return {
          id: req.id,
          scheme: req.scheme,
        };
      });

    return {
      security: requirements,
      location: first.location,
      span: {
        start: first.span.start,
        end: last.span.end,
      },
    };
  });

const HTTP_CALL_STATEMENT_REQUEST_SLOT_LITERAL = SyntaxRule.sameLine(
  OBJECT_LITERAL
).lookahead(TERMINATOR_TOKEN_FACTORY('\n', '}'));
const HTTP_CALL_STATEMENT_REQUEST_QUERY_SLOT = SyntaxRule.identifier(
  'query'
).followedBy(HTTP_CALL_STATEMENT_REQUEST_SLOT_LITERAL);
const HTTP_CALL_STATEMENT_REQUEST_HEADERS_SLOT = SyntaxRule.identifier(
  'headers'
).followedBy(HTTP_CALL_STATEMENT_REQUEST_SLOT_LITERAL);
const HTTP_CALL_STATEMENT_REQUEST_BODY_SLOT = SyntaxRule.identifier(
  'body'
).followedBy(
  HTTP_CALL_STATEMENT_REQUEST_SLOT_LITERAL.or(
    SyntaxRule.operator('=').forgetFollowedBy(
      RHS_EXPRESSION_FACTORY<InlineCallNode | PrimitiveLiteralNode>(
        INLINE_CALL.or(PRIMITIVE_LITERAL),
        '\n',
        '}'
      )
    )
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
  query?: WithLocationInfo<HttpRequestNode>['query'];
  headers?: WithLocationInfo<HttpRequestNode>['headers'];
  body?: WithLocationInfo<HttpRequestNode>['body'];
  span: WithLocationInfo<HttpRequestNode>['span'];
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

export const HTTP_CALL_STATEMENT_REQUEST = SyntaxRule.identifier('request')
  .followedBy(MAYBE_CONTENT_TYPE)
  .andFollowedBy(
    SyntaxRule.optional(SyntaxRule.string()) // content language
  )
  .andFollowedBy(
    new SyntaxRuleFeatureOr(
      HTTP_REQUEST_VARIABLES_BLOCK,
      'shorthand_http_request_slots',
      HTTP_REQUEST_VARIABLES_SHORTHAND
    )
  )
  .map(([key, maybeContentType, maybeContentLanguage, variablesBlock]) => {
    return {
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
    } as const;
  });

const HTTP_REQUEST_OPTIONAL: SyntaxRule<
  WithLocationInfo<HttpRequestNode> | undefined
> = SyntaxRule.optional(HTTP_CALL_STATEMENT_SECURITY_REQUIREMENTS)
  .followedBy(SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST))
  .map(
    ([maybeSecurity, maybeRequest]):
      | WithLocationInfo<HttpRequestNode>
      | undefined => {
      if (maybeSecurity !== undefined && maybeRequest !== undefined) {
        return {
          kind: 'HttpRequest',
          ...maybeRequest,
          ...maybeSecurity,
          location: maybeSecurity.location,
          span: {
            start: maybeSecurity.span.start,
            end: maybeRequest.span.end,
          },
        };
      } else if (maybeSecurity !== undefined) {
        return {
          kind: 'HttpRequest',
          ...maybeSecurity,
        };
      } else if (maybeRequest !== undefined) {
        return {
          kind: 'HttpRequest',
          ...maybeRequest,
          security: [],
        };
      } else {
        return undefined;
      }
    }
  );

function HTTP_CALL_STATEMENT_RESPONSE_HANDLER(
  substatementRule: SyntaxRule<WithLocationInfo<OutcomeStatementNode>>
): SyntaxRule<WithLocationInfo<HttpResponseHandlerNode>> {
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
      ]): WithLocationInfo<HttpResponseHandlerNode> => {
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
  substatementRule: SyntaxRule<WithLocationInfo<OutcomeStatementNode>>
): SyntaxRule<WithLocationInfo<HttpCallStatementNode>> {
  return SyntaxRule.identifier('http')
    .followedBy(
      SyntaxRule.identifier() // verb
    )
    .andFollowedBy(
      SyntaxRule.string() // url
    )
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(HTTP_REQUEST_OPTIONAL)
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
      ]): WithLocationInfo<HttpCallStatementNode> => {
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

const OUTCOME_VALUE: SyntaxRule<WithLocationInfo<LiteralNode>> =
  RHS_EXPRESSION_FACTORY<ObjectLiteralNode | PrimitiveLiteralNode>(
    OBJECT_LITERAL.or(PRIMITIVE_LITERAL),
    '\n',
    ';',
    '}'
  );
/**
 * return? map result/error <?condition> <value>;
 */
export const MAP_OUTCOME_STATEMENT: SyntaxRule<
  WithLocationInfo<OutcomeStatementNode>
> = SyntaxRule.optional(SyntaxRule.identifier('return'))
  .followedBy(SyntaxRule.identifier('map'))
  .andFollowedBy(
    SyntaxRule.identifier('result').or(SyntaxRule.identifier('error'))
  )
  .andFollowedBy(SyntaxRule.optional(CONDITION_ATOM))
  .andFollowedBy(OUTCOME_VALUE)
  .map(
    ([
      maybeReturn,
      keyMap,
      keyType,
      maybeCondition,
      value,
    ]): WithLocationInfo<OutcomeStatementNode> => {
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
export const OPERATION_OUTCOME_STATEMENT: SyntaxRule<
  WithLocationInfo<OutcomeStatementNode>
> = SyntaxRule.identifier('return')
  .or(SyntaxRule.identifier('fail'))
  .followedBy(SyntaxRule.optional(CONDITION_ATOM))
  .andFollowedBy(OUTCOME_VALUE)
  .map(
    ([
      keyType,
      maybeCondition,
      value,
    ]): WithLocationInfo<OutcomeStatementNode> => {
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
  substatements: SyntaxRule<WithLocationInfo<OutcomeStatementNode>>
): SyntaxRule<
  WithLocationInfo<
    | OutcomeStatementNode
    | CallStatementNode
    | HttpCallStatementNode
    | SetStatementNode
  >
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

export const MAP_DEFINITION: SyntaxRule<WithLocationInfo<MapDefinitionNode>> =
  documentedNode(
    SyntaxRule.identifier('map')
      .followedBy(SyntaxRule.identifier())
      .andFollowedBy(SyntaxRule.separator('{'))
      .andFollowedBy(SyntaxRule.optional(SyntaxRule.repeat(MAP_SUBSTATEMENT)))
      .andFollowedBy(SyntaxRule.separator('}'))
      .map(
        ([
          key,
          name,
          _sepStart,
          maybeStatements,
          sepEnd,
        ]): WithLocationInfo<MapDefinitionNode> => {
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

export const OPERATION_DEFINITION: SyntaxRule<
  WithLocationInfo<OperationDefinitionNode>
> = documentedNode(
  SyntaxRule.identifier('operation')
    .followedBy(SyntaxRule.identifier())
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(
      SyntaxRule.optional(SyntaxRule.repeat(OPERATION_SUBSTATEMENT))
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([
        key,
        name,
        _sepStart,
        maybeStatements,
        sepEnd,
      ]): WithLocationInfo<OperationDefinitionNode> => {
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

export const MAP_DOCUMENT_DEFINITION: SyntaxRule<
  WithLocationInfo<MapDefinitionNode | OperationDefinitionNode>
> = MAP_DEFINITION.or(OPERATION_DEFINITION);

export const MAP_DOCUMENT = MAP_DOCUMENT_FACTORY(MAP_DOCUMENT_DEFINITION);
