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
import { LexerContext, LexerTokenStream } from '../../lexer'
import { Location, Span } from '../../source';

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
  abstract tryMatch(tokens: LexerTokenStream): RuleResult<T>;

  protected simpleTryMatchBoilerplate(
    tokens: LexerTokenStream,
    predicate: (token: LexerToken) => T | undefined,
    context?: LexerContext
  ): RuleResult<T> {
    const save = tokens.save();

    const next = tokens.next(context);
    if (next.done === false) {
      const token = next.value;

      const match = predicate(token);
      if (match !== undefined) {
        return {
          kind: 'match',
          match: match,
        };
      }
    }

    tokens.rollback(save);

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

  // Cannot return `SyntaxRuleCondition` because that would confuse TS into thinking `SyntaxRule` is contravariant over `T`
  condition(fn: (_: T) => boolean): SyntaxRule<T> {
    return new SyntaxRuleCondition(this, fn);
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

  static lookahead<R>(rule: SyntaxRule<R>): SyntaxRuleLookahead<R> {
    return new SyntaxRuleLookahead(rule);
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
    tokens: LexerTokenStream
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
    tokens: LexerTokenStream
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
    tokens: LexerTokenStream
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
    tokens: LexerTokenStream
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
    tokens: LexerTokenStream
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

  tryMatch(tokens: LexerTokenStream): RuleResult<F | S> {
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

/** Matches `first` followed by `second.
 *
 * Use `.andBy` to chain additional `followedBy` rules to flatten the `match` tuple.
 */
export class SyntaxRuleFollowedBy<
  F extends readonly unknown[],
  S
> extends SyntaxRule<[...F, S]> {
  constructor(readonly first: SyntaxRule<F>, readonly second: SyntaxRule<S>) {
    super();
  }

  andBy<R>(rule: SyntaxRule<R>): SyntaxRuleFollowedBy<[...F, S], R> {
    return new SyntaxRuleFollowedBy(this, rule);
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<[...F, S]> {
    const save = tokens.save();

    const firstMatch = this.first.tryMatch(tokens);
    if (firstMatch.kind === 'nomatch') {
      tokens.rollback(save);

      return firstMatch;
    }

    const secondMatch = this.second.tryMatch(tokens);
    if (secondMatch.kind === 'nomatch') {
      tokens.rollback(save);

      return {
        ...secondMatch,
        attempts: MatchAttempts.mergePreserveOrder(
          firstMatch.optionalAttempts,
          secondMatch.attempts
        ),
      };
    }

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

/** Matches one or more occurences of `rule`. */
export class SyntaxRuleRepeat<R> extends SyntaxRule<R[]> {
  constructor(readonly rule: SyntaxRule<R>) {
    super();
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<R[]> {
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

/** Matches zero or one occurences of `rule`. */
export class SyntaxRuleOptional<R> extends SyntaxRule<R | undefined> {
  constructor(readonly rule: SyntaxRule<R>) {
    super();
  }

  tryMatch(
    tokens: LexerTokenStream
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

/** Matches rule and then restores `tokens` state. */
export class SyntaxRuleLookahead<R> extends SyntaxRule<undefined> {
  constructor(readonly rule: SyntaxRule<R>) {
    super();
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<undefined> {
    const save = tokens.save();
    const result = this.rule.tryMatch(tokens);
    tokens.rollback(save);

    if (result.kind === 'match') {
      return {
        ...result,
        match: undefined,
      };
    }

    return result;
  }

  [Symbol.toStringTag](): string {
    return this.rule.toString();
  }
}

// CUSTOM LOGIC //

/** Allows inserting custom code into the matching process by giving access to the result of the wrapper rule to a custom closure. */
export class SyntaxRuleCondition<R> extends SyntaxRule<R> {
  constructor(
    readonly rule: SyntaxRule<R>,
    readonly fn: (result: R) => boolean
  ) {
    super();
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<R> {
    const save = tokens.save();

    const result = this.rule.tryMatch(tokens);
    if (result.kind === 'match') {
      // If the new result is a failure, roll back the tokens state.
      if (!this.fn(result.match)) {
        tokens.rollback(save);

        return {
          kind: 'nomatch',
          attempts: MatchAttempts.mergePreserveOrder(
            result.optionalAttempts,
            new MatchAttempts(tokens.peek().value, [this])
          ),
        };
      }
    }

    return result;
  }

  [Symbol.toStringTag](): string {
    return this.rule.toString();
  }
}

/** Maps `match` value on success. */
export class SyntaxRuleMap<R, M> extends SyntaxRule<M> {
  constructor(readonly rule: SyntaxRule<R>, readonly mapper: (_: R) => M) {
    super();
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<M> {
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

  tryMatch(tokens: LexerTokenStream): RuleResult<R> {
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
