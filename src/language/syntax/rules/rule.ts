import {
  DecoratorTokenData,
  DecoratorValue,
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

/** Pair of rule and token that were attempted by failed */
export type RuleAttempt = {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  rule: SyntaxRule<any>; // cannot be unknown :(
  token?: LexerToken;
};
type OptionalFailure = {
  /**
   * A failure of a rule that introduces optionality.
   *
   * When a rule that introduces optionality (such as Optional and Repeat) matches, it might
   * have interally failed to match a different option. If another rule following the optional
   * one doesn't match, the error might not report the complete information. Once another rule
   * following the optional one matches, this information is no longer needed.
   *
   * This field contains information about last failed optional rule which hasn't been "cleaned" yet by another success.
   */
  optionalFailure?: RuleAttempt;
};

export type RuleResultMatch<T> = {
  kind: 'match';
  match: T;
} & OptionalFailure;
export type RuleResultNoMatch = {
  kind: 'nomatch';
  attempt: RuleAttempt;
} & OptionalFailure;
export type RuleResult<T> = RuleResultMatch<T> | RuleResultNoMatch;

export interface LexerTokenMatch<D extends LexerTokenData = LexerTokenData> {
  readonly data: D;
  readonly location: Location;
  readonly span: Span;
}

export abstract class SyntaxRule<T> {
  constructor(readonly name?: string) {}

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
      attempt: {
        rule: this,
        token: next.value,
      },
    };
  }

  toString(): string {
    return this[Symbol.toStringTag]();
  }

  abstract [Symbol.toStringTag](): string;

  // Factory methods for basic rules

  static separator(
    separator?: SeparatorValue,
    name?: string
  ): SyntaxRuleSeparator {
    return new SyntaxRuleSeparator(separator, name);
  }

  static operator(operator?: OperatorValue, name?: string): SyntaxRuleOperator {
    return new SyntaxRuleOperator(operator, name);
  }

  static identifier(
    identifier?: IdentifierValue,
    name?: string
  ): SyntaxRuleIdentifier {
    return new SyntaxRuleIdentifier(identifier, name);
  }

  static literal(name?: string): SyntaxRuleLiteral {
    return new SyntaxRuleLiteral(name);
  }

  static string(name?: string): SyntaxRuleString {
    return new SyntaxRuleString(name);
  }

  static decorator(
    decorator?: DecoratorValue,
    name?: string
  ): SyntaxRuleDecorator {
    return new SyntaxRuleDecorator(decorator, name);
  }

  // Combinators

  or<R>(rule: SyntaxRule<R>, name?: string): SyntaxRuleOr<T, R> {
    return new SyntaxRuleOr(this, rule, name);
  }

  /**
   * To cascade multiple `followed` rules, use `.andBy` method on the
   * `SyntaxRuleFollowedBy` object that is returned to flatten nested tuples.
   */
  followedBy<R>(
    rule: SyntaxRule<R>,
    name?: string
  ): SyntaxRuleFollowedBy<[T], R> {
    return new SyntaxRuleFollowedBy(
      this.map(m => [m]),
      rule,
      name
    );
  }

  map<M>(mapper: (_: T) => M, name?: string): SyntaxRuleMap<T, M> {
    return new SyntaxRuleMap(this, mapper, name);
  }

  static repeat<R>(rule: SyntaxRule<R>, name?: string): SyntaxRuleRepeat<R> {
    return new SyntaxRuleRepeat(rule, name);
  }

  static optional<R>(
    rule: SyntaxRule<R>,
    name?: string
  ): SyntaxRuleOptional<R> {
    return new SyntaxRuleOptional(rule, name);
  }
}

// Basic nodes //

export class SyntaxRuleSeparator extends SyntaxRule<
  LexerTokenMatch<SeparatorTokenData>
> {
  constructor(readonly separator?: SeparatorValue, name?: string) {
    super(name);
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
    if (this.name !== undefined) {
      return this.name;
    }

    if (this.separator !== undefined) {
      return '`' + this.separator + '`';
    }

    return formatTokenKind(LexerTokenKind.SEPARATOR);
  }
}

export class SyntaxRuleOperator extends SyntaxRule<
  LexerTokenMatch<OperatorTokenData>
> {
  constructor(readonly operator?: OperatorValue, name?: string) {
    super(name);
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
    if (this.name !== undefined) {
      return this.name;
    }

    if (this.operator !== undefined) {
      return '`' + this.operator + '`';
    }

    return formatTokenKind(LexerTokenKind.OPERATOR);
  }
}

export class SyntaxRuleIdentifier extends SyntaxRule<
  LexerTokenMatch<IdentifierTokenData>
> {
  constructor(readonly identifier?: IdentifierValue, name?: string) {
    super(name);
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
    if (this.name !== undefined) {
      return this.name;
    }

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
    return this.name ?? formatTokenKind(LexerTokenKind.LITERAL);
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
    return this.name ?? formatTokenKind(LexerTokenKind.STRING);
  }
}

export class SyntaxRuleDecorator extends SyntaxRule<
  LexerTokenMatch<DecoratorTokenData>
> {
  constructor(readonly decorator?: DecoratorValue, name?: string) {
    super(name);
  }

  tryMatch(
    tokens: BufferedIterator<LexerToken>
  ): RuleResult<LexerTokenMatch<DecoratorTokenData>> {
    return this.simpleTryMatchBoilerplate(tokens, token => {
      if (token.data.kind === LexerTokenKind.DECORATOR) {
        if (
          this.decorator === undefined ||
          token.data.decorator === this.decorator
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
    if (this.name !== undefined) {
      return this.name;
    }

    if (this.decorator !== undefined) {
      return '`' + this.decorator + '`';
    }

    return formatTokenKind(LexerTokenKind.DECORATOR);
  }
}

// Combinators //

export class SyntaxRuleOr<F, S> extends SyntaxRule<F | S> {
  constructor(
    readonly first: SyntaxRule<F>,
    readonly second: SyntaxRule<S>,
    name?: string
  ) {
    super(name);
  }

  tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<F | S> {
    // Basic rules automatically restore `tokens` state on `nomatch`
    const firstMatch = this.first.tryMatch(tokens);
    if (firstMatch.kind === 'match') {
      return firstMatch;
    }

    const secondMatch = this.second.tryMatch(tokens);
    if (secondMatch.kind === 'match') {
      return secondMatch;
    }

    return {
      kind: 'nomatch',
      attempt: {
        rule: this,
        token: tokens.peek().value,
      },
    };
  }

  [Symbol.toStringTag](): string {
    return this.name ?? this.first.toString() + ' or ' + this.second.toString();
  }
}

// TODO: In TypeScript 4.0 use variadic tuple types: [...F, S]
export class SyntaxRuleFollowedBy<F extends unknown[], S> extends SyntaxRule<
  (F[number] | S)[]
> {
  constructor(
    readonly first: SyntaxRule<F>,
    readonly second: SyntaxRule<S>,
    name?: string
  ) {
    super(name);
  }

  // TODO: In TypeScript 4.0 use variadic tuple types: [...F, S]
  andBy<R>(
    rule: SyntaxRule<R>,
    name?: string
  ): SyntaxRuleFollowedBy<(F[number] | S)[], R> {
    return new SyntaxRuleFollowedBy(this, rule, name);
  }

  // TODO: In TypeScript 4.0 use variadic tuple types: [...F, S]
  tryMatch(
    tokens: BufferedIterator<LexerToken>
  ): RuleResult<(F[number] | S)[]> {
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
        kind: 'nomatch',
        attempt: secondMatch.attempt,
        optionalFailure: firstMatch.optionalFailure,
      };
    }

    tokens.endSave();

    return {
      kind: 'match',
      match: [...firstMatch.match, secondMatch.match],
      optionalFailure: secondMatch.optionalFailure,
    };
  }

  [Symbol.toStringTag](): string {
    return this.name ?? this.first.toString() + ' -> ' + this.second.toString();
  }
}

export class SyntaxRuleMap<R, M> extends SyntaxRule<M> {
  constructor(
    readonly rule: SyntaxRule<R>,
    readonly mapper: (_: R) => M,
    name?: string
  ) {
    super(name);
  }

  tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<M> {
    const match = this.rule.tryMatch(tokens);
    if (match.kind === 'match') {
      return {
        kind: 'match',
        match: this.mapper(match.match),
        optionalFailure: match.optionalFailure,
      };
    }

    return match;
  }

  [Symbol.toStringTag](): string {
    return this.name ?? this.rule.toString();
  }
}

export class SyntaxRuleRepeat<R> extends SyntaxRule<R[]> {
  constructor(readonly rule: SyntaxRule<R>, name?: string) {
    super(name);
  }

  tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<R[]> {
    const matches: R[] = [];

    let lastMatch: RuleResult<R>;
    for (;;) {
      lastMatch = this.rule.tryMatch(tokens);
      if (lastMatch.kind === 'match') {
        matches.push(lastMatch.match);
      } else {
        break;
      }
    }

    if (matches.length > 0) {
      return {
        kind: 'match',
        match: matches,
        optionalFailure: {
          rule: this.rule,
          token: tokens.peek().value,
        },
      };
    }

    return {
      kind: 'nomatch',
      attempt: {
        rule: this,
        token: tokens.peek().value,
      },
      optionalFailure: lastMatch.optionalFailure,
    };
  }

  [Symbol.toStringTag](): string {
    return this.name ?? 'one or more ' + this.rule.toString();
  }
}

export class SyntaxRuleOptional<R> extends SyntaxRule<R | undefined> {
  constructor(readonly rule: SyntaxRule<R>, name?: string) {
    super(name);
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
      optionalFailure: match.attempt,
    };
  }

  [Symbol.toStringTag](): string {
    return this.name ?? 'optional ' + this.rule.toString();
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
    name?: string,
    // NOT readonly
    public rule?: SyntaxRule<R>
  ) {
    super(name);
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

    return this.name ?? this.rule.name ?? '[Mutable Rule]';
  }
}
