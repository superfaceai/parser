import { LexerToken, LexerTokenData, LexerTokenKind } from '../../lexer/token';
import { ArrayLexerStream } from '../util';
import { LexerTokenMatch, MatchAttempts, SyntaxRule } from './rule';

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
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.separator();

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it('should match separator rule with filter', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.separator('[');

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it("shouldn't match operator rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.separator(']');

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'nomatch',
        attempts: new MatchAttempts(tokens[0], [rule]),
      });
    });
  });

  describe('operator', () => {
    it('should match operator rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '+' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.operator();

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it('should match operator rule with filter', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '+' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.operator('+');

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it("shouldn't match operator rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '+' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.operator('-');

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'nomatch',
        attempts: new MatchAttempts(tokens[0], [rule]),
      });
    });
  });

  describe('identifier', () => {
    it('should match identifier rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.identifier();

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it('should match identifier rule with filter', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.identifier('usecase');

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it("shouldn't match identifier rule with filter", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.identifier('field');

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'nomatch',
        attempts: new MatchAttempts(tokens[0], [rule]),
      });
    });

    it("shouldn't match identififer rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '@' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.identifier();

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'nomatch',
        attempts: new MatchAttempts(tokens[0], [rule]),
      });
    });
  });

  describe('literal', () => {
    it('should match literal rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 12 }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.literal();

      expect(rule.tryMatch(stream)).toStrictEqual({
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
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.string();

      expect(rule.tryMatch(stream)).toStrictEqual({
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
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.identifier().or(SyntaxRule.literal());

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
      });
    });

    it('should match second rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const firstRule = SyntaxRule.identifier();
      const rule = firstRule.or(SyntaxRule.literal());

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
        optionalAttempts: new MatchAttempts(tokens[0], [firstRule]),
      });
    });

    it('should match third rule', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '@' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const firstRule = SyntaxRule.identifier();
      const secondRule = SyntaxRule.literal();
      const rule = firstRule.or(secondRule).or(SyntaxRule.operator('@'));

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: tokMatch(tokens[0]),
        optionalAttempts: new MatchAttempts(tokens[0], [firstRule, secondRule]),
      });
    });

    it("shouldn't match any rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'string' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const firstRule = SyntaxRule.identifier();
      const secondRule = SyntaxRule.literal();
      const rule = firstRule.or(secondRule);

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'nomatch',
        attempts: new MatchAttempts(tokens[0], [firstRule, secondRule]),
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
      const stream = new ArrayLexerStream(tokens);

      const rule = SyntaxRule.identifier('result')
        .followedBy(SyntaxRule.operator(':'))
        .andBy(SyntaxRule.literal());

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: [tokMatch(tokens[0]), tokMatch(tokens[1]), tokMatch(tokens[2])],
        optionalAttempts: undefined,
      });
    });

    it("shouldn't match first rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const firstRule = SyntaxRule.identifier('field');
      const rule = firstRule
        .followedBy(SyntaxRule.operator(':'))
        .andBy(SyntaxRule.literal());

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'nomatch',
        attempts: new MatchAttempts(tokens[0], [firstRule]),
      });
    });

    it("shouldn't match second rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const secondRule = SyntaxRule.operator('+');
      const rule = SyntaxRule.identifier('result')
        .followedBy(secondRule)
        .andBy(SyntaxRule.literal());

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'nomatch',
        attempts: new MatchAttempts(tokens[1], [secondRule]),
      });
    });

    it("shouldn't match third rule", () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const thirdRule = SyntaxRule.identifier();
      const rule = SyntaxRule.identifier('result')
        .followedBy(SyntaxRule.operator(':'))
        .andBy(thirdRule);

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'nomatch',
        attempts: new MatchAttempts(tokens[2], [thirdRule]),
      });
    });
  });

  describe('repeat', () => {
    it('should match 1 repetition', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'identifier' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const firstRule = SyntaxRule.identifier('field');
      const rule = SyntaxRule.repeat(
        firstRule.followedBy(SyntaxRule.identifier())
      );

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: [[tokMatch(tokens[0]), tokMatch(tokens[1])]],
        optionalAttempts: new MatchAttempts(undefined, [firstRule]),
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
      const stream = new ArrayLexerStream(tokens);

      const firstRule = SyntaxRule.identifier('field');
      const rule = SyntaxRule.repeat(
        firstRule.followedBy(SyntaxRule.identifier())
      );

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: [
          [tokMatch(tokens[0]), tokMatch(tokens[1])],
          [tokMatch(tokens[2]), tokMatch(tokens[3])],
          [tokMatch(tokens[4]), tokMatch(tokens[5])],
        ],
        optionalAttempts: new MatchAttempts(undefined, [firstRule]),
      });
    });

    it("shouldn't match 0 repetitions", () => {
      const tokens: ReadonlyArray<LexerToken> = [];
      const stream = new ArrayLexerStream(tokens);

      const innerRule = SyntaxRule.identifier();
      const rule = SyntaxRule.repeat(innerRule);

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'nomatch',
        attempts: new MatchAttempts(undefined, [innerRule]),
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
      const stream = new ArrayLexerStream(tokens);

      const innerRule = SyntaxRule.identifier('field');
      const rule = SyntaxRule.optional(SyntaxRule.repeat(innerRule));

      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: [tokMatch(tokens[0]), tokMatch(tokens[1]), tokMatch(tokens[2])],
        optionalAttempts: new MatchAttempts(undefined, [innerRule]),
      });
      expect(rule.tryMatch(stream)).toStrictEqual({
        kind: 'match',
        match: undefined,
        optionalAttempts: new MatchAttempts(undefined, [innerRule]),
      });
    });
  });
});
