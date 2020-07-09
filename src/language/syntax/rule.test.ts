import { BufferedIterator } from "./util";
import { LexerToken, LexerTokenKind, LexerTokenData } from "../lexer/token";
import { SyntaxRule, LexerTokenMatch } from './rule';

// Ensures that token spans are correctly ordered
let TES_TOK_STATE = 0
beforeEach(() => {
	TES_TOK_STATE = 0
})
function tesTok(data: LexerTokenData): LexerToken {
	const start = Math.floor(Math.random() * 1000) + TES_TOK_STATE * 10000;
	const end = start + Math.floor(Math.random() * 100);

	const line = Math.floor(Math.random() * 500);
	const column = Math.floor(Math.random() * 80);

	TES_TOK_STATE += 1;

	return new LexerToken(
		data,
		{ start, end },
		{ line, column }
	)
}
function tokMatch(token: LexerToken): LexerTokenMatch {
	return {
		data: token.data,
		span: token.span,
		location: token.location
	}
}

describe('syntax rule factory', () => {
	describe('separator', () => {
		it('should match separator rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.separator();

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});

		it('should match separator rule with filter', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.separator('[');

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});

		it('shouldn\'t match operator rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.separator(']');

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'nomatch',
					rule,
					token: tokens[0]
				}
			)
		});
	});
	
	describe('operator', () => {
		it('should match operator rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: '+' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.operator();

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});

		it('should match operator rule with filter', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: '+' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.operator('+');

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});

		it('shouldn\'t match operator rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: '+' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.operator('-');

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'nomatch',
					rule: rule,
					token: tokens[0]
				}
			)
		});
	});
	
	describe('identifier', () => {
		it('should match identifier rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.identifier();
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});
	});
	
	describe('literal', () => {
		it('should match literal rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.LITERAL, literal: 12 })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.literal();
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});
	})

	describe('string', () => {
		it('should match string rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.STRING, string: 'asfg I am a string' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.string();
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});
	})

	describe('decorator', () => {
		it('should match decorator rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.DECORATOR, decorator: 'safe' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.decorator();
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});
		
		it('should match decorator rule with filter', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.DECORATOR, decorator: 'safe' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.decorator('safe');
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});
	})
	
	describe('keyword', () => {
		it('shouldn\'t match keyword', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.DECORATOR, decorator: 'safe' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.keyword();
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'nomatch',
					rule,
					token: tokens[0]
				}
			)
		});
		
		it('should match keyword rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'field' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.keyword();
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});
		
		it('should match keyword rule with filter', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'usecase' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.keyword('usecase');
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});
	
		it('shouldn\'t match keyword rule with filter', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'usecase' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.keyword('field');
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'nomatch',
					rule,
					token: tokens[0]
				}
			)
		});
	});

	describe('or', () => {
		it('should match first rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.identifier().or(SyntaxRule.literal());
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});

		it('should match second rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.identifier().or(SyntaxRule.literal());
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});

		it('should match third rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'usecase' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.identifier().or(SyntaxRule.literal()).or(SyntaxRule.keyword('usecase'));
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tokMatch(tokens[0])
				}
			)
		});

		it('shouldn\'t match any rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'result' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.identifier().or(SyntaxRule.literal());
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'nomatch',
					rule,
					token: tokens[0]
				}
			)
		});
	});

	describe('followed by', () => {
		it('should match three rules', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'result' }),
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
				tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.keyword('result').followedBy(
				SyntaxRule.operator(':')
			).andBy(
				SyntaxRule.literal()
			)
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: [tokMatch(tokens[0]), tokMatch(tokens[1]), tokMatch(tokens[2])]
				}
			)
		});

		it('shouldn\'t match first rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'result' }),
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
				tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const firstRule = SyntaxRule.keyword('field')
			const rule = firstRule.followedBy(
				SyntaxRule.operator(':')
			).followedBy(
				SyntaxRule.literal()
			)

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'nomatch',
					rule: firstRule,
					token: tokens[0]
				}
			)
		});

		it('shouldn\'t match second rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				new LexerToken({ kind: LexerTokenKind.KEYWORD, keyword: 'result' }, { start: 0, end: 6 }, { line: 0, column: 0 }),
				new LexerToken({ kind: LexerTokenKind.OPERATOR, operator: ':' }, { start: 6, end: 7 }, { line: 0, column: 0 }),
				new LexerToken({ kind: LexerTokenKind.LITERAL, literal: 1 }, { start: 8, end: 9 }, { line: 0, column: 0 })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
			
			const secondRule = SyntaxRule.operator('+')
			const rule = SyntaxRule.keyword('result').followedBy(
				secondRule
			).followedBy(
				SyntaxRule.literal()
			)

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'nomatch',
					rule: secondRule,
					token: tokens[1]
				}
			)
		});

		it('shouldn\'t match third rule', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'result' }),
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
				tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const thirdRule = SyntaxRule.identifier()
			const rule = SyntaxRule.keyword('result').followedBy(
				SyntaxRule.operator(':')
			).followedBy(
				thirdRule
			)

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'nomatch',
					rule: thirdRule,
					token: tokens[2]
				}
			)
		});
	});

	describe('repeat', () => {
		it('should match 1 repetition', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'field' }), tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.repeat(
				SyntaxRule.keyword().followedBy(
					SyntaxRule.identifier()
				)
			)
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: [
						[tokMatch(tokens[0]), tokMatch(tokens[1])]
					]
				}
			)
		});

		it('should match 3 repetititons', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'field' }), tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' }),
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'field' }), tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' }),
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'field' }), tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.repeat(
				SyntaxRule.keyword().followedBy(
					SyntaxRule.identifier()
				)
			)
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: [
						[tokMatch(tokens[0]), tokMatch(tokens[1])],
						[tokMatch(tokens[2]), tokMatch(tokens[3])],
						[tokMatch(tokens[4]), tokMatch(tokens[5])]
					]
				}
			)
		});

		it('shouldn\'t match 0 repetitions', () => {
			const tokens: ReadonlyArray<LexerToken> = []
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const innerRule = SyntaxRule.keyword()
			const rule = SyntaxRule.repeat(
				innerRule
			)
	
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'nomatch',
					rule: innerRule,
					token: undefined
				}
			)
		});
	});

	describe('optional', () => {
		it('should match 0 or more repetitions', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'field' }),
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'field' }),
				tesTok({ kind: LexerTokenKind.KEYWORD, keyword: 'field' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)
	
			const rule = SyntaxRule.optional(
				SyntaxRule.repeat(
					SyntaxRule.keyword()
				)
			)

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: [
						tokMatch(tokens[0]),
						tokMatch(tokens[1]),
						tokMatch(tokens[2])
					]
				}
			)
			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: undefined
				}
			)
		});
	});
})