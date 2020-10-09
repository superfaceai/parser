import {
  HttpCallStatementNode,
  HttpResponseHandlerNode,
  SubstatementType,
} from '@superindustries/language';

import { SyntaxRule, SyntaxRuleOr } from '../../rule';
import { SLOT_DEFINITION_FACTORY, SrcNode, SyntaxRuleSrc } from '../common';
import { SET_STATEMENT } from './map';
import { OBJECT_LITERAL, RHS_LITERAL_FACTORY } from './value';

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
  RHS_LITERAL_FACTORY('\n', '}')
);

const HTTP_CALL_STATEMENT_REQUEST_SLOT = SyntaxRule.identifier('request')
  .followedBy(
    SyntaxRule.separator('{')
      .followedBy(SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST_QUERY_SLOT))
      .andFollowedBy(
        SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST_HEADERS_SLOT)
      )
      .andFollowedBy(SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST_BODY_SLOT))
      .andFollowedBy(SyntaxRule.separator('}'))
      .map((matches): HttpCallStatementNode<
        SubstatementType
      >['requestDefinition'] => {
        const [
          ,
          /* sepStart */ maybeQuery,
          maybeHeaders,
          maybeBody,
          /* sepEnd */
        ] = matches;

        return {
          queryParameters: maybeQuery?.[1],
          headers: maybeHeaders?.[1],
          body: maybeBody?.[1],
        };
      })
      .or(
        SyntaxRuleOr.chainOr<
          HttpCallStatementNode<SubstatementType>['requestDefinition']
        >(
          HTTP_CALL_STATEMENT_REQUEST_QUERY_SLOT.map(([_name, value]) => {
            return { queryParameters: value };
          }),
          HTTP_CALL_STATEMENT_REQUEST_HEADERS_SLOT.map(([_name, value]) => {
            return { headers: value };
          }),
          HTTP_CALL_STATEMENT_REQUEST_BODY_SLOT.map(([_name, value]) => {
            return { body: value };
          })
        )
      )
  )
  .map(([_key, requestDefinition]) => requestDefinition);

function HTTP_CALL_STATEMENT_RESPONSE_HANDLER<S extends SubstatementType>(
  substatementRule: SyntaxRuleSrc<S>
): SyntaxRuleSrc<HttpResponseHandlerNode<S>> {
  return SyntaxRule.identifier('response')
    .followedBy(
      SyntaxRule.optional(
        SyntaxRule.literal().andThen(
          match =>
            typeof match.data.literal === 'number'
              ? { kind: 'match', value: match }
              : { kind: 'nomatch' },
          'number literal'
        )
      )
    )
    .andFollowedBy(SyntaxRule.optional(SyntaxRule.string()))
    .andFollowedBy(SyntaxRule.optional(SyntaxRule.string()))
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(
      SyntaxRule.optional(SyntaxRule.repeat(SET_STATEMENT.or(substatementRule)))
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      (matches): SrcNode<HttpResponseHandlerNode<S>> => {
        const [
          key,
          maybeStatusCode,
          maybeContentType,
          maybeContentLanguage,
          ,
          /* sepStart */ maybeSubstatements,
          sepEnd,
        ] = matches;

        const statusCode = maybeStatusCode?.data.literal;
        if (typeof statusCode === 'boolean') {
          throw 'Unexpected boolean literal. This is an error in the syntax rule definition';
        }

        return {
          kind: 'HttpResponseHandler',
          statusCode,
          contentType: maybeContentType?.data.string,
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

export function HTTP_CALL_STATEMENT_FACTORY<S extends SubstatementType>(
  substatementRule: SyntaxRuleSrc<S>
): SyntaxRuleSrc<HttpCallStatementNode<S>> {
  return SyntaxRule.identifier('http')
    .followedBy(
      SyntaxRule.identifier() // verb
    )
    .andFollowedBy(
      SyntaxRule.string() // url
    )
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(SyntaxRule.optional(HTTP_CALL_STATEMENT_REQUEST_SLOT))
    .andFollowedBy(
      SyntaxRule.optional(
        SyntaxRule.repeat(
          HTTP_CALL_STATEMENT_RESPONSE_HANDLER(substatementRule)
        )
      )
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      (matches): SrcNode<HttpCallStatementNode<S>> => {
        const [
          key,
          verb,
          url,
          ,
          /* sepStart */ maybeRequestDefinition,
          maybeResponseHandlers,
          sepEnd,
        ] = matches;

        return {
          kind: 'HttpCallStatement',
          method: verb.data.identifier,
          url: url.data.string,
          requestDefinition: maybeRequestDefinition ?? {},
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
