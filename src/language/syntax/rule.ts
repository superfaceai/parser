import { LexerContext, LexerContextType } from '../lexer/context';
import { LexerTokenStream } from '../lexer/lexer';
import {
  formatTokenKind,
  IdentifierTokenData,
  IdentifierValue,
  JessieScriptTokenData,
  LexerToken,
  LexerTokenData,
  LexerTokenKind,
  LiteralTokenData,
  NewlineTokenData,
  OperatorTokenData,
  OperatorValue,
  SeparatorTokenData,
  SeparatorValue,
  StringTokenData,
  TerminationTokens,
} from '../lexer/token';
import { LocationSpan } from '../source';

export class MatchAttempts {
  constructor(
    /** Token at which the rules failed */
    readonly token: LexerToken | undefined,
    /** Rules which failed at the token */
    readonly rules: readonly SyntaxRule<unknown>[]
  ) {}

  static merge(
    first: MatchAttempts,
    second: MatchAttempts | undefined
  ): MatchAttempts;
  static merge(
    first: MatchAttempts | undefined,
    second: MatchAttempts
  ): MatchAttempts;
  static merge(
    first: MatchAttempts | undefined,
    second: MatchAttempts | undefined
  ): MatchAttempts | undefined;
  static merge(
    first: MatchAttempts | undefined,
    second: MatchAttempts | undefined
  ): MatchAttempts | undefined {
    if (first === undefined) {
      return second;
    }

    return first.merge(second);
  }

  /** Merges two rule attempts according to the furthest token heuristic. */
  merge(other: MatchAttempts | undefined): MatchAttempts {
    if (other === undefined) {
      return this;
    }

    // resolve undefined
    if (this.token === undefined && other.token === undefined) {
      return new MatchAttempts(this.token, [...this.rules, ...other.rules]);
    }
    // undefined is treated as greater than defined
    if (this.token === undefined) {
      return this;
    } else if (other.token === undefined) {
      return other;
    }

    // if the tokens are of UNKNOWN variant then we compare their error spans instead
    const thisLocation =
      this.token.data.kind === LexerTokenKind.UNKNOWN
        ? this.token.data.error.location
        : this.token.location;
    const otherLocation =
      other.token.data.kind === LexerTokenKind.UNKNOWN
        ? other.token.data.error.location
        : other.token.location;

    if (thisLocation.start.charIndex === otherLocation.start.charIndex) {
      return new MatchAttempts(this.token, [...this.rules, ...other.rules]);
    }
    if (thisLocation.start.charIndex > otherLocation.start.charIndex) {
      return this;
    } else {
      return other;
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
  readonly location: LocationSpan;
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

  static newline(): SyntaxRuleNewline {
    return new SyntaxRuleNewline();
  }

  static jessie(
    terminatingChars?: ReadonlyArray<TerminationTokens>
  ): SyntaxRuleJessie {
    return new SyntaxRuleJessie(terminatingChars);
  }

  // Combinators

  static or<R extends SyntaxRule<unknown>[]>(
    ...rules: R
  ): SyntaxRuleOr<PeelTupleSyntaxRule<R>> {
    return new SyntaxRuleOr(...rules) as SyntaxRuleOr<PeelTupleSyntaxRule<R>>;
  }

  static followedBy<R extends SyntaxRule<unknown>[]>(
    ...rules: R
  ): SyntaxRuleFollowedBy<PeelTupleSyntaxRule<R>> {
    return new SyntaxRuleFollowedBy(...rules) as SyntaxRuleFollowedBy<
      PeelTupleSyntaxRule<R>
    >;
  }

  or<R>(rule: SyntaxRule<R>): SyntaxRuleOr<[T, R]> {
    return new SyntaxRuleOr(this, rule);
  }

  followedBy<R>(rule: SyntaxRule<R>): SyntaxRuleFollowedBy<[T, R]> {
    return new SyntaxRuleFollowedBy(this, rule);
  }

  // Cannot return `SyntaxRuleMap` because that would confuse TS into thinking `SyntaxRule` is contravariant over `T`
  map<M>(mapper: (_: T) => M): SyntaxRule<M> {
    return new SyntaxRuleMap(this, mapper);
  }

  andThen<M>(
    then: (_: T) => AndThenResult<M>,
    description?: string
  ): SyntaxRule<M> {
    return new SyntaxRuleAndThen(this, then, description);
  }

  /** Ensures that `this` is followed by `rule` without consuming any tokens after `this`. */
  lookahead<R>(rule: SyntaxRule<R>): SyntaxRule<T> {
    return new SyntaxRuleFollowedBy(this, new SyntaxRuleLookahead(rule)).map(
      ([me, _lookahead]) => me
    );
  }

  /** Skips `rule` following `this` without affecting the returned type. */
  skip<R>(rule: SyntaxRule<R>): SyntaxRule<T> {
    return new SyntaxRuleFollowedBy(this, rule).map(([me, _skipped]) => me);
  }

  /** Forgets `this` and expects `rule` to follow. */
  forgetFollowedBy<R>(rule: SyntaxRule<R>): SyntaxRule<R> {
    return new SyntaxRuleFollowedBy(this, rule).map(([_me, newres]) => newres);
  }

  static repeat<R>(rule: SyntaxRule<R>): SyntaxRuleRepeat<R> {
    return new SyntaxRuleRepeat(rule);
  }

  static optional<R>(rule: SyntaxRule<R>): SyntaxRuleOptional<R> {
    return new SyntaxRuleOptional(rule);
  }

  static optionalRepeat<R>(
    rule: SyntaxRule<R>
  ): SyntaxRuleOptional<[R, ...R[]]> {
    return new SyntaxRuleOptional(new SyntaxRuleRepeat(rule));
  }

  /**
   * Returns `rule` that cannot be preceded by a newline.
   * Example usage: `SyntaxRule.identifier('slot').followedBy(SyntaxRule.sameLine(SyntaxRule.string()))`
   */
  static sameLine<R>(rule: SyntaxRule<R>): SyntaxRule<R> {
    return new SyntaxRuleFollowedBy(
      // This behavior is special, because `SyntaxRuleNewline` changes the token filter in the `tokens` stream
      // otherwise this construct would not be of much use
      new SyntaxRuleLookahead(SyntaxRule.newline(), true),
      rule
    ).map(([_, r]) => r);
  }

  debug(): SyntaxRule<T> {
    return new SyntaxRuleDebugLog(this);
  }
}

// BASIC //

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

// SPECIFIC //

export class SyntaxRuleNewline extends SyntaxRule<
  LexerTokenMatch<NewlineTokenData>
> {
  tryMatch(
    tokens: LexerTokenStream
  ): RuleResult<LexerTokenMatch<NewlineTokenData>> {
    const originalFilter = tokens.tokenKindFilter[LexerTokenKind.NEWLINE];
    tokens.tokenKindFilter[LexerTokenKind.NEWLINE] = false;

    const result = this.simpleTryMatchBoilerplate(tokens, token => {
      if (token.data.kind === LexerTokenKind.NEWLINE) {
        return {
          data: token.data,
          location: token.location,
        };
      }

      return undefined;
    });

    tokens.tokenKindFilter[LexerTokenKind.NEWLINE] = originalFilter;

    return result;
  }

  [Symbol.toStringTag](): string {
    return formatTokenKind(LexerTokenKind.NEWLINE);
  }
}

export class SyntaxRuleJessie extends SyntaxRule<
  LexerTokenMatch<JessieScriptTokenData>
> {
  constructor(readonly terminationTokens?: ReadonlyArray<TerminationTokens>) {
    super();
  }

  tryMatch(
    tokens: LexerTokenStream
  ): RuleResult<LexerTokenMatch<JessieScriptTokenData>> {
    return this.simpleTryMatchBoilerplate(
      tokens,
      token => {
        if (token.data.kind === LexerTokenKind.JESSIE_SCRIPT) {
          return {
            data: token.data,
            location: token.location,
          };
        }

        return undefined;
      },
      {
        type: LexerContextType.JESSIE_SCRIPT_EXPRESSION,
        terminationTokens: this.terminationTokens,
      }
    );
  }

  [Symbol.toStringTag](): string {
    return formatTokenKind(LexerTokenKind.JESSIE_SCRIPT);
  }
}

// COMBINATORS //

type PeelTupleSyntaxRule<R> = {
  [k in keyof R]: R[k] extends SyntaxRule<infer T> ? T : never;
};
/** Wraps `[A, B, C]` into `[SyntaxRule<A>, SyntaxRule<B>, SyntaxRule<C>]`. */
type WrapTupleSyntaxRule<R> = { [k in keyof R]: SyntaxRule<R[k]> };
/** Returns type of tuple items as an union: `[A, B, C]` -> `A | B | C`. */
type TupleItemsUnion<T> = T extends (infer E)[] ? E : never;

export class SyntaxRuleOr<T extends readonly unknown[]> extends SyntaxRule<
  TupleItemsUnion<T>
> {
  readonly rules: WrapTupleSyntaxRule<T>;

  constructor(...rules: WrapTupleSyntaxRule<T>) {
    super();

    this.rules = rules;
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<TupleItemsUnion<T>> {
    let attempts = undefined;

    for (const rule of this.rules) {
      // Basic rules automatically restore `tokens` state on `nomatch`
      const match = rule.tryMatch(tokens);

      if (match.kind === 'match') {
        return {
          kind: 'match',
          // typescript fails us with understand here that the type is correct
          match: match.match as TupleItemsUnion<T>,
          optionalAttempts: MatchAttempts.merge(
            attempts,
            match.optionalAttempts
          ),
        };
      } else {
        attempts = MatchAttempts.merge(attempts, match.attempts);
      }
    }

    if (attempts === undefined) {
      // `this.rules` is an empty array
      return {
        kind: 'nomatch',
        attempts: new MatchAttempts(tokens.peek().value, [this]),
      };
    } else {
      return {
        kind: 'nomatch',
        attempts: attempts,
      };
    }
  }

  [Symbol.toStringTag](): string {
    return this.rules.map(r => r.toString()).join(' or ');
  }
}

export class SyntaxRuleFollowedBy<
  T extends readonly unknown[]
> extends SyntaxRule<T> {
  readonly rules: WrapTupleSyntaxRule<T>;

  constructor(...rules: WrapTupleSyntaxRule<T>) {
    super();

    this.rules = rules;
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<T> {
    const save = tokens.save();

    let optionalAttempts = undefined;
    const matches = [];

    for (const rule of this.rules) {
      const match = rule.tryMatch(tokens);

      if (match.kind === 'nomatch') {
        tokens.rollback(save);

        return {
          ...match,
          attempts: MatchAttempts.merge(optionalAttempts, match.attempts),
        };
      } else {
        optionalAttempts = MatchAttempts.merge(
          optionalAttempts,
          match.optionalAttempts
        );
        matches.push(match.match);
      }
    }

    return {
      kind: 'match',
      // we force the type here because typescript cannot check it for us
      // the value of `matches` is a collection of matches of all `this.rules` in order - i.e. `F`.
      match: matches as unknown as T,
      optionalAttempts,
    };
  }

  [Symbol.toStringTag](): string {
    return this.rules.map(r => r.toString()).join(' -> ');
  }
}

/** Matches one or more occurences of `rule`. */
export class SyntaxRuleRepeat<R> extends SyntaxRule<[R, ...R[]]> {
  constructor(readonly rule: SyntaxRule<R>) {
    super();
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<[R, ...R[]]> {
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
        match: matches as [R, ...R[]],
        optionalAttempts: lastResult.attempts.merge(
          lastMatch?.optionalAttempts
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

  tryMatch(tokens: LexerTokenStream): RuleResultMatch<R | undefined> {
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

// META //

/** Matches rule and then restores `tokens` state. */
export class SyntaxRuleLookahead<R> extends SyntaxRule<undefined> {
  /**
   * Invert the lookahead, matching if the inner rule fails.
   */
  readonly invert: boolean;

  constructor(readonly rule: SyntaxRule<R>, invert?: boolean) {
    super();

    this.invert = invert ?? false;
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<undefined> {
    const save = tokens.save();
    const result = this.rule.tryMatch(tokens);
    tokens.rollback(save);

    // Handle inversion
    if (this.invert) {
      if (result.kind === 'nomatch') {
        return {
          kind: 'match',
          match: undefined,
        };
      } else {
        return {
          kind: 'nomatch',
          attempts: new MatchAttempts(tokens.peek().value, [this]),
        };
      }
    }

    if (result.kind === 'match') {
      return {
        ...result,
        match: undefined,
      };
    }

    return result;
  }

  [Symbol.toStringTag](): string {
    return (this.invert ? 'not ' : '') + this.rule.toString();
  }
}

// CUSTOM LOGIC //

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

type AndThenResult<T> = { kind: 'match'; value: T } | { kind: 'nomatch' };
export class SyntaxRuleAndThen<R, M> extends SyntaxRule<M> {
  constructor(
    readonly rule: SyntaxRule<R>,
    readonly then: (_: R) => AndThenResult<M>,
    readonly description?: string
  ) {
    super();
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<M> {
    const peek = tokens.peek().value;

    const match = this.rule.tryMatch(tokens);

    if (match.kind === 'match') {
      const then = this.then(match.match);

      if (then.kind == 'match') {
        return {
          kind: 'match',
          match: then.value,
          optionalAttempts: match.optionalAttempts,
        };
      } else {
        return {
          kind: 'nomatch',
          attempts: new MatchAttempts(peek, [this]).merge(
            match.optionalAttempts
          ),
        };
      }
    }

    return match;
  }

  [Symbol.toStringTag](): string {
    return this.description ?? this.rule.toString();
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
      throw 'This method should never be called before the mutable rule is initialized. This is an error in syntax rules definition.';
    }

    return this.rule.tryMatch(tokens);
  }

  [Symbol.toStringTag](): string {
    if (this.rule === undefined) {
      throw 'This method should never be called before the mutable rule is initialized. This is an error in syntax rules definition.';
    }

    return '[Mutable Rule]';
  }
}

/**
 * Never rules.
 *
 * This rule never matches.
 */
export class SyntaxRuleNever<R> extends SyntaxRule<R> {
  constructor() {
    super();
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<R> {
    return {
      kind: 'nomatch',
      attempts: new MatchAttempts(tokens.peek().value, [this]),
    };
  }

  [Symbol.toStringTag](): string {
    return '<NEVER>';
  }
}

export class SyntaxRuleDebugLog<R> extends SyntaxRule<R> {
  constructor(readonly rule: SyntaxRule<R>) {
    super();
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<R> {
    const nextToken = tokens.peek().value;

    let result;
    try {
      result = this.rule.tryMatch(tokens);
    } catch (err) {
      console.debug(
        '\nRule:',
        this.rule,
        '\nException:',
        err,
        '\nFirst token:',
        nextToken
      );
      throw err;
    }

    if (result.kind === 'nomatch') {
      console.debug(
        '\nRule:',
        this.rule,
        '\nAttempts:',
        result.attempts,
        '\nFirst token:',
        nextToken
      );
    } else {
      console.debug(
        '\nRule:',
        this.rule,
        '\nMatch:',
        result.match,
        '\nFirst token:',
        nextToken
      );
    }

    return result;
  }

  [Symbol.toStringTag](): string {
    return this.rule.toString();
  }
}
