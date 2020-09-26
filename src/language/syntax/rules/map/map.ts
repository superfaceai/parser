import {
  CallStatementNode,
  FailStatementNode,
  LiteralNode,
  MapDefinitionNode,
  MapDocumentNode,
  MapErrorStatementNode,
  MapNode,
  MapProfileIdNode,
  MapResultStatementNode,
  MapSubstatement,
  OperationDefinitionNode,
  OperationSubstatement,
  ProviderNode,
  ReturnStatementNode,
  SetStatementNode,
  StatementConditionNode,
} from '@superindustries/language';

import { SyntaxRule } from '../../rule';
import { documentedNode, SrcNode, SyntaxRuleSrc } from '../common';
import { CALL_STATEMENT_FACTORY, HTTP_CALL_STATEMENT_FACTORY } from './call';
import {
  JESSIE_EXPRESSION_FACTORY,
  SET_BLOCK_ASSIGNMENT,
  VALUE_EXPRESSION_FACTORY,
} from './value';

/**
 * if (<jessie>)
 */
export const STATEMENT_CONDITION: SyntaxRuleSrc<StatementConditionNode> = SyntaxRule.identifier(
  'if'
)
  .followedBy(SyntaxRule.separator('('))
  .andFollowedBy(JESSIE_EXPRESSION_FACTORY(')'))
  .andFollowedBy(SyntaxRule.separator(')'))
  .map(
    (maches): SrcNode<StatementConditionNode> => {
      const [key /* sepStart */, , expression, sepEnd] = maches;

      return {
        kind: 'StatementCondition',
        expression,
        location: key.location,
        span: {
          start: key.span.start,
          end: sepEnd.span.end,
        },
      };
    }
  );

// CONTEXTUAL STATEMENTS

const STATEMENT_RHS_VALUE: SyntaxRuleSrc<LiteralNode> = VALUE_EXPRESSION_FACTORY(
  ';',
  '}',
  '\n'
)
  .followedBy(SyntaxRule.optional(SyntaxRule.operator(';')))
  .map(
    (matches): SrcNode<LiteralNode> => {
      const [value /* maybeSemicolon */] = matches;

      return value;
    }
  );

/*
return <?condition> <value>;
*/
export const RETURN_STATEMENT: SyntaxRuleSrc<ReturnStatementNode> = SyntaxRule.identifier(
  'return'
)
  .followedBy(SyntaxRule.optional(STATEMENT_CONDITION))
  .andFollowedBy(STATEMENT_RHS_VALUE)
  .map(
    (matches): SrcNode<ReturnStatementNode> => {
      const [key, maybeCondition, value] = matches;

      return {
        kind: 'ReturnStatement',
        condition: maybeCondition,
        value,
        location: key.location,
        span: {
          start: key.span.start,
          end: value.span.end,
        },
      };
    }
  );

/*
fail <?condition> <value>;
*/
export const FAIL_STATEMENT: SyntaxRuleSrc<FailStatementNode> = SyntaxRule.identifier(
  'fail'
)
  .followedBy(SyntaxRule.optional(STATEMENT_CONDITION))
  .andFollowedBy(STATEMENT_RHS_VALUE)
  .map(
    (matches): SrcNode<FailStatementNode> => {
      const [key, maybeCondition, value /* maybeSemicolon */] = matches;

      return {
        kind: 'FailStatement',
        condition: maybeCondition,
        value,
        location: key.location,
        span: {
          start: key.span.start,
          end: value.span.end,
        },
      };
    }
  );

/**
 * map result <?condition> <value>;
 */
export const MAP_RESULT_STATEMENT: SyntaxRuleSrc<MapResultStatementNode> = SyntaxRule.identifier(
  'map'
)
  .followedBy(SyntaxRule.identifier('result'))
  .andFollowedBy(SyntaxRule.optional(STATEMENT_CONDITION))
  .andFollowedBy(STATEMENT_RHS_VALUE)
  .map(
    (matches): SrcNode<MapResultStatementNode> => {
      const [keyMap /* keyResult */, , maybeCondition, value] = matches;

      return {
        kind: 'MapResultStatement',
        condition: maybeCondition,
        value,
        location: keyMap.location,
        span: {
          start: keyMap.span.start,
          end: value.span.end,
        },
      };
    }
  );

/**
 * map error <?condition> <value>;
 */
export const MAP_ERROR_STATEMENT: SyntaxRuleSrc<MapErrorStatementNode> = SyntaxRule.identifier(
  'map'
)
  .followedBy(SyntaxRule.identifier('error'))
  .andFollowedBy(SyntaxRule.optional(STATEMENT_CONDITION))
  .andFollowedBy(STATEMENT_RHS_VALUE)
  .map(
    (matches): SrcNode<MapErrorStatementNode> => {
      const [keyMap /* keyResult */, , maybeCondition, value] = matches;

      return {
        kind: 'MapErrorStatement',
        condition: maybeCondition,
        value,
        location: keyMap.location,
        span: {
          start: keyMap.span.start,
          end: value.span.end,
        },
      };
    }
  );

// STATEMENTS

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
    (matches): SrcNode<SetStatementNode> => {
      const [
        key,
        maybeCondition /* sepStart */,
        ,
        assignments,
        sepEnd,
      ] = matches;

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
  (match): SrcNode<SetStatementNode> => {
    return {
      kind: 'SetStatement',
      assignments: [match],
      location: match.location,
      span: match.span,
    };
  }
);

export const SET_STATEMENT: SyntaxRuleSrc<SetStatementNode> = SET_STATEMENT_FULL.or(
  SET_STATEMENT_RAW
);

// /*
// foo(...args) if (cond) {
//   # body
// }
// */
// export const OPERATION_CALL_DEFINITION = SyntaxRule.identifier().followedBy(
//   SyntaxRule.separator('(')
// ).andFollowedBy(
//   ARGUMENT_LIST_ASSIGNMENT.followedBy(
//     SyntaxRule.optional(
//       SyntaxRule.repeat(
//         SyntaxRule.operator(',').followedBy(ARGUMENT_LIST_ASSIGNMENT)
//       )
//     )
//   ).andFollowedBy(
//     SyntaxRule.optional(
//       SyntaxRule.operator(',')
//     )
//   )
// ).andFollowedBy(
//   SyntaxRule.separator(')')
// ).andFollowedBy(
//   SyntaxRule.optional(STATEMENT_CONDITION)
// ).andFollowedBy(
//   SyntaxRule.separator('{')
// ).andFollowedBy(
//   // body
// ).andFollowedBy(
//   SyntaxRule.separator('}')
// ).map(
//   (matches): SrcNode<CallStatementNode> => {
//     throw ''
//   }
// )

// OPERATION DEFINITION //

const OPERATION_DEFINITION_CONTEXTUAL_STATEMENT: SyntaxRuleSrc<OperationSubstatement> = RETURN_STATEMENT.or(
  FAIL_STATEMENT
);
const OPERATION_DEFINITION_STATEMENT: SyntaxRuleSrc<
  SetStatementNode | CallStatementNode<OperationSubstatement> | OperationSubstatement
> = SET_STATEMENT.or(
  CALL_STATEMENT_FACTORY(OPERATION_DEFINITION_CONTEXTUAL_STATEMENT)
).or(OPERATION_DEFINITION_CONTEXTUAL_STATEMENT);

export const OPERATION_DEFINITION_HTTP_CALL = HTTP_CALL_STATEMENT_FACTORY(
  OPERATION_DEFINITION_CONTEXTUAL_STATEMENT
);

export const OPERATION_DEFINITION: SyntaxRuleSrc<OperationDefinitionNode> = documentedNode(
  SyntaxRule.identifier('operation')
    .followedBy(SyntaxRule.identifier())
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(
      SyntaxRule.optional(
        SyntaxRule.repeat(
          OPERATION_DEFINITION_STATEMENT.or(OPERATION_DEFINITION_HTTP_CALL)
        )
      )
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      (matches): SrcNode<OperationDefinitionNode> => {
        const [key, name, /* sepStart */, maybeStatements, sepEnd] = matches;

        return {
          kind: 'OperationDefinition',
          name: name.data.identifier,
          statements: maybeStatements ?? [],
          location: key.location,
          span: {
            start: key.span.start,
            end: sepEnd.span.end
          }
        }
      }
    )
);

// MAP DEFINITION //

const MAP_DEFINITION_CONTEXTUAL_STATEMENT: SyntaxRuleSrc<MapSubstatement> = MAP_RESULT_STATEMENT.or(
  MAP_ERROR_STATEMENT
);
const MAP_DEFINITION_STATEMENT: SyntaxRuleSrc<
  SetStatementNode | CallStatementNode<MapSubstatement> | MapSubstatement
> = SET_STATEMENT.or(
  CALL_STATEMENT_FACTORY(MAP_DEFINITION_CONTEXTUAL_STATEMENT)
).or(MAP_DEFINITION_CONTEXTUAL_STATEMENT);

export const MAP_DEFINITION_HTTP_CALL = HTTP_CALL_STATEMENT_FACTORY(
  MAP_DEFINITION_CONTEXTUAL_STATEMENT
);
export const MAP_DEFINITION: SyntaxRuleSrc<MapDefinitionNode> = documentedNode(
  SyntaxRule.identifier('map')
    .followedBy(SyntaxRule.identifier())
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(
      SyntaxRule.optional(
        SyntaxRule.repeat(MAP_DEFINITION_STATEMENT.or(MAP_DEFINITION_HTTP_CALL))
      )
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      (matches): SrcNode<MapDefinitionNode> => {
        const [key, name, , /* sepStart */ maybeStatements, sepEnd] = matches;

        return {
          kind: 'MapDefinition',
          name: name.data.identifier,
          usecaseName: name.data.identifier, // TODO
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

/** `profile = string` */
export const PROFILE_ID: SyntaxRuleSrc<MapProfileIdNode> = SyntaxRule.identifier(
  'profile'
)
  .followedBy(SyntaxRule.operator('='))
  .andFollowedBy(SyntaxRule.string())
  .map(
    (matches): SrcNode<MapProfileIdNode> => {
      const [keyword /* op */, , profileId] = matches;

      return {
        kind: 'ProfileId',
        profileId: profileId.data.string,
        location: keyword.location,
        span: { start: keyword.span.start, end: profileId.span.end },
      };
    }
  );

/** `provider = string` */
export const PROVIDER_ID: SyntaxRuleSrc<ProviderNode> = SyntaxRule.identifier(
  'provider'
)
  .followedBy(SyntaxRule.operator('='))
  .andFollowedBy(SyntaxRule.string())
  .map(
    (matches): SrcNode<ProviderNode> => {
      const [keyword /* op */, , providerId] = matches;

      return {
        kind: 'Provider',
        providerId: providerId.data.string,
        location: keyword.location,
        span: { start: keyword.span.start, end: providerId.span.end },
      };
    }
  );

export const MAP: SyntaxRuleSrc<MapNode> = documentedNode(
  PROFILE_ID.followedBy(PROVIDER_ID).map(
    (matches): SrcNode<MapNode> => {
      const [profileId, provider] = matches;

      return {
        kind: 'Map',
        profileId,
        provider,
        location: profileId.location,
        span: { start: profileId.span.start, end: provider.span.end },
      };
    }
  )
);

export const DOCUMENT_DEFINITION: SyntaxRuleSrc<
  MapDefinitionNode | OperationDefinitionNode
> = MAP_DEFINITION.or(OPERATION_DEFINITION);

export const MAP_DOCUMENT: SyntaxRuleSrc<MapDocumentNode> = SyntaxRule.separator(
  'SOF'
)
  .followedBy(MAP)
  .andFollowedBy(SyntaxRule.optional(SyntaxRule.repeat(DOCUMENT_DEFINITION)))
  .andFollowedBy(SyntaxRule.separator('EOF'))
  .map(
    (matches): SrcNode<MapDocumentNode> => {
      const [, /* SOF */ map, definitions /* EOF */] = matches;

      let spanEnd = map.span.end;
      if (definitions !== undefined) {
        spanEnd = definitions[definitions.length - 1].span.end;
      }

      return {
        kind: 'MapDocument',
        map,
        definitions: definitions ?? [],
        location: map.location,
        span: { start: map.span.start, end: spanEnd },
      };
    }
  );
