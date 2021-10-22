import { SyntaxError } from '../error';
import { Source } from '../source';
import { MatchAttempts } from '../syntax/rule';
import {
  formatTokenData,
  formatTokenKind,
  LexerToken,
  LexerTokenData,
  LexerTokenKind,
} from './token';

describe('token', () => {
  describe('formatTokenKind', () => {
    it('formats token kind', () => {
      expect(formatTokenKind(LexerTokenKind.UNKNOWN)).toEqual('unknown');
      expect(formatTokenKind(LexerTokenKind.SEPARATOR)).toEqual('separator');
      expect(formatTokenKind(LexerTokenKind.OPERATOR)).toEqual('operator');
      expect(formatTokenKind(LexerTokenKind.LITERAL)).toEqual(
        'number or boolean literal'
      );
      expect(formatTokenKind(LexerTokenKind.STRING)).toEqual('string');
      expect(formatTokenKind(LexerTokenKind.IDENTIFIER)).toEqual('identifier');
      expect(formatTokenKind(LexerTokenKind.COMMENT)).toEqual('comment');
      expect(formatTokenKind(LexerTokenKind.NEWLINE)).toEqual('newline');
      expect(formatTokenKind(LexerTokenKind.JESSIE_SCRIPT)).toEqual(
        'jessie script'
      );
    });
  });

  describe('formatTokenData', () => {
    let data: LexerTokenData;

    it('formats unknown token data', () => {
      data = {
        kind: LexerTokenKind.UNKNOWN,
        error: SyntaxError.fromSyntaxRuleNoMatch(
          new Source('mock-content', 'mock/path'),
          {
            kind: 'nomatch',
            attempts: {
              token: undefined,
              rules: [],
            } as unknown as MatchAttempts,
          }
        ),
      };
      expect(formatTokenData(data)).toEqual({
        kind: 'unknown',
        data: 'unknown',
      });
    });
    it('formats separator token data', () => {
      data = {
        kind: LexerTokenKind.SEPARATOR,
        separator: '(',
      };
      expect(formatTokenData(data)).toEqual({ kind: 'separator', data: '(' });
    });

    it('formats operator token data', () => {
      data = {
        kind: LexerTokenKind.OPERATOR,
        operator: ':',
      };
      expect(formatTokenData(data)).toEqual({ kind: 'operator', data: ':' });
    });
    it('formats literal token data', () => {
      data = {
        kind: LexerTokenKind.LITERAL,
        literal: 86,
      };

      expect(formatTokenData(data)).toEqual({
        kind: 'number or boolean literal',
        data: '86',
      });
    });
    it('formats string token data', () => {
      data = {
        kind: LexerTokenKind.STRING,
        string: 'test',
      };

      expect(formatTokenData(data)).toEqual({ kind: 'string', data: 'test' });
    });

    it('formats identifier token data', () => {
      data = {
        kind: LexerTokenKind.IDENTIFIER,
        identifier: 'test',
      };

      expect(formatTokenData(data)).toEqual({
        kind: 'identifier',
        data: 'test',
      });
    });

    it('formats comment token data', () => {
      data = {
        kind: LexerTokenKind.COMMENT,
        comment: 'test',
      };

      expect(formatTokenData(data)).toEqual({ kind: 'comment', data: 'test' });
    });

    it('formats newline token data', () => {
      data = {
        kind: LexerTokenKind.NEWLINE,
      };

      expect(formatTokenData(data)).toEqual({ kind: 'newline', data: '\n' });
    });

    it('formats  token data', () => {
      data = {
        kind: LexerTokenKind.JESSIE_SCRIPT,
        script: 'test-value',
        sourceScript: 'test-source',
        sourceMap: 'test-map',
      };

      expect(formatTokenData(data)).toEqual({
        kind: 'jessie script',
        data: 'test-value',
      });
    });
  });

  describe('LexerToken', () => {
    const sofInstance = new LexerToken(
      {
        kind: LexerTokenKind.SEPARATOR,
        separator: 'SOF',
      },
      {
        start: {
          line: 1,
          column: 2,
          charIndex: 3
        },
        end: {
          line: 4,
          column: 5,
          charIndex: 6
        }
      }
    );

    const eofInstance = new LexerToken(
      {
        kind: LexerTokenKind.SEPARATOR,
        separator: 'EOF',
      },
      {
        start: {
          line: 1,
          column: 2,
          charIndex: 3
        },
        end: {
          line: 4,
          column: 5,
          charIndex: 6
        }
      }
    );
    it('checks if instance is SOF separator', () => {
      expect(sofInstance.isSOF()).toEqual(true);
      expect(eofInstance.isSOF()).toEqual(false);
    });

    it('checks if instance is EOF separator', () => {
      expect(eofInstance.isEOF()).toEqual(true);
      expect(sofInstance.isEOF()).toEqual(false);
    });

    it('returns debug string', () => {
      expect(sofInstance.toStringDebug()).toEqual(
        '{separator `SOF`}@(1:2;4:5)[3;6]'
      );
      expect(eofInstance.toStringDebug()).toEqual(
        '{separator `EOF`}@(1:2;4:5)[3;6]'
      );
    });
  });
});
