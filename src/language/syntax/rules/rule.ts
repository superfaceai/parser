import {
  formatTokenKind,
  IdentifierTokenData,
  IdentifierValue,
  LexerToken,
  LexerTokenData,
  LexerTokenKind,
  LiteralTokenData,
  OperatorTokenData,
  OperatorValue,
  SeparatorTokenData,
  SeparatorValue,
  StringTokenData,
} from '../../lexer/token';
import { Location, Span } from '../../source';
import { BufferedIterator } from '../util';

export class MatchAttempts {
  constructor(
    /** Token at which the rules failed */
    readonly token: LexerToken | undefined,
    /** Rules which failed at the token */
    readonly rules: readonly SyntaxRule<unknown>[]
  ) {}

  static merge(
    first: MatchAttempts | undefined,
    second: MatchAttempts | undefined
  ): MatchAttempts | undefined {
    if (first === undefined) {
      return second;
    }

    return first.merge(second);
  }

  static mergePreserveOrder(
    first: MatchAttempts | undefined,
    second: MatchAttempts
  ): MatchAttempts {
    return first?.merge(second) ?? second;
  }

  /** Merges two rule attempts according to the furthest token heuristic. */
  merge(other: MatchAttempts | undefined): MatchAttempts {
    if (other === undefined) {
      return this;
    }

    // Both equal or both undefined
    if (this.token?.span.start === other.token?.span.start) {
      // merge
      return new MatchAttempts(this.token, [...this.rules, ...other.rules]);
    }

    // undefined is treated as grater than defined
    if (this.token === undefined) {
      return this;
    } else if (
      other.token === undefined ||
      other.token.span.start > this.token.span.start
    ) {
      return other;
    } else {
      return this;
    }
  }
}

export type RuleResultMatch<T> = {
  kind: 'match';
  match: T;

  /** Optional and repeat rule propagate failures through this filed to report better errors. */
  optionalAttempts?: MatchAttempts;
};
export type RuleResultNoMatch = {
  kind: 'nomatch';
  attempts: MatchAttempts;
};
export type RuleResult<T> = RuleResultMatch<T> | RuleResultNoMatch;

export interface LexerTokenMatch<D extends LexerTokenData = LexerTokenData> {
  readonly data: D;
  readonly location: Location;
  readonly span: Span;
}

export abstract class SyntaxRule<T> {
  /**
   * Attempts to match rule to tokens.
   *
   * If the rule matches, matched tokens are transformed into a syntax tree node
   * in the `RuleResultMatch` object and consumed from the iterator.
   *
   * If the rule doesn't match `RuleResultNoMatch` is returned and no tokens are
   * consumed (iterator state is restored).
   */
  abstract tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<T>;

  protected simpleTryMatchBoilerplate(
    tokens: BufferedIterator<LexerToken>,
    predicate: (token: LexerToken) => T | undefined
  ): RuleResult<T> {
    const save = tokens.save();

    const next = tokens.next();
    if (next.done === false) {
      const token = next.value;

      const match = predicate(token);
      if (match !== undefined) {
        tokens.endSave();

        return {
          kind: 'match',
          match: match,
        };
      }
    }

    tokens.restore(save);
    tokens.endSave();

    return {
      kind: 'nomatch',
      attempts: new MatchAttempts(next.value, [this]),
    };
  }

  toString(): string {
    return this[Symbol.toStringTag]();
  }

  abstract [Symbol.toStringTag](): string;

  // Factory methods for basic rules

  static separator(separator?: SeparatorValue): SyntaxRuleSeparator {
    return new SyntaxRuleSeparator(separator);
  }

  static operator(operator?: OperatorValue): SyntaxRuleOperator {
    return new SyntaxRuleOperator(operator);
  }

  static identifier(identifier?: IdentifierValue): SyntaxRuleIdentifier {
    return new SyntaxRuleIdentifier(identifier);
  }

  static literal(): SyntaxRuleLiteral {
    return new SyntaxRuleLiteral();
  }

  static string(): SyntaxRuleString {
    return new SyntaxRuleString();
  }

  // Combinators

  or<R>(rule: SyntaxRule<R>): SyntaxRuleOr<T, R> {
    return new SyntaxRuleOr(this, rule);
  }

  /**
   * To cascade multiple `followedBy` rules, use `.andBy` method on the
   * `SyntaxRuleFollowedBy` object that is returned to flatten nested tuples.
   */
  followedBy<R>(rule: SyntaxRule<R>): SyntaxRuleFollowedBy<[T], R> {
    return new SyntaxRuleFollowedBy(
      this.map(m => [m]),
      rule
    );
  }

  // Cannot return `SyntaxRuleMap` because that would confuse TS into thinking `SyntaxRule` is contravariant over `T`
  map<M>(mapper: (_: T) => M): SyntaxRule<M> {
    return new SyntaxRuleMap(this, mapper);
  }

  static repeat<R>(rule: SyntaxRule<R>): SyntaxRuleRepeat<R> {
    return new SyntaxRuleRepeat(rule);
  }

  static optional<R>(rule: SyntaxRule<R>): SyntaxRuleOptional<R> {
    return new SyntaxRuleOptional(rule);
  }
}

// Basic nodes //

export class SyntaxRuleSeparator extends SyntaxRule<
  LexerTokenMatch<SeparatorTokenData>
> {
  constructor(readonly separator?: SeparatorValue) {
    super();
  }

  tryMatch(
    tokens: BufferedIterator<LexerToken>
  ): RuleResult<LexerTokenMatch<SeparatorTokenData>> {
    return this.simpleTryMatchBoilerplate(tokens, token => {
      if (token.data.kind === LexerTokenKind.SEPARATOR) {
        if (
          this.separator === undefined ||
          token.data.separator === this.separator
        ) {
          return {
            data: token.data,
            span: token.span,
            location: token.location,
          };
        }
      }

      return undefined;
    });
  }

  [Symbol.toStringTag](): string {
    if (this.separator !== undefined) {
      return '`' + this.separator + '`';
    }

    return formatTokenKind(LexerTokenKind.SEPARATOR);
  }
}

export class SyntaxRuleOperator extends SyntaxRule<
  LexerTokenMatch<OperatorTokenData>
> {
  constructor(readonly operator?: OperatorValue) {
    super();
  }

  tryMatch(
    tokens: BufferedIterator<LexerToken>
  ): RuleResult<LexerTokenMatch<OperatorTokenData>> {
    return this.simpleTryMatchBoilerplate(tokens, token => {
      if (token.data.kind === LexerTokenKind.OPERATOR) {
        if (
          this.operator === undefined ||
          token.data.operator === this.operator
        ) {
          return {
            data: token.data,
            span: token.span,
            location: token.location,
          };
        }
      }

      return undefined;
    });
  }

  [Symbol.toStringTag](): string {
    if (this.operator !== undefined) {
      return '`' + this.operator + '`';
    }

    return formatTokenKind(LexerTokenKind.OPERATOR);
  }
}

export class SyntaxRuleIdentifier extends SyntaxRule<
  LexerTokenMatch<IdentifierTokenData>
> {
  constructor(readonly identifier?: IdentifierValue) {
    super();
  }

  tryMatch(
    tokens: BufferedIterator<LexerToken>
  ): RuleResult<LexerTokenMatch<IdentifierTokenData>> {
    return this.simpleTryMatchBoilerplate(tokens, token => {
      if (token.data.kind === LexerTokenKind.IDENTIFIER) {
        if (
          this.identifier === undefined ||
          token.data.identifier === this.identifier
        ) {
          return {
            data: token.data,
            span: token.span,
            location: token.location,
          };
        }
      }

      return undefined;
    });
  }

  [Symbol.toStringTag](): string {
    if (this.identifier !== undefined) {
      return '`' + this.identifier + '`';
    }

    return formatTokenKind(LexerTokenKind.IDENTIFIER);
  }
}

export class SyntaxRuleLiteral extends SyntaxRule<
  LexerTokenMatch<LiteralTokenData>
> {
  tryMatch(
    tokens: BufferedIterator<LexerToken>
  ): RuleResult<LexerTokenMatch<LiteralTokenData>> {
    return this.simpleTryMatchBoilerplate(tokens, token => {
      if (token.data.kind === LexerTokenKind.LITERAL) {
        return {
          data: token.data,
          span: token.span,
          location: token.location,
        };
      }

      return undefined;
    });
  }

  [Symbol.toStringTag](): string {
    return formatTokenKind(LexerTokenKind.LITERAL);
  }
}

export class SyntaxRuleString extends SyntaxRule<
  LexerTokenMatch<StringTokenData>
> {
  tryMatch(
    tokens: BufferedIterator<LexerToken>
  ): RuleResult<LexerTokenMatch<StringTokenData>> {
    return this.simpleTryMatchBoilerplate(tokens, token => {
      if (token.data.kind === LexerTokenKind.STRING) {
        return {
          data: token.data,
          span: token.span,
          location: token.location,
        };
      }

      return undefined;
    });
  }

  [Symbol.toStringTag](): string {
    return formatTokenKind(LexerTokenKind.STRING);
  }
}

// Combinators //

export class SyntaxRuleOr<F, S> extends SyntaxRule<F | S> {
  constructor(readonly first: SyntaxRule<F>, readonly second: SyntaxRule<S>) {
    super();
  }

  tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<F | S> {
    // Basic rules automatically restore `tokens` state on `nomatch`
    const firstMatch = this.first.tryMatch(tokens);
    if (firstMatch.kind === 'match') {
      return firstMatch;
    }

    const secondMatch = this.second.tryMatch(tokens);
    if (secondMatch.kind === 'match') {
      return {
        ...secondMatch,
        optionalAttempts: firstMatch.attempts.merge(
          secondMatch.optionalAttempts
        ),
      };
    }

    return {
      kind: 'nomatch',
      attempts: firstMatch.attempts.merge(secondMatch.attempts),
    };
  }

  [Symbol.toStringTag](): string {
    return this.first.toString() + ' or ' + this.second.toString();
  }
}

// TODO: In TypeScript 4.0 use variadic tuple types: [...F, S]
export class SyntaxRuleFollowedBy<
  F extends readonly unknown[],
  S
> extends SyntaxRule<readonly (F[number] | S)[]> {
  constructor(readonly first: SyntaxRule<F>, readonly second: SyntaxRule<S>) {
    super();
  }

  // TODO: In TypeScript 4.0 use variadic tuple types: [...F, S]
  andBy<R>(
    rule: SyntaxRule<R>
  ): SyntaxRuleFollowedBy<readonly (F[number] | S)[], R> {
    return new SyntaxRuleFollowedBy(this, rule);
  }

  // TODO: In TypeScript 4.0 use variadic tuple types: [...F, S]
  tryMatch(
    tokens: BufferedIterator<LexerToken>
  ): RuleResult<readonly (F[number] | S)[]> {
    const save = tokens.save();

    const firstMatch = this.first.tryMatch(tokens);
    if (firstMatch.kind === 'nomatch') {
      tokens.restore(save);
      tokens.endSave();

      return firstMatch;
    }

    const secondMatch = this.second.tryMatch(tokens);
    if (secondMatch.kind === 'nomatch') {
      tokens.restore(save);
      tokens.endSave();

      return {
        ...secondMatch,
        attempts: MatchAttempts.mergePreserveOrder(
          firstMatch.optionalAttempts,
          secondMatch.attempts
        ),
      };
    }

    tokens.endSave();

    return {
      kind: 'match',
      match: [...firstMatch.match, secondMatch.match],
      optionalAttempts: MatchAttempts.merge(
        firstMatch.optionalAttempts,
        secondMatch.optionalAttempts
      ),
    };
  }

  [Symbol.toStringTag](): string {
    return this.first.toString() + ' -> ' + this.second.toString();
  }
}

export class SyntaxRuleMap<R, M> extends SyntaxRule<M> {
  constructor(readonly rule: SyntaxRule<R>, readonly mapper: (_: R) => M) {
    super();
  }

  tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<M> {
    const match = this.rule.tryMatch(tokens);
    if (match.kind === 'match') {
      return {
        ...match,
        match: this.mapper(match.match),
      };
    }

    return match;
  }

  [Symbol.toStringTag](): string {
    return this.rule.toString();
  }
}

export class SyntaxRuleRepeat<R> extends SyntaxRule<readonly R[]> {
  constructor(readonly rule: SyntaxRule<R>) {
    super();
  }

  tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<readonly R[]> {
    const matches: R[] = [];

    let lastMatch: RuleResultMatch<R> | undefined;
    let lastResult: RuleResult<R>;
    for (;;) {
      lastResult = this.rule.tryMatch(tokens);

      if (lastResult.kind === 'match') {
        lastMatch = lastResult;

        matches.push(lastMatch.match);
      } else {
        break;
      }
    }

    if (matches.length > 0) {
      return {
        kind: 'match',
        match: matches,
        optionalAttempts: MatchAttempts.mergePreserveOrder(
          lastMatch?.optionalAttempts,
          lastResult.attempts
        ),
      };
    }

    return lastResult;
  }

  [Symbol.toStringTag](): string {
    return 'one or more ' + this.rule.toString();
  }
}

export class SyntaxRuleOptional<R> extends SyntaxRule<R | undefined> {
  constructor(readonly rule: SyntaxRule<R>) {
    super();
  }

  tryMatch(
    tokens: BufferedIterator<LexerToken>
  ): RuleResultMatch<R | undefined> {
    const match = this.rule.tryMatch(tokens);
    if (match.kind === 'match') {
      return match;
    }

    return {
      kind: 'match',
      match: undefined,
      optionalAttempts: match.attempts,
    };
  }

  [Symbol.toStringTag](): string {
    return 'optional ' + this.rule.toString();
  }
}

// OTHER //

/**
 * Mutable rule.
 *
 * Since the syntax tree node types are recursive, it follows that the rule definitions must be too.
 * However, there is no way to achieve constant recursiveness - e.g. mutability must be used.
 *
 * This rule provides the option to mutate the inner rule after the object has been created
 * to allow for this mutability. However, it should not be used outside the usecase.
 */
export class SyntaxRuleMutable<R> extends SyntaxRule<R> {
  constructor(
    // NOT readonly
    public rule?: SyntaxRule<R>
  ) {
    super();
  }

  tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<R> {
    if (this.rule === undefined) {
      throw 'This method should never be called. This is an error in syntax rules definition.';
    }

    return this.rule.tryMatch(tokens);
  }

  [Symbol.toStringTag](): string {
    if (this.rule === undefined) {
      throw 'This method should never be called. This is an error in syntax rules definition.';
    }

    return '[Mutable Rule]';
  }
}
