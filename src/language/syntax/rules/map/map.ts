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
  MapDocumentNode,
  ObjectLiteralNode,
  OperationDefinitionNode,
  OutcomeStatementNode,
  PrimitiveLiteralNode,
  SetStatementNode,
} from '@superfaceai/ast';

import { PARSED_AST_VERSION, PARSED_VERSION } from '../../../../metadata';
import { LexerTokenKind } from '../../../lexer';
import { TerminationTokens } from '../../../lexer/token';
import {
  SyntaxRuleFeatureOr,
  SyntaxRuleFeatureSubstitute,
} from '../../features';
import { SyntaxRule, SyntaxRuleMutable, SyntaxRuleOr } from '../../rule';
import {
  ASSIGNMENT_PATH_KEY,
  computeLocationSpan,
  documentedNode,
  expectTerminated,
  HasLocation,
  mapAssignmentPath,
  SyntaxRuleSourceChecksum,
  TERMINATOR_TOKEN_FACTORY,
  WithLocation,
} from '../common';
import {
  CONDITION_ATOM,
  ITERATION_ATOM,
  JESSIE_EXPRESSION_FACTORY,
  MAP_HEADER,
  MAYBE_CONTENT_TYPE,
  PRIMITIVE_LITERAL,
} from './common';

// ASSIGNMENTS //

/**
 * Factory for matching rhs expressions (after '=').
 */
function RHS_EXPRESSION_FACTORY<T>(
  nonJessieAttempt: SyntaxRule<WithLocation<T>>,
  ...terminators: ReadonlyArray<TerminationTokens>
): SyntaxRule<WithLocation<T> | WithLocation<JessieExpressionNode>> {
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
  rhs: SyntaxRule<WithLocation<LiteralNode>>
): SyntaxRule<WithLocation<AssignmentNode>> {
  return ASSIGNMENT_PATH_KEY.followedBy(rhs).map(
    ([path, value]): WithLocation<AssignmentNode> => {
      return {
        kind: 'Assignment',
        key: mapAssignmentPath(path),
        value,
        location: computeLocationSpan(...path, value),
      };
    }
  );
}

export const ARGUMENT_LIST_ASSIGNMENT = ASSIGNMENT_FACTORY(
  SyntaxRule.operator('=').forgetFollowedBy(
    RHS_EXPRESSION_FACTORY<PrimitiveLiteralNode>(PRIMITIVE_LITERAL, ',', ')')
  )
);

const CALL_STATEMENT_HEAD = SyntaxRule.followedBy(
  SyntaxRule.identifier('call'),
  SyntaxRule.optional(ITERATION_ATOM),
  SyntaxRule.identifier(),
  SyntaxRule.separator('('),
  SyntaxRule.optional(SyntaxRule.repeat(ARGUMENT_LIST_ASSIGNMENT)),
  SyntaxRule.separator(')'),
  SyntaxRule.optional(CONDITION_ATOM)
).map(
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
      location: computeLocationSpan(key, sepEnd, maybeCondition),
    };
  }
);

export const INLINE_CALL: SyntaxRule<WithLocation<InlineCallNode>> =
  CALL_STATEMENT_HEAD.map((head): WithLocation<InlineCallNode> => {
    return {
      kind: 'InlineCall',
      ...head,
    };
  });

// ATOMS //

const OBJECT_LITERAL_MUT = new SyntaxRuleMutable<
  WithLocation<ObjectLiteralNode>
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

export const OBJECT_LITERAL = SyntaxRule.followedBy(
  SyntaxRule.separator('{'),
  SyntaxRule.optional(SyntaxRule.repeat(OBJECT_LITERAL_ASSIGNMENT)),
  SyntaxRule.separator('}')
).map(([sepStart, maybeFields, sepEnd]): WithLocation<ObjectLiteralNode> => {
  return {
    kind: 'ObjectLiteral',
    fields: maybeFields ?? [],
    location: computeLocationSpan(sepStart, sepEnd),
  };
});
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
const SET_STATEMENT_FULL: SyntaxRule<WithLocation<SetStatementNode>> =
  SyntaxRule.followedBy(
    SyntaxRule.identifier('set'),
    SyntaxRule.optional(CONDITION_ATOM),
    SyntaxRule.separator('{'),
    SyntaxRule.repeat(SET_BLOCK_ASSIGNMENT),
    SyntaxRule.separator('}')
  ).map(
    ([
      keyword,
      maybeCondition,
      _sepStart,
      assignments,
      sepEnd,
    ]): WithLocation<SetStatementNode> => {
      return {
        kind: 'SetStatement',
        condition: maybeCondition,
        assignments,
        location: computeLocationSpan(keyword, sepEnd),
      };
    }
  );

const SET_STATEMENT_RAW: SyntaxRule<WithLocation<SetStatementNode>> =
  SET_BLOCK_ASSIGNMENT.map((assignment): WithLocation<SetStatementNode> => {
    return {
      kind: 'SetStatement',
      assignments: [assignment],
      location: assignment.location,
    };
  });

export const SET_STATEMENT: SyntaxRule<WithLocation<SetStatementNode>> =
  SET_STATEMENT_FULL.or(SET_STATEMENT_RAW);

// CALL STATEMENT //

/**
 * call name(<...arguments>) <?condition> { <...statements> }
 */
export function CALL_STATEMENT_FACTORY(
  substatementRule: SyntaxRule<WithLocation<OutcomeStatementNode>>
): SyntaxRule<WithLocation<CallStatementNode>> {
  return SyntaxRule.followedBy(
    CALL_STATEMENT_HEAD,
    SyntaxRule.separator('{'),
    SyntaxRule.optional(SyntaxRule.repeat(SET_STATEMENT.or(substatementRule))),

    SyntaxRule.separator('}')
  ).map(
    ([
      head,
      _sepStart,
      statements,
      sepEnd,
    ]): WithLocation<CallStatementNode> => {
      return {
        kind: 'CallStatement',
        ...head,
        statements: statements ?? [],
        location: computeLocationSpan(head, sepEnd),
      };
    }
  );
}

// HTTP STATEMENT //

type HttpCallStatementSecurityRequirement = {
  id?: HttpSecurityRequirement['id'];
  scheme?: HttpSecurityRequirement['scheme'];
} & HasLocation;
const HTTP_CALL_STATEMENT_SECURITY_REQUIREMENT: SyntaxRule<HttpCallStatementSecurityRequirement> =
  SyntaxRule.identifier('security')
    .followedBy(SyntaxRule.string().or(SyntaxRule.identifier('none')))
    .lookahead(SyntaxRule.newline())
    .map(([keyword, id]) => {
      let idString = undefined;
      if (id.data.kind === LexerTokenKind.STRING) {
        idString = id.data.string;
      }

      return {
        id: idString,
        location: computeLocationSpan(keyword, id),
      };
    });

const HTTP_CALL_STATEMENT_SECURITY_REQUIREMENTS =
  new SyntaxRuleFeatureSubstitute(
    HTTP_CALL_STATEMENT_SECURITY_REQUIREMENT.map<
      [HttpCallStatementSecurityRequirement]
    >(s => [s]),
    'multiple_security_schemes',
    SyntaxRule.repeat(HTTP_CALL_STATEMENT_SECURITY_REQUIREMENT)
  ).map(arr => {
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
      location: computeLocationSpan(...arr),
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

export const HTTP_REQUEST_VARIABLES_BLOCK = SyntaxRule.followedBy(
  SyntaxRule.separator('{'),
  SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST_QUERY_SLOT),
  SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST_HEADERS_SLOT),
  SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST_BODY_SLOT),
  SyntaxRule.separator('}')
).map(([sepStart, maybeQuery, maybeHeaders, maybeBody, sepEnd]) => {
  return {
    query: maybeQuery?.[1],
    headers: maybeHeaders?.[1],
    body: maybeBody?.[1],
    location: computeLocationSpan(sepStart, sepEnd),
  };
});

export const HTTP_REQUEST_VARIABLES_SHORTHAND: SyntaxRule<
  {
    query?: WithLocation<HttpRequestNode>['query'];
    headers?: WithLocation<HttpRequestNode>['headers'];
    body?: WithLocation<HttpRequestNode>['body'];
  } & HasLocation
> = new SyntaxRuleOr(
  HTTP_CALL_STATEMENT_REQUEST_QUERY_SLOT.map(([_, value]) => {
    return {
      query: value,
      location: value.location,
    };
  }),
  HTTP_CALL_STATEMENT_REQUEST_HEADERS_SLOT.map(([_, value]) => {
    return {
      headers: value,
      location: value.location,
    };
  }),
  HTTP_CALL_STATEMENT_REQUEST_BODY_SLOT.map(([_, value]) => {
    return {
      body: value,
      location: value.location,
    };
  })
);

export const HTTP_CALL_STATEMENT_REQUEST = SyntaxRule.followedBy(
  SyntaxRule.identifier('request'),
  MAYBE_CONTENT_TYPE,
  SyntaxRule.optional(SyntaxRule.string()), // content language
  new SyntaxRuleFeatureOr(
    HTTP_REQUEST_VARIABLES_BLOCK,
    'shorthand_http_request_slots',
    HTTP_REQUEST_VARIABLES_SHORTHAND
  )
).map(([keyword, maybeContentType, maybeContentLanguage, variablesBlock]) => {
  return {
    contentType: maybeContentType,
    contentLanguage: maybeContentLanguage?.data.string,
    query: variablesBlock.query,
    headers: variablesBlock.headers,
    body: variablesBlock.body,
    location: computeLocationSpan(keyword, variablesBlock),
  } as const;
});

const HTTP_REQUEST_OPTIONAL: SyntaxRule<
  WithLocation<HttpRequestNode> | undefined
> = SyntaxRule.optional(HTTP_CALL_STATEMENT_SECURITY_REQUIREMENTS)
  .followedBy(SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST))
  .map(
    ([maybeSecurity, maybeRequest]):
      | WithLocation<HttpRequestNode>
      | undefined => {
      if (maybeSecurity !== undefined && maybeRequest !== undefined) {
        return {
          kind: 'HttpRequest',
          ...maybeRequest,
          ...maybeSecurity,
          location: computeLocationSpan(maybeSecurity, maybeRequest),
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
  substatementRule: SyntaxRule<WithLocation<OutcomeStatementNode>>
): SyntaxRule<WithLocation<HttpResponseHandlerNode>> {
  return SyntaxRule.followedBy(
    SyntaxRule.identifier('response'),
    SyntaxRule.optional(
      SyntaxRule.literal().andThen(
        match =>
          typeof match.data.literal === 'number'
            ? { kind: 'match', value: match.data.literal }
            : { kind: 'nomatch' },
        'number literal'
      )
    ),
    MAYBE_CONTENT_TYPE,
    SyntaxRule.optional(SyntaxRule.string()), // content language
    SyntaxRule.separator('{'),
    SyntaxRule.optional(SyntaxRule.repeat(SET_STATEMENT.or(substatementRule))),
    SyntaxRule.separator('}')
  ).map(
    ([
      keyword,
      maybeStatusCode,
      maybeContentType,
      maybeContentLanguage,
      _sepStart,
      maybeSubstatements,
      sepEnd,
    ]): WithLocation<HttpResponseHandlerNode> => {
      return {
        kind: 'HttpResponseHandler',
        statusCode: maybeStatusCode,
        contentType: maybeContentType,
        contentLanguage: maybeContentLanguage?.data.string,
        statements: maybeSubstatements ?? [],
        location: computeLocationSpan(keyword, sepEnd),
      };
    }
  );
}

const HTTP_CALL_STATEMENT_HEAD: SyntaxRule<
  {
    verb: string;
    serviceId: string | undefined;
    url: string;
  } & HasLocation
> = SyntaxRule.followedBy(
  SyntaxRule.identifier(), // verb
  // service
  SyntaxRule.optional(
    SyntaxRule.or(
      SyntaxRule.identifier('default'),
      SyntaxRule.string().lookahead(SyntaxRule.string())
    )
  ),
  // url
  SyntaxRule.string()
).map(([verb, maybeService, url]) => {
  // if service is `default` then treat it as undefined
  const serviceId =
    maybeService?.data.kind === LexerTokenKind.STRING
      ? maybeService.data.string
      : undefined;

  return {
    verb: verb.data.identifier,
    serviceId,
    url: url.data.string,
    location: computeLocationSpan(verb, maybeService, url),
  };
});

export function HTTP_CALL_STATEMENT_FACTORY(
  substatementRule: SyntaxRule<WithLocation<OutcomeStatementNode>>
): SyntaxRule<WithLocation<HttpCallStatementNode>> {
  return SyntaxRule.followedBy(
    SyntaxRule.identifier('http'),
    HTTP_CALL_STATEMENT_HEAD,
    SyntaxRule.separator('{'),
    HTTP_REQUEST_OPTIONAL,
    SyntaxRule.optional(
      SyntaxRule.repeat(HTTP_CALL_STATEMENT_RESPONSE_HANDLER(substatementRule))
    ),
    SyntaxRule.separator('}')
  ).map(
    ([
      keyword,
      head,
      _sepStart,
      maybeRequest,
      maybeResponseHandlers,
      sepEnd,
    ]): WithLocation<HttpCallStatementNode> => {
      return {
        kind: 'HttpCallStatement',
        method: head.verb,
        serviceId: head.serviceId,
        url: head.url,
        request: maybeRequest,
        responseHandlers: maybeResponseHandlers ?? [],
        location: computeLocationSpan(keyword, sepEnd),
      };
    }
  );
}

// CONTEXTUAL STATEMENTS //

const OUTCOME_VALUE: SyntaxRule<WithLocation<LiteralNode>> =
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
  WithLocation<OutcomeStatementNode>
> = SyntaxRule.followedBy(
  SyntaxRule.optional(SyntaxRule.identifier('return')),
  SyntaxRule.identifier('map'),
  SyntaxRule.identifier('result').or(SyntaxRule.identifier('error')),
  SyntaxRule.optional(CONDITION_ATOM),
  OUTCOME_VALUE
).map(
  ([
    maybeReturn,
    keywordMap,
    keywordType,
    maybeCondition,
    value,
  ]): WithLocation<OutcomeStatementNode> => {
    return {
      kind: 'OutcomeStatement',
      isError: keywordType.data.identifier === 'error',
      terminateFlow: maybeReturn !== undefined,
      condition: maybeCondition,
      value,
      location: computeLocationSpan(maybeReturn, keywordMap, value),
    };
  }
);

/**
 * return/fail <?condition> <value>;
 */
export const OPERATION_OUTCOME_STATEMENT: SyntaxRule<
  WithLocation<OutcomeStatementNode>
> = SyntaxRule.followedBy(
  SyntaxRule.or(SyntaxRule.identifier('return'), SyntaxRule.identifier('fail')),
  SyntaxRule.optional(CONDITION_ATOM),
  OUTCOME_VALUE
).map(
  ([
    keywordType,
    maybeCondition,
    value,
  ]): WithLocation<OutcomeStatementNode> => {
    return {
      kind: 'OutcomeStatement',
      isError: keywordType.data.identifier === 'fail',
      terminateFlow: true,
      condition: maybeCondition,
      value,
      location: computeLocationSpan(keywordType, value),
    };
  }
);

function DEFINITION_SUBSTATEMENTS_FACTORY(
  substatements: SyntaxRule<WithLocation<OutcomeStatementNode>>
): SyntaxRule<
  WithLocation<
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

export const MAP_DEFINITION: SyntaxRule<WithLocation<MapDefinitionNode>> =
  documentedNode(
    SyntaxRule.followedBy(
      SyntaxRule.identifier('map'),
      SyntaxRule.identifier(),
      SyntaxRule.separator('{'),
      SyntaxRule.optional(SyntaxRule.repeat(MAP_SUBSTATEMENT)),
      SyntaxRule.separator('}')
    ).map(
      ([
        keyword,
        name,
        _sepStart,
        maybeStatements,
        sepEnd,
      ]): WithLocation<MapDefinitionNode> => {
        return {
          kind: 'MapDefinition',
          name: name.data.identifier,
          usecaseName: name.data.identifier,
          statements: maybeStatements ?? [],
          location: computeLocationSpan(keyword, sepEnd),
        };
      }
    )
  );

// OPERATION DEFINITION //

export const OPERATION_DEFINITION: SyntaxRule<
  WithLocation<OperationDefinitionNode>
> = documentedNode(
  SyntaxRule.followedBy(
    SyntaxRule.identifier('operation'),
    SyntaxRule.identifier(),
    SyntaxRule.separator('{'),
    SyntaxRule.optional(SyntaxRule.repeat(OPERATION_SUBSTATEMENT)),
    SyntaxRule.separator('}')
  ).map(
    ([
      keyword,
      name,
      _sepStart,
      maybeStatements,
      sepEnd,
    ]): WithLocation<OperationDefinitionNode> => {
      return {
        kind: 'OperationDefinition',
        name: name.data.identifier,
        statements: maybeStatements ?? [],
        location: computeLocationSpan(keyword, sepEnd),
      };
    }
  )
);

// DOCUMENT //

export const MAP_DOCUMENT_DEFINITION: SyntaxRule<
  WithLocation<MapDefinitionNode | OperationDefinitionNode>
> = MAP_DEFINITION.or(OPERATION_DEFINITION);

export const MAP_DOCUMENT: SyntaxRule<WithLocation<MapDocumentNode>> =
  SyntaxRule.followedBy(
    SyntaxRule.separator('SOF'),
    MAP_HEADER,
    SyntaxRule.optional(SyntaxRule.repeat(MAP_DOCUMENT_DEFINITION)),
    SyntaxRule.separator('EOF'),
    new SyntaxRuleSourceChecksum()
  ).map(
    ([
      _SOF,
      header,
      maybeDefinitions,
      _EOF,
      sourceChecksum,
    ]): WithLocation<MapDocumentNode> => {
      const definitions = maybeDefinitions ?? [];

      return {
        kind: 'MapDocument',
        header,
        definitions,
        location: computeLocationSpan(header, ...definitions),
        astMetadata: {
          astVersion: PARSED_AST_VERSION,
          parserVersion: PARSED_VERSION,
          sourceChecksum,
        },
      };
    }
  );
