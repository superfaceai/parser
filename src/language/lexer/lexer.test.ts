import { Source } from '../source';
import { DEFAULT_TOKEN_KIND_FILER, Lexer, LexerContext } from './lexer';
import {
  CommentTokenData,
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
    const errorMessage: () => string = () => {
      const fmtExpected = formatTokenData(data);
      const fmtActual = formatTokenData(actual.data);

      return this.utils.printDiffOrStringify(
        `${fmtExpected.kind} ${fmtExpected.data}`,
        `${fmtActual.kind} ${fmtActual.data}`,
        'Expected',
        'Received',
        this.expand
      );
    };

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
        new Source(
          'ident my fier pls usecaseNOT modelout boolean b00lean a123456789_0'
        )
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
      `),
        {
          ...DEFAULT_TOKEN_KIND_FILER,
          [LexerTokenKind.COMMENT]: false,
        }
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
        usecase GetMap safe {
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
        usecase CreateMap unsafe {
          input {
            source
          }
          
          result: Map
        }
        
        '''
        Udpate Map
        
        Updates map source based on its URL
        '''
        usecase UpdateMap idempotent {
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
        usecase DeleteMap unsafe {
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
        field mapId String
        
        'Source code of the map'
        field source String
        
        'Direct "download" URL where the source code can be downloaded'
        field sourceUrl String`
        )
      );

      for (const token of lexer) {
        // console.debug(token.formatDebug());
        // Doesn't throw
        expect(token).toBeDefined();
      }
    });

    it('is valid map with scripts', () => {
      const lexer = new Lexer(
        new Source(
          `map test {
            foo = (function() { const foo = 1; return { foo: foo + 2, bar: Math.min(3, 4) }; })();
            bar = { x: 1, y: 2 };
            baz = true;
          }`
        )
      );

      const expectedTokens: LexerTokenData[] = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        { kind: LexerTokenKind.IDENTIFIER, identifier: 'map' },
        { kind: LexerTokenKind.IDENTIFIER, identifier: 'test' },
        { kind: LexerTokenKind.SEPARATOR, separator: '{' },

        { kind: LexerTokenKind.IDENTIFIER, identifier: 'foo' }, // 4
        { kind: LexerTokenKind.OPERATOR, operator: '=' },
        {
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script:
            '(function() { const foo = 1; return { foo: foo + 2, bar: Math.min(3, 4) }; })()',
        },
        { kind: LexerTokenKind.OPERATOR, operator: ';' },

        { kind: LexerTokenKind.IDENTIFIER, identifier: 'bar' }, // 8
        { kind: LexerTokenKind.OPERATOR, operator: '=' },
        { kind: LexerTokenKind.JESSIE_SCRIPT, script: '{ x: 1, y: 2 }' },
        { kind: LexerTokenKind.OPERATOR, operator: ';' },

        { kind: LexerTokenKind.IDENTIFIER, identifier: 'baz' }, // 12
        { kind: LexerTokenKind.OPERATOR, operator: '=' },
        { kind: LexerTokenKind.JESSIE_SCRIPT, script: 'true' },
        { kind: LexerTokenKind.OPERATOR, operator: ';' },

        { kind: LexerTokenKind.SEPARATOR, separator: '}' },
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];
      const contexts: { [N in number]: LexerContext | undefined } = {
        6: LexerContext.JESSIE_SCRIPT_EXPRESSION,
        10: LexerContext.JESSIE_SCRIPT_EXPRESSION,
        14: LexerContext.JESSIE_SCRIPT_EXPRESSION,
      };

      for (let i = 0; i < expectedTokens.length; i++) {
        const context = contexts[i];
        const actual = lexer.advance(context);
        const expected = expectedTokens[i];

        expect(actual).toHaveTokenData(expected);
      }
    });
  });

  describe('invalid', () => {
    it('number literal', () => {
      const lexer = new Lexer(new Source('0xx'));
      lexer.advance(); // skip SOF

      expect(() => lexer.advance()).toThrow(
        'Expected a number following integer base prefix'
      );
    });

    it('string literal', () => {
      const lexer = new Lexer(new Source('"asdf'));
      lexer.advance(); // skip SOF

      expect(() => lexer.advance()).toThrow('Unexpected EOF');
    });

    it('block string literal', () => {
      const lexer = new Lexer(new Source("'''asdf''"));
      lexer.advance(); // skip SOF

      expect(() => lexer.advance()).toThrow('Unexpected EOF');
    });

    it('string escape sequence', () => {
      const lexer = new Lexer(new Source('"asdf \\x"'));
      lexer.advance(); // skip SOF

      expect(() => lexer.advance()).toThrow('Invalid escape sequence');
    });

    it('identifiers starting with a number', () => {
      const lexer = new Lexer(new Source('1ident'));
      lexer.advance(); // SOF
      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.LITERAL,
        literal: 1,
      });
      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.IDENTIFIER,
        identifier: 'ident',
      });
    });

    it('Jessie non-expression with expression context', () => {
      const lexer = new Lexer(new Source('var f = 1;'));

      lexer.advance(); // SOF

      expect(() =>
        lexer.advance(LexerContext.JESSIE_SCRIPT_EXPRESSION)
      ).toThrowError('Expression expected.');
    });
  });
});
