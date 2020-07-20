import { Lexer } from './lexer/lexer';
import { Source } from './source';
import { parseProfile } from './syntax/parser';
import * as profile from './syntax/rules/profile';
import { SyntaxError } from './error';
import { SyntaxRule } from './syntax/rules/rule';
import { BufferedIterator } from './syntax/util';

// Declare custom matcher for sake of Typescript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toThrowSyntaxError(
        detail: string,
        sourceInfo: string,
        ...lines: string[]
      ): R;
    }
  }
}
// Add the actual custom matcher
expect.extend({
  toThrowSyntaxError(
    fn: () => any,
    detail: string,
    sourceInfo: string,
    ...lines: string[]
  ) {
    try {
      fn()
    } catch (err) {
      let pass = true;
      let message = 'Expected not to throw or not to match exception';

      if (!(err instanceof SyntaxError)) {
        return {
          pass: false,
          message: () => this.utils.matcherHint('toThrowSyntaxError', undefined, detail, {
            isNot: this.isNot,
            promise: this.promise,
          }) + '\n\nFunction didn\'t throw a SyntaxError object'
        }
      }
      const formatLines = err.format().split('\n');
      
      const testMatch = (index: number, needle: string): boolean => {
        if (formatLines[index].indexOf(needle) < 0) {
          pass = false;
          message = this.utils.matcherHint('toThrowSyntaxError', undefined, detail, {
            isNot: this.isNot,
            promise: this.promise,
          }) + ` at line ${index + 1}\n\n` +
          `Expected: ${this.utils.printExpected(needle)}\n` +
          `Received: ${this.utils.printReceived(formatLines[index])}\n`;
        }

        return pass;
      }

      if (!testMatch(0, `SyntaxError: ${detail}`) || !testMatch(1, ` --> ${sourceInfo}`)) {
        return { pass, message: () => message };
      }
      
      let i = 0;
      for (; i < lines.length; i++) {
        if (!testMatch(i + 2, lines[i])) {
          return { pass, message: () => message };
        }
      }

      // If there are any trailing non-empty lines, report this as non-pass
      if (i < formatLines.length - 2) {
        const missedLines = formatLines.slice(i + 2);
        if (
          missedLines.find(value => value.trim() !== '') !== undefined
        ) {
          pass = false;
          message = 'Found more lines than expected:' + missedLines.map((l: string) => `\n${l}`).join('');
        }
      }

      return {
        pass,
        message: () => message
      }
    }

    // If `fn` doesn't throw
    return {
      pass: false,
      message: () => `Expected to throw "${detail}"`
    }
  }
});

function parseRuleSkipSOF<N>(rule: SyntaxRule<N>, source: Source): N {
  const lexer = new Lexer(source);
  const buf = new BufferedIterator(lexer[Symbol.iterator]());
  buf.next(); // skip SOF

  const result = rule.tryMatch(buf);

  if (result.kind === 'nomatch') {
    throw SyntaxError.fromSyntaxRuleNoMatch(source, result);
  }

  return result.match;
}

describe('langauge syntax errors', () => {
  describe('lexer', () => {
    it('before', () => {
      const lexer = new Lexer(new Source('before\n\t@safes'));

      lexer.advance();
      lexer.advance();

      expect(
        () => lexer.advance()
      ).toThrowSyntaxError(
        'Expected one of [safe, unsafe, idempotent]',
        '[input]:2:2',
        '1 | before',
        '2 | \t@safes',
        '  | \t^^    '
      )
    });

    it('after', () => {
      const lexer = new Lexer(new Source('\t0xx\nafter'));
      
      lexer.advance();

      expect(
        () => lexer.advance()
      ).toThrowSyntaxError(
        'Expected a number following integer base prefix',
        '[input]:1:2',
        '1 | \t0xx',
        '  | \t^^^',
        '2 | after'
      )
    });

    it('before and after', () => {
      const lexer = new Lexer(new Source('before\n\t@safes\nafter'));
      
      lexer.advance();
      lexer.advance();

      expect(
        () => lexer.advance()
      ).toThrowSyntaxError(
        'Expected one of [safe, unsafe, idempotent]',
        '[input]:2:2',
        '1 | before',
        '2 | \t@safes',
        '  | \t^^    ',
        '3 | after'
      )
    });

    it('neither before nor after', () => {
      const lexer = new Lexer(new Source('\t@safes'));
      
      lexer.advance();
      
      expect(
        () => lexer.advance()
      ).toThrowSyntaxError(
        'Expected one of [safe, unsafe, idempotent]',
        '[input]:1:2',
        '1 | \t@safes',
        '  | \t^^    '
      )
    });
  });

  describe('profile parser', () => {
    it('should report error from parseProfile', () => {
      const source = new Source('profile: "http://superface.ai/profile/test"');

      expect(
        () => parseProfile(source)
      ).toThrowSyntaxError(
        'Expected `=` but found `:`',
        '[input]:1:8',
        '1 | profile: "http://superface.ai/profile/test"',
        '  |        ^                                   '
      )
    });

    it('should report primitive type rule error', () => {
      const source = new Source('!');

      expect(
        () => parseRuleSkipSOF(profile.PRIMITIVE_TYPE_NAME, source)
      ).toThrowSyntaxError(
        'Expected `Boolean` or `Number` or `String` but found `!`',
        '[input]:1:1',
        '1 | !',
        '  | ^'
      )
    });

    it('should report enum value rule error', () => {
      const tokens = new Source(`Enum {
'asdf'
!
}`);

      expect(
        () => parseRuleSkipSOF(profile.ENUM_DEFINITION, tokens)
      ).toThrowSyntaxError(
        'Expected string or literal or identifier or `}` but found `!`',
        '[input]:3:1',
        '2 | \'asdf\'',
        '3 | !',
        '  | ^',
        '4 | }'
      )
    });
  })
});