import { Source } from '../source';
import { Lexer } from './lexer';
import {
  CommentTokenData,
  DecoratorTokenData,
  DecoratorValue,
  formatTokenData,
  IdentifierTokenData,
  IdentifierValue,
  LexerToken,
  LexerTokenData,
  LexerTokenKind,
  LiteralTokenData,
  LiteralValue,
  OperatorTokenData,
  OperatorValue,
  SeparatorTokenData,
  SeparatorValue,
  StringTokenData,
  StringValue,
} from './token';

// Declare custom matcher for sake of Typescript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toHaveTokenData(data: LexerTokenData): R;
    }
  }
}
// Add the actual custom matcher
expect.extend({
  toHaveTokenData(actual: LexerToken, data: LexerTokenData) {
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
            (actual.data as SeparatorTokenData).separator !== data.separator
          ) {
            pass = false;
            message = errorMessage();
          }
          break;
        case LexerTokenKind.OPERATOR:
          if ((actual.data as OperatorTokenData).operator !== data.operator) {
            pass = false;
            message = errorMessage();
          }
          break;

        case LexerTokenKind.LITERAL:
          if ((actual.data as LiteralTokenData).literal !== data.literal) {
            pass = false;
            message = errorMessage();
          }
          break;

        case LexerTokenKind.STRING:
          if ((actual.data as StringTokenData).string !== data.string) {
            pass = false;
            message = errorMessage();
          }
          break;

        case LexerTokenKind.DECORATOR:
          if (
            (actual.data as DecoratorTokenData).decorator !== data.decorator
          ) {
            pass = false;
            message = errorMessage();
          }
          break;

        case LexerTokenKind.IDENTIFIER:
          if (
            (actual.data as IdentifierTokenData).identifier !== data.identifier
          ) {
            pass = false;
            message = errorMessage();
          }
          break;

        case LexerTokenKind.COMMENT:
          if ((actual.data as CommentTokenData).comment !== data.comment) {
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

      for (const expected of expectedTokens) {
        const actual = lexer.advance();

        expect(actual).toHaveTokenData({
          kind: LexerTokenKind.SEPARATOR,
          separator: expected,
        });
      }
    });

    it('operators', () => {
      const lexer = new Lexer(new Source(': ! + : | = - : ++ :: -- !! || =='));
      const expectedTokens: (LexerTokenData | OperatorValue)[] = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        ':',
        '!',
        '+',
        ':',
        '|',
        '=',
        '-',
        ':',
        '+',
        '+',
        ':',
        ':',
        '-',
        '-',
        '!',
        '!',
        '|',
        '|',
        '=',
        '=',
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (const expected of expectedTokens) {
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
        new Source('true false\n1 0x10 0xFa 0b10 0o10 10 10.1 1234 false')
      );
      const expectedTokens: (LexerTokenData | LiteralValue)[] = [
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
        false,
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (const expected of expectedTokens) {
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

    it('strings', () => {
      const lexer = new Lexer(
        new Source(
          `
          "asdf \\n \\" \\r \\t \\\\"
          """
          asdf block string "" ''
          """
          ""

          'asdf \\''
          '''
          asdf block string '' escaped
          '''
          ''
          `
        )
      );
      const expectedTokens: (LexerTokenData | StringValue)[] = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        'asdf \n " \r \t \\',
        'asdf block string "" \'\'',
        '',
        "asdf '",
        "asdf block string '' escaped",
        '',
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (const expected of expectedTokens) {
        const actual = lexer.advance();

        if (typeof expected === 'object') {
          expect(actual).toHaveTokenData(expected);
        } else {
          expect(actual).toHaveTokenData({
            kind: LexerTokenKind.STRING,
            string: expected,
          });
        }
      }
    });

    it('decorators', () => {
      const lexer = new Lexer(new Source('@safe @unsafe @idempotent @safe'));
      const expectedTokens: (LexerTokenData | DecoratorValue)[] = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        'safe',
        'unsafe',
        'idempotent',
        'safe',
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (const expected of expectedTokens) {
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

    it('soft keywords', () => {
      const lexer = new Lexer(
        new Source(
          'usecase field model input result async errors Number String \n\tBoolean Enum'
        )
      );
      const expectedTokens: (LexerTokenData | IdentifierValue)[] = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        'usecase',
        'field',
        'model',
        'input',
        'result',
        'async',
        'errors',
        'Number',
        'String',
        'Boolean',
        'Enum',
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (const expected of expectedTokens) {
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

    it('identifiers', () => {
      const lexer = new Lexer(
        new Source('ident my fier pls usecaseNOT modelout boolean b00lean a123456789_0')
      );
      const expectedTokens: (LexerTokenData | IdentifierValue)[] = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        'ident',
        'my',
        'fier',
        'pls',
        'usecaseNOT',
        'modelout',
        'boolean',
        'b00lean',
        'a123456789_0',
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (const expected of expectedTokens) {
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

    it('comments', () => {
      const lexer = new Lexer(
        new Source(`
        # line comment
        #
        asdf #  hi
        asdf
      `)
      );
      const expectedTokens: LexerTokenData[] = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        { kind: LexerTokenKind.COMMENT, comment: ' line comment' },
        { kind: LexerTokenKind.COMMENT, comment: '' },
        { kind: LexerTokenKind.IDENTIFIER, identifier: 'asdf' },
        { kind: LexerTokenKind.COMMENT, comment: '  hi' },
        { kind: LexerTokenKind.IDENTIFIER, identifier: 'asdf' },
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (const expected of expectedTokens) {
        const actual = lexer.advance();

        expect(actual).toHaveTokenData(expected);
      }
    });

    it('is valid complex', () => {
      const lexer = new Lexer(
        new Source(
          `'''
        Map store
        
        Definition of operations of the super-inteface map store. See http://superface.ai
        for more details.
        '''
        
        profile = "https://superface.ai/profiles/superface/Map"
        
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

      for (const token of lexer) {
        // console.debug(token.formatDebug());
        // Doesn't throw
        expect(token).toBeDefined();
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

    it('block string literal', () => {
      const lexer = new Lexer(new Source("'''asdf''"));
      expect(() => lexer.advance()).toThrow('Unexpected EOF');
    });

    it('string escape sequence', () => {
      const lexer = new Lexer(new Source('"asdf \\x"'));
      expect(() => lexer.advance()).toThrow('Invalid escape sequence');
    });

    it('decorator', () => {
      const lexer = new Lexer(new Source('@afe'));
      expect(() => lexer.advance()).toThrow(
        'Expected one of [safe, unsafe, idempotent]'
      );
    });

    it('identifiers starting with a number', () => {
      const lexer = new Lexer(new Source('1ident'));
      lexer.advance(); // SOF
      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.LITERAL,
        literal: 1
      });
      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.IDENTIFIER,
        identifier: 'ident'
      });
    });
  });

  describe('errors', () => {
    // Allow this lint error because we want to call `format` on the error object and check the output line-by-line
    /* eslint-disable jest/no-try-expect */
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

    /* eslint-enable jest/no-try-expect */
  });
});
