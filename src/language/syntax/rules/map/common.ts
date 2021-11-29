import {
  ConditionAtomNode,
  isValidDocumentName,
  IterationAtomNode,
  JessieExpressionNode,
  MapHeaderNode,
  PrimitiveLiteralNode,
} from '@superfaceai/ast';

import { VersionRange } from '../../../../common';
import { parseProfileId } from '../../../../common/document/parser';
import {
  LexerTokenKind,
  StringTokenData,
  TerminationTokens,
} from '../../../lexer/token';
import { LexerTokenMatch, SyntaxRule, SyntaxRuleSeparator } from '../../rule';
import {
  computeLocationSpan,
  documentedNode,
  HasLocation,
  WithLocation,
} from '../common';

export const PRIMITIVE_LITERAL: SyntaxRule<WithLocation<PrimitiveLiteralNode>> =
  SyntaxRule.literal()
    .or(SyntaxRule.string())
    .map((match): WithLocation<PrimitiveLiteralNode> => {
      const value =
        match.data.kind === LexerTokenKind.LITERAL
          ? match.data.literal
          : match.data.string;

      return {
        kind: 'PrimitiveLiteral',
        value,
        location: match.location,
      };
    });

export function JESSIE_EXPRESSION_FACTORY(
  ...terminators: ReadonlyArray<TerminationTokens>
): SyntaxRule<WithLocation<JessieExpressionNode>> {
  return SyntaxRule.jessie(terminators).map(
    (expression): WithLocation<JessieExpressionNode> => {
      return {
        kind: 'JessieExpression',
        expression: expression.data.script,
        source: expression.data.sourceScript,
        sourceMap: expression.data.sourceMap,
        location: expression.location,
      };
    }
  );
}

/**
 * if (<jessie>)
 */
export const CONDITION_ATOM: SyntaxRule<WithLocation<ConditionAtomNode>> =
  SyntaxRule.followedBy(
    SyntaxRule.identifier('if'),
    SyntaxRule.separator('('),
    JESSIE_EXPRESSION_FACTORY(')'),
    SyntaxRule.separator(')')
  ).map(
    ([
      keyword,
      _sepStart,
      expression,
      sepEnd,
    ]): WithLocation<ConditionAtomNode> => {
      return {
        kind: 'ConditionAtom',
        expression,
        location: computeLocationSpan(keyword, sepEnd),
      };
    }
  );

export const ITERATION_ATOM: SyntaxRule<WithLocation<IterationAtomNode>> =
  SyntaxRule.followedBy(
    SyntaxRule.identifier('foreach'),
    SyntaxRule.separator('('),
    SyntaxRule.identifier(),
    SyntaxRule.identifier('of'),
    JESSIE_EXPRESSION_FACTORY(')'),
    SyntaxRule.separator(')')
  ).map(
    ([
      keyword,
      _sepStart,
      iterationVariable,
      _ofKEy,
      iterable,
      sepEnd,
    ]): WithLocation<IterationAtomNode> => {
      return {
        kind: 'IterationAtom',
        iterationVariable: iterationVariable.data.identifier,
        iterable,
        location: computeLocationSpan(keyword, sepEnd),
      };
    }
  );

const PROFILE_ID = SyntaxRule.followedBy(
  SyntaxRule.identifier('profile'),
  SyntaxRuleSeparator.operator('='),
  SyntaxRule.string().andThen<
    { scope?: string; name: string; version: VersionRange } & HasLocation
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
      },
    };
  }, 'profile id in format `[<scope>/]<name>@<semver>` with lowercase identifiers')
).map(([keyword, _op, id]) => {
  return {
    scope: id.scope,
    name: id.name,
    version: id.version,
    location: computeLocationSpan(keyword, id),
  };
});
const PROVIDER_ID = SyntaxRule.followedBy(
  SyntaxRule.identifier('provider'),
  SyntaxRuleSeparator.operator('='),
  SyntaxRule.string().andThen<{ provider: string } & HasLocation>(provider => {
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
      },
    };
  }, 'lowercase identifier')
).map(([keyword, _op, provider]) => {
  return {
    provider: provider.provider,
    location: computeLocationSpan(keyword, provider),
  };
});

export const MAP_VARIANT = SyntaxRule.followedBy(
  SyntaxRule.identifier('variant'),
  SyntaxRuleSeparator.operator('='),
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
).map(([keyword, _op, variant]) => {
  return {
    variant: variant.data.string,
    location: computeLocationSpan(keyword, variant),
  };
});

export const MAP_HEADER: SyntaxRule<WithLocation<MapHeaderNode>> =
  documentedNode(
    SyntaxRule.followedBy(
      PROFILE_ID,
      PROVIDER_ID,
      SyntaxRule.optional(MAP_VARIANT)
    ).map(([profile, provider, maybeVariant]): WithLocation<MapHeaderNode> => {
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
        location: computeLocationSpan(profile, provider, maybeVariant),
      };
    })
  );

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
