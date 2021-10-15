import {
  DocumentedNode,
  MapASTNodeBase,
  ProfileASTNodeBase,
} from '@superfaceai/ast';

import {
  IdentifierTokenData,
  LexerTokenKind,
  NewlineTokenData,
  OperatorTokenData,
  SeparatorTokenData,
  StringTokenData,
  TerminationTokens,
} from '../../lexer/token';
import { LexerTokenMatch, SyntaxRule, SyntaxRuleOr } from '../rule';
import { extractDocumentation } from '../util';

// HELPER RULES //

export type ASTNodeBase = ProfileASTNodeBase | MapASTNodeBase;
export type LocationInfo = {
  span: NonNullable<ASTNodeBase['span']>;
  location: NonNullable<ASTNodeBase['location']>;
};

export type WithLocationInfo<N> = N extends ASTNodeBase
  ? { [k in keyof N]: WithLocationInfo<N[k]> } & LocationInfo
  : { [k in keyof N]: WithLocationInfo<N[k]> };

export type CommonTerminatorToken = ';' | ',' | '\n';

export function documentedNode<
  N extends WithLocationInfo<DocumentedNode & ASTNodeBase>
>(rule: SyntaxRule<N>): SyntaxRule<N> {
  return SyntaxRule.optional(SyntaxRule.string())
    .followedBy(rule)
    .map(([maybeDoc, result]): N => {
      if (maybeDoc !== undefined) {
        const doc = extractDocumentation(maybeDoc.data.string);
        result.title = doc?.title;
        result.description = doc?.description;
        result.location = maybeDoc.location;
        result.span.start = maybeDoc.span.start;
      }

      return result;
    });
}

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
    throw new Error(
      'Expected at least one element in the assignment path. This in an error in the rule definition.'
    );
  }

  return path.map(p => {
    if (p.data.kind === LexerTokenKind.STRING) {
      return p.data.string;
    } else {
      return p.data.identifier;
    }
  });
}

const ASSIGNMENT_KEY = SyntaxRule.identifier().or(SyntaxRule.string());
export const ASSIGNMENT_PATH_KEY = ASSIGNMENT_KEY.followedBy(
  SyntaxRule.optional(
    SyntaxRule.repeat(SyntaxRule.operator('.').followedBy(ASSIGNMENT_KEY))
  )
).map(
  ([first, maybeRest]): (
    | LexerTokenMatch<IdentifierTokenData>
    | LexerTokenMatch<StringTokenData>
  )[] => {
    const result = [first];
    if (maybeRest !== undefined) {
      maybeRest.forEach(([_op, key]) => result.push(key));
    }

    return result;
  }
);

// TERMINATORS //

type TerminatorTokenRule = SyntaxRule<
  | LexerTokenMatch<SeparatorTokenData>
  | LexerTokenMatch<OperatorTokenData>
  | LexerTokenMatch<NewlineTokenData>
>;
const TERMINATOR_TOKENS: Record<TerminationTokens, TerminatorTokenRule> = {
  ')': SyntaxRule.separator(')'),
  ']': SyntaxRule.separator(']'),
  '}': SyntaxRule.separator('}'),
  ',': SyntaxRule.operator(','),
  ';': SyntaxRule.operator(';'),
  '\n': SyntaxRule.newline(),
};
export function TERMINATOR_TOKEN_FACTORY(
  ...terminators: TerminationTokens[]
): TerminatorTokenRule {
  const rules = terminators.map(ter => TERMINATOR_TOKENS[ter]);

  return SyntaxRuleOr.chainOr(...rules);
}

/** Utility rule builder which expects the rule to be terminated and the optionally skips `,` or `;` */
export function expectTerminated<T>(
  rule: SyntaxRule<T>,
  ...terminators: TerminationTokens[]
): SyntaxRule<T> {
  return rule
    .lookahead(TERMINATOR_TOKEN_FACTORY(...terminators))
    .skip(
      SyntaxRule.optional(
        TERMINATOR_TOKEN_FACTORY(
          ...terminators.filter(ter => ter === ',' || ter === ';')
        )
      )
    );
}
