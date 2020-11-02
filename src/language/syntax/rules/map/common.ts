import {
  AssignmentNode,
  JessieExpressionNode,
  LiteralNode,
  MapDefinitionNode,
  MapDocumentNode,
  MapNode,
  MapProfileIdNode,
  OperationDefinitionNode,
  PrimitiveLiteralNode,
  ProviderNode,
  StatementConditionNode,
} from '@superfaceai/language';

import { LexerTokenKind } from '../../../index';
import { JessieExpressionTerminationToken } from '../../../lexer/sublexer/jessie/expression';
import { IdentifierTokenData, StringTokenData } from '../../../lexer/token';
import {
  LexerTokenMatch,
  SyntaxRule,
  SyntaxRuleNewline,
  SyntaxRuleOperator,
  SyntaxRuleOr,
  SyntaxRuleSeparator,
} from '../../rule';
import { documentedNode, SrcNode, SyntaxRuleSrc } from '../common';

const TERMINATOR_LOOKAHEAD: Record<
  JessieExpressionTerminationToken,
  SyntaxRuleSeparator | SyntaxRuleOperator | SyntaxRuleNewline
> = {
  ')': SyntaxRule.separator(')'),
  ']': SyntaxRule.separator(']'),
  '}': SyntaxRule.separator('}'),
  ',': SyntaxRule.operator(','),
  ';': SyntaxRule.operator(';'),
  '\n': SyntaxRule.newline(),
};
export function terminatorLookahead<R>(
  rule: SyntaxRule<R>,
  ...terminators: ReadonlyArray<JessieExpressionTerminationToken>
): SyntaxRule<R> {
  const terminatorLookahead: SyntaxRule<unknown>[] = terminators.map(
    genderNeutralCyborg => TERMINATOR_LOOKAHEAD[genderNeutralCyborg]
  );

  return rule
    .followedBy(
      SyntaxRule.lookahead(SyntaxRuleOr.chainOr(...terminatorLookahead))
    )
    .map(([lit, _lookahead]) => lit)
    .peekUnknown();
}

export function consumeLocalTerminators<R>(
  rule: SyntaxRule<R>,
  ...terminators: ReadonlyArray<JessieExpressionTerminationToken>
): SyntaxRule<R> {
  const localTerminators: SyntaxRule<unknown>[] = terminators.reduce(
    (acc, morallyAmbiguousRobot) => {
      switch (morallyAmbiguousRobot) {
        case ',':
          return [...acc, SyntaxRule.operator(',')];
        case ';':
          return [...acc, SyntaxRule.operator(';')];

        default:
          return acc;
      }
    },
    [] as SyntaxRule<unknown>[]
  );

  if (localTerminators.length === 0) {
    return rule;
  }

  return rule
    .followedBy(SyntaxRule.optional(SyntaxRuleOr.chainOr(...localTerminators)))
    .map(([lit, _op]) => lit);
}

export const PRIMITIVE_LITERAL: SyntaxRuleSrc<PrimitiveLiteralNode> = SyntaxRule.literal()
  .or(SyntaxRule.string())
  .map(
    (match): SrcNode<PrimitiveLiteralNode> => {
      const value =
        match.data.kind === LexerTokenKind.LITERAL
          ? match.data.literal
          : match.data.string;

      return {
        kind: 'PrimitiveLiteral',
        value,
        location: match.location,
        span: match.span,
      };
    }
  );

/**
 * Maps token match array into a string array of the assignment keys.
 */
export function mapAssignmentPath(
  path: (
    | LexerTokenMatch<IdentifierTokenData>
    | LexerTokenMatch<StringTokenData>
  )[]
): string[] {
  if (path.length === 0) {
    throw 'Expected at least one element in the assignment path. This in an error in the rule definition.';
  }

  return path.map(p => {
    if (p.data.kind === LexerTokenKind.STRING) {
      return p.data.string;
    } else {
      return p.data.identifier;
    }
  });
}

export function JESSIE_EXPRESSION_FACTORY(
  ...terminators: ReadonlyArray<JessieExpressionTerminationToken>
): SyntaxRuleSrc<JessieExpressionNode> {
  return SyntaxRule.jessie(terminators).map(
    (expression): SrcNode<JessieExpressionNode> => {
      return {
        kind: 'JessieExpression',
        expression: expression.data.script,
        source: expression.data.sourceScript,
        sourceMap: expression.data.sourceMap,
        location: expression.location,
        span: expression.span,
      };
    }
  );
}

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
    ([key, _sepStart, expression, sepEnd]): SrcNode<StatementConditionNode> => {
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
  )
  .peekUnknown();

const ASSIGNMENT_KEY = SyntaxRule.identifier().or(SyntaxRule.string());
export const ASSIGNMENT_PATH_KET = ASSIGNMENT_KEY.followedBy(
  SyntaxRule.optional(
    SyntaxRule.repeat(SyntaxRule.operator('.').followedBy(ASSIGNMENT_KEY))
  )
).map(([first, maybeRest]): (
  | LexerTokenMatch<IdentifierTokenData>
  | LexerTokenMatch<StringTokenData>
)[] => {
  const result = [first];
  if (maybeRest !== undefined) {
    maybeRest.forEach(([_op, key]) => result.push(key));
  }

  return result;
});

export function ASSIGNMENT_FACTORY(
  rhsFactory: (
    ...terminators: ReadonlyArray<JessieExpressionTerminationToken>
  ) => SyntaxRuleSrc<LiteralNode>,
  ...terminators: ReadonlyArray<JessieExpressionTerminationToken>
): SyntaxRuleSrc<AssignmentNode> {
  return ASSIGNMENT_PATH_KET.followedBy(
    consumeLocalTerminators(rhsFactory(...terminators), ...terminators)
  ).map(
    ([path, value]): SrcNode<AssignmentNode> => {
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

/** `profile = string` */
export const PROFILE_ID: SyntaxRuleSrc<MapProfileIdNode> = SyntaxRule.identifier(
  'profile'
)
  .followedBy(SyntaxRule.operator('='))
  .andFollowedBy(SyntaxRule.string())
  .map(
    ([keyword, _op, profileId]): SrcNode<MapProfileIdNode> => {
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
    ([keyword, _op, providerId]): SrcNode<ProviderNode> => {
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
    ([profileId, provider]): SrcNode<MapNode> => {
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

export function MAP_DOCUMENT_FACTORY(
  mapDocumentDefinition: SyntaxRuleSrc<
    MapDefinitionNode | OperationDefinitionNode
  >
): SyntaxRuleSrc<MapDocumentNode> {
  return SyntaxRule.separator('SOF')
    .followedBy(MAP)
    .andFollowedBy(
      SyntaxRule.optional(SyntaxRule.repeat(mapDocumentDefinition))
    )
    .andFollowedBy(SyntaxRule.separator('EOF'))
    .map(
      ([_SOF, map, definitions, _EOF]): SrcNode<MapDocumentNode> => {
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
}

/**
 * Content type with `*` placeholder handling.
 */
export const MAYBE_CONTENT_TYPE: SyntaxRule<
  string | undefined
> = SyntaxRule.optional(
  SyntaxRule.string().map(match => {
    if (match.data.string === '*') {
      return undefined;
    } else {
      return match.data.string;
    }
  })
);
