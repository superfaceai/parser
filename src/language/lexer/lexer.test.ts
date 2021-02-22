import { Source } from '../source';
import { LexerContext, LexerContextType } from './context';
import { DEFAULT_TOKEN_KIND_FILTER, Lexer } from './lexer';
import {
  CommentTokenData,
  formatTokenData,
  IdentifierTokenData,
  IdentifierValue,
  JessieScriptTokenData,
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
    let message: string;

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

        case LexerTokenKind.JESSIE_SCRIPT:
          if ((actual.data as JessieScriptTokenData).script !== data.script) {
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
    test('separators', () => {
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

    test('operators', () => {
      const lexer = new Lexer(new Source(': ! : | = : :: !! || == , @,@@'));
      const expectedTokens: (LexerTokenData | OperatorValue)[] = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        ':',
        '!',
        ':',
        '|',
        '=',
        ':',
        ':',
        ':',
        '!',
        '!',
        '|',
        '|',
        '=',
        '=',
        ',',
        '@',
        ',',
        '@',
        '@',
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (const expected of expectedTokens) {
        const actual = lexer.advance();

        /* eslint-disable jest/no-conditional-expect */
        if (typeof expected === 'object') {
          expect(actual).toHaveTokenData(expected);
        } else {
          expect(actual).toHaveTokenData({
            kind: LexerTokenKind.OPERATOR,
            operator: expected,
          });
        }
        /* eslint-enable jest/no-conditional-expect */
      }
    });

    test('literals', () => {
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

        /* eslint-disable jest/no-conditional-expect */
        if (typeof expected === 'object') {
          expect(actual).toHaveTokenData(expected);
        } else {
          expect(actual).toHaveTokenData({
            kind: LexerTokenKind.LITERAL,
            literal: expected,
          });
        }
        /* eslint-enable jest/no-conditional-expect */
      }
    });

    test('strings', () => {
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

        /* eslint-disable jest/no-conditional-expect */
        if (typeof expected === 'object') {
          expect(actual).toHaveTokenData(expected);
        } else {
          expect(actual).toHaveTokenData({
            kind: LexerTokenKind.STRING,
            string: expected,
          });
        }
        /* eslint-enable jest/no-conditional-expect */
      }
    });

    test('soft keywords', () => {
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

        /* eslint-disable jest/no-conditional-expect */
        if (typeof expected === 'object') {
          expect(actual).toHaveTokenData(expected);
        } else {
          expect(actual).toHaveTokenData({
            kind: LexerTokenKind.IDENTIFIER,
            identifier: expected,
          });
        }
        /* eslint-enable jest/no-conditional-expect */
      }
    });

    test('identifiers', () => {
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

        /* eslint-disable jest/no-conditional-expect */
        if (typeof expected === 'object') {
          expect(actual).toHaveTokenData(expected);
        } else {
          expect(actual).toHaveTokenData({
            kind: LexerTokenKind.IDENTIFIER,
            identifier: expected,
          });
        }
        /* eslint-enable jest/no-conditional-expect */
      }
    });

    test('comments', () => {
      const lexer = new Lexer(
        new Source(`
        // line comment
        //
        asdf //  hi
        asdf
      `),
        {
          ...DEFAULT_TOKEN_KIND_FILTER,
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

    test('newlines', () => {
      const lexer = new Lexer(
        new Source(`ident1
        ident2 ident3
        "string1" "stri
ng2"
        "string3"`),
        {
          ...DEFAULT_TOKEN_KIND_FILTER,
          [LexerTokenKind.NEWLINE]: false,
        }
      );
      const expectedTokens: LexerTokenData[] = [
        { kind: LexerTokenKind.SEPARATOR, separator: 'SOF' },
        { kind: LexerTokenKind.IDENTIFIER, identifier: 'ident1' },
        { kind: LexerTokenKind.NEWLINE },
        { kind: LexerTokenKind.IDENTIFIER, identifier: 'ident2' },
        { kind: LexerTokenKind.IDENTIFIER, identifier: 'ident3' },
        { kind: LexerTokenKind.NEWLINE },
        { kind: LexerTokenKind.STRING, string: 'string1' },
        { kind: LexerTokenKind.STRING, string: 'stri\nng2' },
        { kind: LexerTokenKind.NEWLINE },
        { kind: LexerTokenKind.STRING, string: 'string3' },
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];

      for (const expected of expectedTokens) {
        const actual = lexer.advance();

        expect(actual).toHaveTokenData(expected);
      }
    });

    test('complex', () => {
      const lexer = new Lexer(
        new Source(
          `'''
        Map store
        
        Definition of operations of the super-inteface map store. See http://superface.ai
        for more details.
        '''
        
        profile = "https://superface.ai/profiles/superface/Map"
        
        //
        // Use cases
        //
        
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
        
        //
        // Reusable Models
        //
        
        model Map {
          mapId
          source
          sourceUrl
        }
        
        //
        // Reusable Fields
        //
        
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

    test('map with scripts', () => {
      const lexer = new Lexer(
        new Source(
          `map test {
            foo = (() => { const foo = 1; return { foo: foo + 2, bar: Math.min(3, 4) }; })();
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
            '(function () { var foo = 1; return { foo: foo + 2, bar: Math.min(3, 4) }; })()',
          sourceScript: 'not checked',
          sourceMap: 'not checked',
        },
        { kind: LexerTokenKind.OPERATOR, operator: ';' },

        { kind: LexerTokenKind.IDENTIFIER, identifier: 'bar' }, // 8
        { kind: LexerTokenKind.OPERATOR, operator: '=' },
        {
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '{ x: 1, y: 2 }',
          sourceScript: 'not checked',
          sourceMap: 'not checked',
        },
        { kind: LexerTokenKind.OPERATOR, operator: ';' },

        { kind: LexerTokenKind.IDENTIFIER, identifier: 'baz' }, // 12
        { kind: LexerTokenKind.OPERATOR, operator: '=' },
        {
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'true',
          sourceScript: 'not checked',
          sourceMap: 'not checked',
        },
        { kind: LexerTokenKind.OPERATOR, operator: ';' },

        { kind: LexerTokenKind.SEPARATOR, separator: '}' },
        { kind: LexerTokenKind.SEPARATOR, separator: 'EOF' },
      ];
      const contexts: { [N in number]: LexerContext | undefined } = {
        6: {
          type: LexerContextType.JESSIE_SCRIPT_EXPRESSION,
          terminationTokens: [';'],
        },
        10: {
          type: LexerContextType.JESSIE_SCRIPT_EXPRESSION,
          terminationTokens: [';'],
        },
        14: {
          type: LexerContextType.JESSIE_SCRIPT_EXPRESSION,
          terminationTokens: [';'],
        },
      };

      for (let i = 0; i < expectedTokens.length; i++) {
        const context = contexts[i];
        const actual = lexer.advance(context);
        const expected = expectedTokens[i];

        expect(actual).toHaveTokenData(expected);
      }
    });

    test('complex jessie expression', () => {
      const lexer = new Lexer(
        new Source(
          '`Template ${string} with ${more + `${nested} and ${complex}`} expressions ${here}` ;'
        )
      );

      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.SEPARATOR,
        separator: 'SOF',
      });

      expect(
        lexer.advance({
          type: LexerContextType.JESSIE_SCRIPT_EXPRESSION,
        })
      ).toHaveTokenData({
        kind: LexerTokenKind.JESSIE_SCRIPT,
        sourceMap: 'not checked',
        sourceScript: 'not checked',
        script:
          '"Template " + string + " with " + (more + (nested + " and " + complex)) + " expressions " + here',
      });

      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.OPERATOR,
        operator: ';',
      });
      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.SEPARATOR,
        separator: 'EOF',
      });
    });

    test('jessie trailing comment', () => {
      const lexer = new Lexer(
        new Source('foo = "hello world" // greet the world')
      );
      lexer.tokenKindFilter[LexerTokenKind.COMMENT] = false;

      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.SEPARATOR,
        separator: 'SOF',
      });

      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.IDENTIFIER,
        identifier: 'foo',
      });
      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.OPERATOR,
        operator: '=',
      });

      expect(
        lexer.advance({
          type: LexerContextType.JESSIE_SCRIPT_EXPRESSION,
        })
      ).toHaveTokenData({
        kind: LexerTokenKind.JESSIE_SCRIPT,
        sourceMap: 'not checked',
        sourceScript: 'not checked',
        script: '"hello world"',
      });
      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.COMMENT,
        comment: ' greet the world',
      });

      expect(lexer.advance()).toHaveTokenData({
        kind: LexerTokenKind.SEPARATOR,
        separator: 'EOF',
      });
    });
  });

  describe('invalid', () => {
    test('number literal', () => {
      const lexer = new Lexer(new Source('0xx'));
      lexer.advance(); // skip SOF

      expect(() => lexer.advance()).toThrow(
        'Expected a number following a sign or an integer base prefix'
      );
    });

    test('just a number sign', () => {
      const lexerMinus = new Lexer(new Source('-'));
      lexerMinus.advance(); // skip SOF

      expect(() => lexerMinus.advance()).toThrow(
        'Expected a number following a sign or an integer base prefix'
      );

      const lexerPlus = new Lexer(new Source('+'));
      lexerPlus.advance(); // skip SOF

      expect(() => lexerPlus.advance()).toThrow(
        'Expected a number following a sign or an integer base prefix'
      );
    });

    test('string literal', () => {
      const lexer = new Lexer(new Source('"asdf'));
      lexer.advance(); // skip SOF

      expect(() => lexer.advance()).toThrow('Unexpected EOF');
    });

    test('block string literal', () => {
      const lexer = new Lexer(new Source("'''asdf''"));
      lexer.advance(); // skip SOF

      expect(() => lexer.advance()).toThrow('Unexpected EOF');
    });

    test('string escape sequence', () => {
      const lexer = new Lexer(new Source('"asdf \\x"'));
      lexer.advance(); // skip SOF

      expect(() => lexer.advance()).toThrow('Invalid escape sequence');
    });

    test('identifiers starting with a number', () => {
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

    test('Jessie non-expression with expression context', () => {
      const lexer = new Lexer(new Source('var f = 1 ;'));

      lexer.advance(); // SOF

      expect(() =>
        lexer.advance({
          type: LexerContextType.JESSIE_SCRIPT_EXPRESSION,
          terminationTokens: [';'],
        })
      ).toThrowError('Expression expected.');
    });

    test('non-Jessie construct in jessie context', () => {
      const lexer = new Lexer(new Source('(function() {})() }'));

      lexer.advance(); // SOF

      expect(() =>
        lexer.advance({
          type: LexerContextType.JESSIE_SCRIPT_EXPRESSION,
          terminationTokens: ['}'],
        })
      ).toThrowError('FunctionExpression construct is not supported');
    });
  });

  describe('stream', () => {
    it('handles multiple saves', () => {
      const lexer = new Lexer(new Source('1 2 3 4 5'));
      lexer.next(); // SOF

      expect(lexer.next().value).toMatchObject({ data: { literal: 1 } });

      const saveA = lexer.save();
      expect(lexer.next().value).toMatchObject({ data: { literal: 2 } });
      expect(lexer.next().value).toMatchObject({ data: { literal: 3 } });

      const saveB = lexer.save();
      expect(lexer.next().value).toMatchObject({ data: { literal: 4 } });

      lexer.rollback(saveA);
      expect(lexer.next().value).toMatchObject({ data: { literal: 2 } });
      expect(lexer.next().value).toMatchObject({ data: { literal: 3 } });
      expect(lexer.next().value).toMatchObject({ data: { literal: 4 } });
      expect(lexer.next().value).toMatchObject({ data: { literal: 5 } });

      lexer.rollback(saveB);
      expect(lexer.next().value).toMatchObject({ data: { literal: 4 } });
      expect(lexer.next().value).toMatchObject({ data: { literal: 5 } });
    });

    it('yields EOF once', () => {
      const lexer = new Lexer(new Source('1'));
      lexer.next(); // SOF

      expect(lexer.next().value).toMatchObject({ data: { literal: 1 } });
      expect(lexer.next().value).toMatchObject({ data: { separator: 'EOF' } });
      expect(lexer.next()).toStrictEqual({ done: true, value: undefined });
    });
  });

  it('should overwrite the filter', () => {
    const lexer = new Lexer(new Source('1\n3 4\n5'));
    lexer.next(); // SOF

    const save = lexer.save();

    expect(lexer.next().value).toMatchObject({ data: { literal: 1 } });
    expect(lexer.next().value).toMatchObject({ data: { literal: 3 } });
    expect(lexer.next().value).toMatchObject({ data: { literal: 4 } });
    expect(lexer.next().value).toMatchObject({ data: { literal: 5 } });

    lexer.rollback(save);
    expect(lexer.next().value).toMatchObject({ data: { literal: 1 } });

    lexer.tokenKindFilter = {
      ...lexer.tokenKindFilter,
      [LexerTokenKind.NEWLINE]: false,
    };
    expect(lexer.next().value).toMatchObject({
      data: { kind: LexerTokenKind.NEWLINE },
    });

    lexer.tokenKindFilter = {
      ...lexer.tokenKindFilter,
      [LexerTokenKind.NEWLINE]: true,
    };
    expect(lexer.next().value).toMatchObject({ data: { literal: 3 } });

    lexer.tokenKindFilter = {
      ...lexer.tokenKindFilter,
      [LexerTokenKind.NEWLINE]: false,
    };
    expect(lexer.next().value).toMatchObject({ data: { literal: 4 } });
    expect(lexer.next().value).toMatchObject({
      data: { kind: LexerTokenKind.NEWLINE },
    });

    lexer.tokenKindFilter = {
      ...lexer.tokenKindFilter,
      [LexerTokenKind.NEWLINE]: true,
    };
    expect(lexer.next().value).toMatchObject({ data: { literal: 5 } });
  });

  it('should respect the allowUnknown flag', () => {
    let lexer = new Lexer(new Source('+'));
    lexer.next(); // SOF

    expect(() => lexer.next()).toThrow();

    lexer = new Lexer(new Source('+'), undefined, true);
    lexer.next(); // SOF

    expect(lexer.next().value).toMatchObject({
      data: { kind: LexerTokenKind.UNKNOWN },
    });
  });
});
