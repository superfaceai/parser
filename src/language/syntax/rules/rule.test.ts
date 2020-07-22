import { LexerToken, LexerTokenData, LexerTokenKind } from '../../lexer/token';
import { BufferedIterator } from '../util';
import { LexerTokenMatch, SyntaxRule } from './rule';

// Ensures that token spans are correctly ordered
let TES_TOK_STATE = 0;
beforeEach(() => {
  TES_TOK_STATE = 0;
});
function tesTok(data: LexerTokenData): LexerToken {
  const start = Math.floor(Math.random() * 1000) + TES_TOK_STATE * 10000;
  const end = start + Math.floor(Math.random() * 100);

  const line = Math.floor(Math.random() * 500);
  const column = Math.floor(Math.random() * 80);

  TES_TOK_STATE += 1;

  return new LexerToken(data, { start, end }, { line, column });
}
function tokMatch(token: LexerToken): LexerTokenMatch {
  return {
    data: token.data,
    span: token.span,
    location: token.location,
  };
}

describe('syntax rule factory', () => {
  describe('separator', () => {
    it('should match separator rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.separator();

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it('should match separator rule with filter', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.separator('[');

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it("shouldn't match operator rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.separator(']');

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'nomatch',
        attempt: {
          rule,
          token: tokens[0],
        },
      });
    });
  });

  describe('operator', () => {
    it('should match operator rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '+' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.operator();

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it('should match operator rule with filter', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '+' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.operator('+');

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it("shouldn't match operator rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '+' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.operator('-');

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'nomatch',
        attempt: {
          rule,
          token: tokens[0],
        },
      });
    });
  });

  describe('identifier', () => {
    it('should match identifier rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.identifier();

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it('should match identifier rule with filter', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.identifier('usecase');

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it("shouldn't match identifier rule with filter", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.identifier('field');

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'nomatch',
        attempt: {
          rule,
          token: tokens[0],
        },
      });
    });

    it("shouldn't match identififer rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.DECORATOR, decorator: 'safe' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.identifier();

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'nomatch',
        attempt: {
          rule,
          token: tokens[0],
        },
      });
    });
  });

  describe('literal', () => {
    it('should match literal rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 12 }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.literal();

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });
  });

  describe('string', () => {
    it('should match string rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'asfg I am a string' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.string();

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });
  });

  describe('decorator', () => {
    it('should match decorator rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.DECORATOR, decorator: 'safe' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.decorator();

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it('should match decorator rule with filter', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.DECORATOR, decorator: 'safe' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.decorator('safe');

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });
  });

  describe('or', () => {
    it('should match first rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.identifier().or(SyntaxRule.literal());

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it('should match second rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.identifier().or(SyntaxRule.literal());

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it('should match third rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.DECORATOR, decorator: 'safe' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.identifier()
        .or(SyntaxRule.literal())
        .or(SyntaxRule.decorator('safe'));

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it("shouldn't match any rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.DECORATOR, decorator: 'safe' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.identifier().or(SyntaxRule.literal());

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'nomatch',
        attempt: {
          rule,
          token: tokens[0],
        },
      });
    });
  });

  describe('followed by', () => {
    it('should match three rules', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.identifier('result')
        .followedBy(SyntaxRule.operator(':'))
        .andBy(SyntaxRule.literal());

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: [tokMatch(tokens[0]), tokMatch(tokens[1]), tokMatch(tokens[2])],
        optionalFailure: undefined,
      });
    });

    it("shouldn't match first rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const firstRule = SyntaxRule.identifier('field');
      const rule = firstRule
        .followedBy(SyntaxRule.operator(':'))
        .andBy(SyntaxRule.literal());

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'nomatch',
        attempt: {
          rule: firstRule,
          token: tokens[0],
        },
      });
    });

    it("shouldn't match second rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const secondRule = SyntaxRule.operator('+');
      const rule = SyntaxRule.identifier('result')
        .followedBy(secondRule)
        .andBy(SyntaxRule.literal());

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'nomatch',
        attempt: {
          rule: secondRule,
          token: tokens[1],
        },
        optionalFailure: undefined,
      });
    });

    it("shouldn't match third rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const thirdRule = SyntaxRule.identifier();
      const rule = SyntaxRule.identifier('result')
        .followedBy(SyntaxRule.operator(':'))
        .andBy(thirdRule);

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'nomatch',
        attempt: {
          rule: thirdRule,
          token: tokens[2],
        },
        optionalFailure: undefined,
      });
    });
  });

  describe('repeat', () => {
    it('should match 1 repetition', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const innerRule = SyntaxRule.identifier('field').followedBy(
        SyntaxRule.identifier()
      );
      const rule = SyntaxRule.repeat(innerRule);

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: [[tokMatch(tokens[0]), tokMatch(tokens[1])]],
        optionalFailure: {
          rule: innerRule,
          token: undefined,
        },
      });
    });

    it('should match 3 repetititons', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const innerRule = SyntaxRule.identifier('field').followedBy(
        SyntaxRule.identifier()
      );
      const rule = SyntaxRule.repeat(innerRule);

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: [
          [tokMatch(tokens[0]), tokMatch(tokens[1])],
          [tokMatch(tokens[2]), tokMatch(tokens[3])],
          [tokMatch(tokens[4]), tokMatch(tokens[5])],
        ],
        optionalFailure: {
          rule: innerRule,
          token: undefined,
        },
      });
    });

    it("shouldn't match 0 repetitions", () => {
      const tokens: ReadonlyArray<LexerToken> = [];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = SyntaxRule.repeat(SyntaxRule.identifier());

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'nomatch',
        attempt: {
          rule,
          token: undefined,
        },
        optionalFailure: undefined,
      });
    });
  });

  describe('optional', () => {
    it('should match 0 or more repetitions', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const innerRule = SyntaxRule.identifier('field');
      const repeatRule = SyntaxRule.repeat(innerRule);
      const rule = SyntaxRule.optional(repeatRule);

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: [tokMatch(tokens[0]), tokMatch(tokens[1]), tokMatch(tokens[2])],
        optionalFailure: {
          rule: innerRule,
          token: undefined,
        },
      });
      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: undefined,
        optionalFailure: {
          rule: repeatRule,
          token: undefined,
        },
      });
    });
  });
});
