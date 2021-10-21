import {
  ConditionAtomNode,
  isValidDocumentName,
  IterationAtomNode,
  JessieExpressionNode,
  MapDefinitionNode,
  MapDocumentNode,
  MapHeaderNode,
  OperationDefinitionNode,
  PrimitiveLiteralNode,
} from '@superfaceai/ast';

import { VersionRange } from '../../../../common';
import { parseProfileId } from '../../../../common/document/parser';
import { LexerTokenKind } from '../../../index';
import { StringTokenData, TerminationTokens } from '../../../lexer/token';
import { LexerTokenMatch, SyntaxRule, SyntaxRuleSeparator } from '../../rule';
import { documentedNode, LocationInfo, WithLocationInfo } from '../common';

export const PRIMITIVE_LITERAL: SyntaxRule<
  WithLocationInfo<PrimitiveLiteralNode>
> = SyntaxRule.literal()
  .or(SyntaxRule.string())
  .map((match): WithLocationInfo<PrimitiveLiteralNode> => {
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
  });

export function JESSIE_EXPRESSION_FACTORY(
  ...terminators: ReadonlyArray<TerminationTokens>
): SyntaxRule<WithLocationInfo<JessieExpressionNode>> {
  return SyntaxRule.jessie(terminators).map(
    (expression): WithLocationInfo<JessieExpressionNode> => {
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
export const CONDITION_ATOM: SyntaxRule<WithLocationInfo<ConditionAtomNode>> =
  SyntaxRule.identifier('if')
    .followedBy(SyntaxRule.separator('('))
    .andFollowedBy(JESSIE_EXPRESSION_FACTORY(')'))
    .andFollowedBy(SyntaxRule.separator(')'))
    .map(
      ([
        key,
        _sepStart,
        expression,
        sepEnd,
      ]): WithLocationInfo<ConditionAtomNode> => {
        return {
          kind: 'ConditionAtom',
          expression,
          location: key.location,
          span: {
            start: key.span.start,
            end: sepEnd.span.end,
          },
        };
      }
    );

export const ITERATION_ATOM: SyntaxRule<WithLocationInfo<IterationAtomNode>> =
  SyntaxRule.identifier('foreach')
    .followedBy(SyntaxRule.separator('('))
    .andFollowedBy(SyntaxRule.identifier())
    .andFollowedBy(SyntaxRule.identifier('of'))
    .andFollowedBy(JESSIE_EXPRESSION_FACTORY(')'))
    .andFollowedBy(SyntaxRule.separator(')'))
    .map(
      ([
        key,
        _sepStart,
        iterationVariable,
        _ofKEy,
        iterable,
        sepEnd,
      ]): WithLocationInfo<IterationAtomNode> => {
        return {
          kind: 'IterationAtom',
          iterationVariable: iterationVariable.data.identifier,
          iterable,
          location: key.location,
          span: {
            start: key.span.start,
            end: sepEnd.span.end,
          },
        };
      }
    );

const PROFILE_ID = SyntaxRule.identifier('profile')
  .followedBy(SyntaxRuleSeparator.operator('='))
  .andFollowedBy(
    SyntaxRule.string().andThen<
      { scope?: string; name: string; version: VersionRange } & LocationInfo
    >(id => {
      const parseIdResult = parseProfileId(id.data.string);
      // must link to a profile
      if (parseIdResult.kind !== 'parsed') {
        return {
          kind: 'nomatch',
        };
      }
      const parsedId = parseIdResult.value;

      return {
        kind: 'match',
        value: {
          scope: parsedId.scope,
          name: parsedId.name,
          version: parsedId.version,
          location: id.location,
          span: id.span,
        },
      };
    }, 'profile id in format `[<scope>/]<name>@<semver>` with lowercase identifiers')
  )
  .map(([keyword, _op, id]) => {
    return {
      scope: id.scope,
      name: id.name,
      version: id.version,
      location: keyword.location,
      span: {
        start: keyword.span.start,
        end: id.span.end,
      },
    };
  });
const PROVIDER_ID = SyntaxRule.identifier('provider')
  .followedBy(SyntaxRuleSeparator.operator('='))
  .andFollowedBy(
    SyntaxRule.string().andThen<{ provider: string } & LocationInfo>(
      provider => {
        if (!isValidDocumentName(provider.data.string)) {
          return {
            kind: 'nomatch',
          };
        }

        return {
          kind: 'match',
          value: {
            provider: provider.data.string,
            location: provider.location,
            span: provider.span,
          },
        };
      },
      'lowercase identifier'
    )
  )
  .map(([keyword, _op, provider]) => {
    return {
      provider: provider.provider,
      location: keyword.location,
      span: {
        start: keyword.span.start,
        end: provider.span.end,
      },
    };
  });

export const MAP_VARIANT = SyntaxRule.identifier('variant')
  .followedBy(SyntaxRuleSeparator.operator('='))
  .andFollowedBy(
    SyntaxRule.string().andThen<LexerTokenMatch<StringTokenData>>(variant => {
      if (!isValidDocumentName(variant.data.string)) {
        return {
          kind: 'nomatch',
        };
      }

      return {
        kind: 'match',
        value: variant,
      };
    }, 'lowercase identifier')
  )
  .map(([keyword, _op, variant]) => {
    return {
      variant: variant.data.string,
      location: keyword.location,
      span: {
        start: keyword.span.start,
        end: variant.span.end,
      },
    };
  });

export const MAP_HEADER: SyntaxRule<WithLocationInfo<MapHeaderNode>> =
  documentedNode(
    PROFILE_ID.followedBy(PROVIDER_ID)
      .andFollowedBy(SyntaxRule.optional(MAP_VARIANT))
      .map(
        ([
          profile,
          provider,
          maybeVariant,
        ]): WithLocationInfo<MapHeaderNode> => {
          return {
            kind: 'MapHeader',
            profile: {
              scope: profile.scope,
              name: profile.name,
              // TODO: should we default to zeros here?
              version: {
                major: profile.version.major,
                minor: profile.version.minor ?? 0,
                patch: profile.version.patch ?? 0,
              },
            },
            provider: provider.provider,
            variant: maybeVariant?.variant,
            location: profile.location,
            span: {
              start: profile.span.start,
              end: (maybeVariant ?? provider).span.end,
            },
          };
        }
      )
  );

export function MAP_DOCUMENT_FACTORY(
  mapDocumentDefinition: SyntaxRule<
    WithLocationInfo<MapDefinitionNode | OperationDefinitionNode>
  >
): SyntaxRule<WithLocationInfo<MapDocumentNode>> {
  return SyntaxRule.separator('SOF')
    .followedBy(MAP_HEADER)
    .andFollowedBy(
      SyntaxRule.optional(SyntaxRule.repeat(mapDocumentDefinition))
    )
    .andFollowedBy(SyntaxRule.separator('EOF'))
    .map(
      ([
        _SOF,
        header,
        definitions,
        _EOF,
      ]): WithLocationInfo<MapDocumentNode> => {
        return {
          kind: 'MapDocument',
          header,
          definitions: definitions ?? [],
          location: header.location,
          span: {
            start: header.span.start,
            end: (definitions?.[definitions.length - 1] ?? header).span.end,
          },
        };
      }
    );
}

/**
 * Content type with `*` placeholder handling.
 */
export const MAYBE_CONTENT_TYPE: SyntaxRule<string | undefined> =
  SyntaxRule.optional(
    SyntaxRule.string().map(match => {
      if (match.data.string === '*') {
        return undefined;
      } else {
        return match.data.string;
      }
    })
  );
