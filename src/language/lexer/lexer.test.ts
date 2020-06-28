import { Lexer } from './lexer';
import {
  LexerTokenKind,
  SeparatorTokenData,
  OperatorTokenData,
  LiteralTokenData,
  DecoratorTokenData,
  LexerTokenData,
  LexerToken,
  KeywordTokenData,
  IdentifierTokenData,
  CommentTokenData,
  SeparatorValue,
  formatTokenData,
  LexerTokenDataType,
} from './token';
import { Source } from '../source';

// Declare custom matcher for sake of Typescript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toHaveTokenData<D extends LexerTokenData>(data: D): R;
    }
  }
}
// Add the actual custom matcher
expect.extend({
  toHaveTokenData(actual: LexerToken, data: LexerTokenDataType) {
    function errorMessage(): string {
      return `Expected (${formatTokenData(
        data
      )}) but found ${actual.formatDebug()}`;
    }

    let pass = true;
    let message = `Expected something else than ${formatTokenData(data)}`;

    if (actual.data.kind !== data.kind) {
      pass = false;
      message = errorMessage();
    } else {
      switch (data.kind) {
        case LexerTokenKind.SEPARATOR:
          if (
            (actual.data as SeparatorTokenData).separator !==
            (data as SeparatorTokenData).separator
          ) {
            pass = false;
            message = errorMessage();
          }
          break;
        case LexerTokenKind.OPERATOR:
          if (
            (actual.data as OperatorTokenData).operator !==
            (data as OperatorTokenData).operator
          ) {
            pass = false;
            message = errorMessage();
          }
          break;

        case LexerTokenKind.LITERAL:
          if (
            (actual.data as LiteralTokenData).literal !==
            (data as LiteralTokenData).literal
          ) {
            pass = false;
            message = errorMessage();
          }
          break;

        case LexerTokenKind.DECORATOR:
          if (
            (actual.data as DecoratorTokenData).decorator !==
            (data as DecoratorTokenData).decorator
          ) {
            pass = false;
            message = errorMessage();
          }
          break;

        case LexerTokenKind.KEYWORD:
          if (
            (actual.data as KeywordTokenData).keyword !==
            (data as KeywordTokenData).keyword
          ) {
            pass = false;
            message = errorMessage();
          }
          break;

        case LexerTokenKind.IDENTIFIER:
          if (
            (actual.data as IdentifierTokenData).identifier !==
            (data as IdentifierTokenData).identifier
          ) {
            pass = false;
            message = errorMessage();
          }
          break;

        case LexerTokenKind.COMMENT:
          if (
            (actual.data as CommentTokenData).comment !==
            (data as CommentTokenData).comment
          ) {
            pass = false;
            message = errorMessage();
          }
          break;
      }
    }

    return {
      pass,
      message: (): string => message,
    };
  },
});

describe('lexer', () => {
  describe('valid', () => {
    it('separators', () => {
      const lexer = new Lexer(new Source('[( {  )\n}(\t \t(	[ ]]))'));
      const expectedTokens: ReadonlyArray<SeparatorValue> = [
        'SOF',
        '[',
        '(',
        '{',
        ')',
        '}',
        '(',
        '(',
        '[',
        ']',
        ']',
        ')',
        ')',
        'EOF',
      ];

      for (let expected of expectedTokens) {
        const actual = lexer.advance();

        expect(actual).toHaveTokenData({
          kind: LexerTokenKind.SEPARATOR,
          separator: expected,
        });
      }
    });

    it('operators', () => {
      const lexer = new Lexer(new Source(': + : - : ++ :: --'));
      const expectedTokens = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        ':',
        '+',
        ':',
        '-',
        ':',
        '+',
        '+',
        ':',
        ':',
        '-',
        '-',
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (let expected of expectedTokens) {
        const actual = lexer.advance();

        if (typeof expected === 'object') {
          expect(actual).toHaveTokenData(expected);
        } else {
          expect(actual).toHaveTokenData({
            kind: LexerTokenKind.OPERATOR,
            operator: expected,
          });
        }
      }
    });

    it('literals', () => {
      const lexer = new Lexer(
        new Source(
          'true false\n1 0x10 0xFa 0b10 0o10 10 10.1 1234 "abcd" false'
        )
      );
      const expectedTokens = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        true,
        false,
        1,
        16,
        250,
        2,
        8,
        10,
        10.1,
        1234,
        'abcd',
        false,
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (let expected of expectedTokens) {
        const actual = lexer.advance();

        if (typeof expected === 'object') {
          expect(actual).toHaveTokenData(expected);
        } else {
          expect(actual).toHaveTokenData({
            kind: LexerTokenKind.LITERAL,
            literal: expected,
          });
        }
      }
    });

    it('decorators', () => {
      const lexer = new Lexer(new Source('@safe @unsafe @idempotent @safe'));
      const expectedTokens = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        'safe',
        'unsafe',
        'idempotent',
        'safe',
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (let expected of expectedTokens) {
        const actual = lexer.advance();

        if (typeof expected === 'object') {
          expect(actual).toHaveTokenData(expected);
        } else {
          expect(actual).toHaveTokenData({
            kind: LexerTokenKind.DECORATOR,
            decorator: expected,
          });
        }
      }
    });

    it('keywords', () => {
      const lexer = new Lexer(
        new Source('usecase field map Number String \n\tBoolean')
      );
      const expectedTokens = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        'usecase',
        'field',
        'map',
        'Number',
        'String',
        'Boolean',
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (let expected of expectedTokens) {
        const actual = lexer.advance();

        if (typeof expected === 'object') {
          expect(actual).toHaveTokenData(expected);
        } else {
          expect(actual).toHaveTokenData({
            kind: LexerTokenKind.KEYWORD,
            keyword: expected,
          });
        }
      }
    });

    it('identifiers', () => {
      const lexer = new Lexer(new Source('ident my fier pls'));
      const expectedTokens = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        'ident',
        'my',
        'fier',
        'pls',
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (let expected of expectedTokens) {
        const actual = lexer.advance();

        if (typeof expected === 'object') {
          expect(actual).toHaveTokenData(expected);
        } else {
          expect(actual).toHaveTokenData({
            kind: LexerTokenKind.IDENTIFIER,
            identifier: expected,
          });
        }
      }
    });

    it('docs', () => {
      const lexer = new Lexer(
        new Source(`
        'line doc comment'
        '''
        block doc comment

        stuff
        '''
        ''''''as 'a zxc ''awe 'z 's''''' was''''''
      `)
      );
      const expectedTokens = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        { kind: LexerTokenKind.DOC, doc: 'line doc comment' },
        {
          kind: LexerTokenKind.DOC,
          doc: `block doc comment

        stuff`,
        },
        {
          kind: LexerTokenKind.DOC,
          doc: `as 'a zxc ''awe 'z 's''''' was`,
        },
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (let expected of expectedTokens) {
        const actual = lexer.advance();

        expect(actual).toHaveTokenData(expected);
      }
    });

    it('comments', () => {
      const lexer = new Lexer(
        new Source(`
        # line comment
        #
        asdf #  hi
        asdf
      `)
      );
      const expectedTokens = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        { kind: LexerTokenKind.COMMENT, comment: ' line comment' },
        { kind: LexerTokenKind.COMMENT, comment: '' },
        { kind: LexerTokenKind.IDENTIFIER, identifier: 'asdf' },
        { kind: LexerTokenKind.COMMENT, comment: '  hi' },
        { kind: LexerTokenKind.IDENTIFIER, identifier: 'asdf' },
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (let expected of expectedTokens) {
        const actual = lexer.advance();

        expect(actual).toHaveTokenData(expected);
      }
    });

    xit('complex', () => {
      const lexer = new Lexer(
        new Source(
          `'''
        Map store
        
        Definition of operations of the super-inteface map store. See http://superface.ai
        for more details.
        '''
        
        profile: "https://superface.ai/profiles/superface/Map"
        
        #
        # Use cases
        #
        
        '''
        Get Map
        
        Retrieves a map based on its URL (id)
        '''
        usecase GetMap @safe {
          input {
            mapId
          }
          
          result {
            mapId
            sourceUrl
            source
          }
        }
        
        
        '''
        Create Map
        
        Creates new map from the map source and assigns a store URL to it
        '''
        usecase CreateMap @unsafe {
          input {
            source
          }
          
          result: Map
        }
        
        '''
        Udpate Map
        
        Updates map source based on its URL
        '''
        usecase UpdateMap @idempotent {
          input {
            mapId
            source
          }
        
          result: Map
        }
        
        '''
        Delete Map
        
        Deletes map based on its URL
        '''
        usecase DeleteMap @unsafe {
          input {
            mapId
          }
        }
        
        #
        # Reusable Models
        #
        
        model Map {
          mapId
          source
          sourceUrl
        }
        
        #
        # Reusable Fields
        #
        
        'Id of the map in the store'
        field mapId: String
        
        'Source code of the map'
        field source: String
        
        'Direct "download" URL where the source code can be downloaded'
        field sourceUrl: String`
        )
      );

      for (let token of lexer.generator()) {
        console.debug(token.formatDebug());
      }
    });
  });

  describe('invalid', () => {
    it('number literal', () => {
      const lexer = new Lexer(new Source('0xx'));
      expect(() => lexer.advance()).toThrow(
        'Expected a number following integer base prefix'
      );
    });

    it('string literal', () => {
      const lexer = new Lexer(new Source('"asdf'));
      expect(() => lexer.advance()).toThrow('Unexpected EOF');
    });

    it('decorator', () => {
      const lexer = new Lexer(new Source('@afe'));
      expect(() => lexer.advance()).toThrow(
        'Expected one of [safe, unsafe, idempotent]'
      );
    });

    it('doc string', () => {
      const lexer = new Lexer(new Source("'asdf"));
      expect(() => lexer.advance()).toThrow('Unexpected EOF');
    });
  });

  describe('errors', () => {
    it('before', () => {
      const lexer = new Lexer(new Source('before\n\t@safes'));
      try {
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
      } catch (e) {
        const formatLines = e.format().split('\n');
        expect(formatLines[0]).toMatch(
          'SyntaxError: Expected one of [safe, unsafe, idempotent]'
        );

        expect(formatLines[1]).toMatch(' --> [input]:2:2');

        expect(formatLines[2]).toMatch('1 | before');
        expect(formatLines[3]).toMatch('2 | \t@safes');
        expect(formatLines[4]).toMatch(' | \t^^    ');
      }
    });

    it('after', () => {
      const lexer = new Lexer(new Source('\t0xx\nafter'));
      try {
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
      } catch (e) {
        const formatLines = e.format().split('\n');
        expect(formatLines[0]).toMatch(
          'SyntaxError: Expected a number following integer base prefix'
        );

        expect(formatLines[1]).toMatch(' --> [input]:1:2');

        expect(formatLines[2]).toMatch('1 | \t0xx');
        expect(formatLines[3]).toMatch(' | \t^^^');
        expect(formatLines[4]).toMatch('2 | after');
      }
    });

    it('before and after', () => {
      const lexer = new Lexer(new Source('before\n\t@safes\nafter'));
      try {
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
      } catch (e) {
        const formatLines = e.format().split('\n');
        expect(formatLines[0]).toMatch(
          'SyntaxError: Expected one of [safe, unsafe, idempotent]'
        );

        expect(formatLines[1]).toMatch(' --> [input]:2:2');

        expect(formatLines[2]).toMatch('1 | before');
        expect(formatLines[3]).toMatch('2 | \t@safes');
        expect(formatLines[4]).toMatch(' | \t^^    ');
        expect(formatLines[5]).toMatch('3 | after');
      }
    });

    it('neither before nor after', () => {
      const lexer = new Lexer(new Source('\t@safes'));
      try {
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
      } catch (e) {
        const formatLines = e.format().split('\n');
        expect(formatLines[0]).toMatch(
          'SyntaxError: Expected one of [safe, unsafe, idempotent]'
        );

        expect(formatLines[1]).toMatch(' --> [input]:1:2');

        expect(formatLines[2]).toMatch('1 | \t@safes');
        expect(formatLines[3]).toMatch(' | \t^^    ');
      }
    });
  });
});
