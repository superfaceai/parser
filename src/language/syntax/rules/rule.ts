import {
	DecoratorTokenData,
	DecoratorValue,
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

export type RuleResultMatch<T> = {
	kind: 'match',
	match: T
}
export type RuleResultNoMatch = {
	kind: 'nomatch',
	
	/** Pairs of rules and tokens that were attempted by failed */
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */ // cannot be unknown :(
	attempts: { rule: SyntaxRule<any>, token?: LexerToken }[]
	// TODO: Partial match?
}
export type RuleResult<T> = RuleResultMatch<T> | RuleResultNoMatch;

const INDENT_CHAR = '\t'

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
		predicate: (token: LexerToken) => T | null
	): RuleResult<T> {
		const save = tokens.save();
		
		const next = tokens.next();
		if (next.done === false) {
			const token = next.value;

			const match = predicate(token)
			if (match !== null) {
				return {
					kind: 'match',
					match: match
				};
			}
		}

		tokens.restore(save);

		return {
			kind: 'nomatch',
			attempts: [{
				rule: this,
				token: next.value
			}]
		}
	}

	/** Converts this rule to string with indentation indicated by the `depth`. */
	abstract toStringDepth(depth: number): string;

	toString(): string {
		return this[Symbol.toStringTag]();
	}

	[Symbol.toStringTag](): string {
		return this.toStringDepth(0);
	}

	// Factory methods for basic rules

	// SyntaxRule class doesn't have to provide these functions, but they are usefull.
	// There is no way to cause a ReferenceError because the classes (below) are declared
	// before these functions can be called, so this lint is wrong.
	/* eslint-disable @typescript-eslint/no-use-before-define */
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
		return new SyntaxRuleLiteral()
	}

	static string(): SyntaxRuleString {
		return new SyntaxRuleString();
	}

	static decorator(decorator?: DecoratorValue): SyntaxRuleDecorator {
		return new SyntaxRuleDecorator(decorator);
	}

	// Combinators

	or<R>(rule: SyntaxRule<R>): SyntaxRuleOr<T, R> {
		return new SyntaxRuleOr(this, rule);
	}

	/**
	 * To cascade multiple `followed` rules, use `.andBy` method on the
	 * `SyntaxRuleFollowedBy` object that is returned to flatten nested tuples.
	 */
	followedBy<R>(rule: SyntaxRule<R>): SyntaxRuleFollowedBy<[T], R> {
		return new SyntaxRuleFollowedBy(this.map(m => [m]), rule);
	}

	map<M>(mapper: (_: T) => M): SyntaxRuleMap<T, M> {
		return new SyntaxRuleMap(this, mapper);
	}

	static repeat<R>(rule: SyntaxRule<R>): SyntaxRuleRepeat<R> {
		return new SyntaxRuleRepeat(rule);
	}

	static optional<R>(rule: SyntaxRule<R>): SyntaxRuleOptional<R> {
		return new SyntaxRuleOptional(rule);
	}
	/* eslint-enable @typescript-eslint/no-use-before-define */
}

// Basic nodes //

export class SyntaxRuleSeparator extends SyntaxRule<LexerTokenMatch<SeparatorTokenData>> {
	readonly separator?: SeparatorValue;

	constructor(separator?: SeparatorValue) {
		super();
		this.separator = separator;
	}
	
	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<LexerTokenMatch<SeparatorTokenData>> {
		return this.simpleTryMatchBoilerplate(
			tokens,
			token => {
				if (token.data.kind === LexerTokenKind.SEPARATOR) {
					if (this.separator === undefined || token.data.separator === this.separator) {
	
						return {
							data: token.data,
							span: token.span,
							location: token.location
						};
					}
				}

				return null;
			}
		)
	}

	toStringDepth(depth: number): string {
		return INDENT_CHAR.repeat(depth) + 'SEP ' + (this.separator ?? '<ANY>') + '\n'
	}
}

export class SyntaxRuleOperator extends SyntaxRule<LexerTokenMatch<OperatorTokenData>> {
	readonly operator?: OperatorValue;

	constructor(operator?: OperatorValue) {
		super();
		this.operator = operator;
	}
	
	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<LexerTokenMatch<OperatorTokenData>> {
		return this.simpleTryMatchBoilerplate(
			tokens,
			token => {
				if (token.data.kind === LexerTokenKind.OPERATOR) {
					if (this.operator === undefined || token.data.operator === this.operator) {
	
						return {
							data: token.data,
							span: token.span,
							location: token.location
						};
					}
				}

				return null;
			}
		)
	}

	toStringDepth(depth: number): string {
		return INDENT_CHAR.repeat(depth) + 'OP ' + (this.operator ?? '<ANY>') + '\n'
	}
}

export class SyntaxRuleIdentifier extends SyntaxRule<LexerTokenMatch<IdentifierTokenData>> {
	readonly identifier?: IdentifierValue;

	constructor(identifier?: IdentifierValue) {
		super();

		this.identifier = identifier;
	}

	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<LexerTokenMatch<IdentifierTokenData>> {
		return this.simpleTryMatchBoilerplate(
			tokens,
			token => {
				if (token.data.kind === LexerTokenKind.IDENTIFIER) {
					if (this.identifier === undefined || token.data.identifier === this.identifier) {
						return {
							data: token.data,
							span: token.span,
							location: token.location
						};
					}
				}

				return null;
			}
		)
	}

	toStringDepth(depth: number): string {
		return INDENT_CHAR.repeat(depth) + 'ID' + (this.identifier ?? '<ANY>') + '\n'
	}
}

export class SyntaxRuleLiteral extends SyntaxRule<LexerTokenMatch<LiteralTokenData>> {
	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<LexerTokenMatch<LiteralTokenData>> {
		return this.simpleTryMatchBoilerplate(
			tokens,
			token => {
				if (token.data.kind === LexerTokenKind.LITERAL) {
					return {
						data: token.data,
						span: token.span,
						location: token.location
					};
				}

				return null;
			}
		)
	}

	toStringDepth(depth: number): string {
		return INDENT_CHAR.repeat(depth) + 'LIT\n'
	}
}

export class SyntaxRuleString extends SyntaxRule<LexerTokenMatch<StringTokenData>> {
	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<LexerTokenMatch<StringTokenData>> {
		return this.simpleTryMatchBoilerplate(
			tokens,
			token => {
				if (token.data.kind === LexerTokenKind.STRING) {
					return {
						data: token.data,
						span: token.span,
						location: token.location
					};
				}

				return null;
			}
		)
	}

	toStringDepth(depth: number): string {
		return INDENT_CHAR.repeat(depth) + 'STR\n'
	}
}

export class SyntaxRuleDecorator extends SyntaxRule<LexerTokenMatch<DecoratorTokenData>> {
	readonly decorator?: DecoratorValue;

	constructor(decorator?: DecoratorValue) {
		super();
		this.decorator = decorator;
	}
	
	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<LexerTokenMatch<DecoratorTokenData>> {
		return this.simpleTryMatchBoilerplate(
			tokens,
			token => {
				if (token.data.kind === LexerTokenKind.DECORATOR) {
					if (this.decorator === undefined || token.data.decorator === this.decorator) {
	
						return {
							data: token.data,
							span: token.span,
							location: token.location
						}
					}
				}

				return null;
			}
		)
	}

	toStringDepth(depth: number): string {
		return INDENT_CHAR.repeat(depth) + 'DEC ' + (this.decorator ?? '<ANY>')
	}
}

// Combinators //

export class SyntaxRuleOr<F, S> extends SyntaxRule<F | S> {
	readonly first: SyntaxRule<F>
	readonly second: SyntaxRule<S>

	constructor(
		first: SyntaxRule<F>,
		second: SyntaxRule<S>
	) {
		super();
		this.first = first;
		this.second = second;
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
			attempts: [
				...firstMatch.attempts,
				...secondMatch.attempts
			]
		}
	}

	toStringDepth(depth: number): string {
		let res = INDENT_CHAR.repeat(depth) + 'OR\n';
		res += this.first.toStringDepth(depth + 1);
		res += this.second.toStringDepth(depth + 1);

		return res;
	}
}

// TODO: In TypeScript 4.0 use variadic tuple types: [...F, S]
export class SyntaxRuleFollowedBy<F extends unknown[], S> extends SyntaxRule<(F[number] | S)[]> {
	readonly first: SyntaxRule<F>
	readonly second: SyntaxRule<S>

	constructor(
		first: SyntaxRule<F>,
		second: SyntaxRule<S>
	) {
		super();

		this.first = first;
		this.second = second;
	}

	// TODO: In TypeScript 4.0 use variadic tuple types: [...F, S]
	andBy<R>(rule: SyntaxRule<R>): SyntaxRuleFollowedBy<(F[number] | S)[], R> {
		return new SyntaxRuleFollowedBy(this, rule);
	}

	// TODO: In TypeScript 4.0 use variadic tuple types: [...F, S]
	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<(F[number] | S)[]> {
		const save = tokens.save();

		const firstMatch = this.first.tryMatch(tokens);
		if (firstMatch.kind === 'nomatch') {
			return firstMatch;
		}

		const secondMatch = this.second.tryMatch(tokens);
		if (secondMatch.kind === 'nomatch') {
			tokens.restore(save);
			
			return secondMatch;
		}

		return {
			kind: 'match',
			match: [
				...firstMatch.match,
				secondMatch.match
			]
		}
	}

	toStringDepth(depth: number): string {
		let res = INDENT_CHAR.repeat(depth) + 'FOLLOWED BY\n';
		res += this.first.toStringDepth(depth + 1);
		res += this.second.toStringDepth(depth + 1);

		return res;
	}
}

export class SyntaxRuleMap<R, M> extends SyntaxRule<M> {
	readonly rule: SyntaxRule<R>
	readonly mapper: (_: R) => M;

	constructor(
		rule: SyntaxRule<R>,
		mapper: (_: R) => M
	) {
		super();

		this.rule = rule
		this.mapper = mapper
	}

	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<M> {
		const match = this.rule.tryMatch(tokens);
		if (match.kind === 'match') {
			return {
				kind: 'match',
				match: this.mapper(match.match)
			}
		}

		return match
	}

	toStringDepth(depth: number): string {
		let res = INDENT_CHAR.repeat(depth) + 'MAP\n';
		res += this.rule.toStringDepth(depth + 1);
		// res += INDENT_CHAR.repeat(depth + 1) + this.mapper.toString();

		return res;
	}
}

export class SyntaxRuleRepeat<R> extends SyntaxRule<R[]> {
	readonly rule: SyntaxRule<R>

	constructor(rule: SyntaxRule<R>) {
		super();
		this.rule = rule;
	}

	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<R[]> {
		// Count the matches separately, because there are rules that produce empty `nodes`
		let matchCount = 0;
		const matches: R[] = []
		
		for (;;) {
			const match = this.rule.tryMatch(tokens);
			if (match.kind === 'match') {
				matches.push(match.match)
				matchCount += 1;
			} else {
				break;
			}
		}

		if (matchCount > 0) {
			return {
				kind: 'match',
				match: matches
			}
		}

		return {
			kind: 'nomatch',
			attempts: [
				{
					rule: this.rule,
					token: tokens.peek().value
				}
			]
		}
	}

	toStringDepth(depth: number): string {
		let res = INDENT_CHAR.repeat(depth) + 'rule MANY\n';
		res += this.rule.toStringDepth(depth + 1);

		return res;
	}
}

export class SyntaxRuleOptional<R> extends SyntaxRule<R | undefined> {
	readonly rule: SyntaxRule<R>

	constructor(
		rule: SyntaxRule<R>,
	) {
		super();

		this.rule = rule
	}

	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResultMatch<R | undefined> {
		const match = this.rule.tryMatch(tokens);
		if (match.kind === 'match') {
			return match;
		}

		return {
			kind: 'match',
			match: undefined
		}
	}

	toStringDepth(depth: number): string {
		let res = INDENT_CHAR.repeat(depth) + 'OPTIONAL\n';
		res += this.rule.toStringDepth(depth + 1);

		return res;
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
	// NOT readonly
	rule: SyntaxRule<R> | null

	constructor() {
		super();
		this.rule = null
	}

	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<R> {
		if (this.rule === null) {
			throw 'This method should never be called. This is an error in syntax rules definition.'
		}

		return this.rule.tryMatch(tokens);
	}

	toStringDepth(depth: number): string {
		if (this.rule === null) {
			throw 'This method should never be called. This is an error in syntax rules definition.'
		}

		if (depth > 10) {
			return INDENT_CHAR.repeat(depth) + 'possible recursion\n';
		} else {
			return this.rule.toStringDepth(depth);
		}
	}
}

/**
* Logs the execution of given rule.
*
* This rule is intended only for debugging.
*/
export class SyntaxRuleInspector<R> extends SyntaxRule<R> {
	readonly rule: SyntaxRule<R>

	constructor(rule: SyntaxRule<R>) {
		super()

		this.rule = rule;
	}

	tryMatch(tokens: BufferedIterator<LexerToken>): RuleResult<R> {
		const save = tokens.save();
		const nextThreeTokens = [
			tokens.next().value,
			tokens.next().value,
			tokens.next().value
		];
		console.debug('Executing\n', this.rule.toString(), 'on (first three tokens):', nextThreeTokens);
		tokens.restore(save);
		
		const match = this.rule.tryMatch(tokens);

		return match;
	}

	toStringDepth(depth: number): string {
		return this.rule.toStringDepth(depth);
	}
}