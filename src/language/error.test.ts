import { SyntaxError } from './error';
import { Lexer, LexerTokenStream } from './lexer/lexer';
import { UnknownTokenData } from './lexer/token';
import { Source } from './source';
import { parseMap, parseProfile, parseRule } from './syntax/parser';
import {
  MatchAttempts,
  RuleResult,
  RuleResultMatch,
  RuleResultNoMatch,
  SyntaxRule,
} from './syntax/rule';
import * as profileRules from './syntax/rules/profile';

// Declare custom matcher for sake of Typescript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMatchSyntaxError(
        detail: string,
        sourceInfo: string,
        ...messageLines: string[]
      ): R;

      toThrowSyntaxError(
        detail: string,
        sourceInfo: string,
        ...messageLines: string[]
      ): R;
    }
  }
}

function toMatchSyntaxError(
  context: jest.MatcherContext,
  err: unknown,
  detail: string,
  sourceInfo: string,
  ...messageLines: string[]
) {
  let message =
    context.utils.matcherHint('toMatchSyntaxError', undefined, detail, {
      isNot: context.isNot,
      promise: context.promise,
    }) + '\n\n';

  if (!(err instanceof SyntaxError)) {
    message += 'Object is not an instance of SyntaxError';

    return {
      pass: false,
      message: () => message,
    };
  }

  const formatLines = err.format().split('\n');
  const testLine = (index: number, needle: string): boolean => {
    if (formatLines[index].includes(needle)) {
      return true;
    }

    message +=
      ` at line ${index + 1}\n\n` +
      `Expected: ${context.utils.printExpected(needle)}\n` +
      `Received: ${context.utils.printReceived(formatLines[index])}\n`;

    return false;
  };

  if (!testLine(0, `SyntaxError: ${detail}`)) {
    return { pass: false, message: () => message };
  }
  if (!testLine(1, ` --> ${sourceInfo}`)) {
    return { pass: false, message: () => message };
  }

  let i = 0;
  for (; i < messageLines.length; i++) {
    if (!testLine(i + 2, messageLines[i])) {
      return { pass: false, message: () => message };
    }
  }

  // If there are any trailing non-empty lines, report this as non-pass
  if (i < formatLines.length - 2) {
    const missedLines = formatLines.slice(i + 2);
    if (missedLines.find(line => line.trim() !== '') !== undefined) {
      message +=
        'Found more lines than expected:' +
        missedLines.map(l => `\n"${l}"`).join('');

      return { pass: false, message: () => message };
    }
  }

  message += 'Expected to not match a SyntaxError with given message lines';

  return { pass: true, message: () => message };
}

// Add the actual custom matcher
expect.extend({
  toMatchSyntaxError(
    err: unknown,
    detail: string,
    sourceInfo: string,
    ...messageLines: string[]
  ) {
    return toMatchSyntaxError(this, err, detail, sourceInfo, ...messageLines);
  },

  toThrowSyntaxError(
    fn: () => unknown,
    detail: string,
    sourceInfo: string,
    ...messageLines: string[]
  ) {
    try {
      fn();
    } catch (err) {
      return toMatchSyntaxError(this, err, detail, sourceInfo, ...messageLines);
    }

    return {
      pass: false,
      message: () =>
        this.utils.matcherHint('toMatchSyntaxError', undefined, detail, {
          isNot: this.isNot,
          promise: this.promise,
        }) + '\n\nExpected fn to throw.',
    };
  },
});

class TestSyntaxRule<
  R extends RuleResult<T>,
  T = unknown
> extends SyntaxRule<T> {
  constructor(public result?: R, public name?: string) {
    super();
  }

  tryMatch(_tokens: LexerTokenStream): R {
    if (this.result === undefined) {
      throw 'test syntax rule error';
    }

    return this.result;
  }

  [Symbol.toStringTag](): string {
    return this.name ?? '[test rule]';
  }
}

describe('langauge syntax errors', () => {
  describe('lexer', () => {
    it('before', () => {
      const lexer = new Lexer(new Source('before\n\t0xx'));

      lexer.advance();
      lexer.advance();

      expect(
        (lexer.advance().data as UnknownTokenData).error
      ).toMatchSyntaxError(
        'Expected a number following a sign or an integer base prefix',
        '[input]:2:2',
        '1 | before',
        '2 | \t0xx',
        '  | \t^^^'
      );
    });

    it('after', () => {
      const lexer = new Lexer(new Source('\t0xx\nafter'));

      lexer.advance();

      expect(
        (lexer.advance().data as UnknownTokenData).error
      ).toMatchSyntaxError(
        'Expected a number following a sign or an integer base prefix',
        '[input]:1:2',
        '1 | \t0xx',
        '  | \t^^^',
        '2 | after'
      );
    });

    it('before and after', () => {
      const lexer = new Lexer(new Source('before\n\t0xx\nafter'));

      lexer.advance();
      lexer.advance();

      expect(
        (lexer.advance().data as UnknownTokenData).error
      ).toMatchSyntaxError(
        'Expected a number following a sign or an integer base prefix',
        '[input]:2:2',
        '1 | before',
        '2 | \t0xx',
        '  | \t^^^',
        '3 | after'
      );
    });

    it('neither before nor after', () => {
      const lexer = new Lexer(new Source('\t0xx'));

      lexer.advance();

      expect(
        (lexer.advance().data as UnknownTokenData).error
      ).toMatchSyntaxError(
        'Expected a number following a sign or an integer base prefix',
        '[input]:1:2',
        '1 | \t0xx',
        '  | \t^^^'
      );
    });
  });

  describe('profile parser', () => {
    it('should report error from parseProfile', () => {
      const source = new Source('name: "http://superface.ai/profile/test"');

      expect(() => parseProfile(source)).toThrowSyntaxError(
        'Expected `=` but found `:`',
        '[input]:1:5',
        '1 | name: "http://superface.ai/profile/test"',
        '  |     ^                                   '
      );
    });

    it('should report primitive type rule error', () => {
      const source = new Source('!');

      expect(() =>
        parseRule(profileRules.PRIMITIVE_TYPE_NAME, source, true)
      ).toThrowSyntaxError(
        'Expected `boolean` or `number` or `string` but found `!`',
        '[input]:1:1',
        '1 | !',
        '  | ^'
      );
    });

    it('should report enum value rule error', () => {
      const tokens = new Source(`enum {
asdf = 'as
df'
!
}`);

      expect(() =>
        parseRule(profileRules.ENUM_DEFINITION, tokens, true)
      ).toThrowSyntaxError(
        'Expected `}` or identifier or string or `,` but found `!`',
        '[input]:4:1',
        "3 | df'",
        '4 | !',
        '  | ^',
        '5 | }'
      );
    });
  });

  describe('combinators and propagation', () => {
    const tokens = new Lexer(new Source(''));

    const match: TestSyntaxRule<RuleResultMatch<unknown>>[] = [];
    {
      const match1 = new TestSyntaxRule();
      match1.result = {
        kind: 'match',
        match: 1,
        optionalAttempts: new MatchAttempts(undefined, [match1]),
      } as const;

      const match2 = new TestSyntaxRule();
      match2.result = {
        kind: 'match',
        match: 2,
        optionalAttempts: new MatchAttempts(undefined, [match2]),
      } as const;

      match.push(match1 as TestSyntaxRule<RuleResultMatch<unknown>>);
      match.push(match2 as TestSyntaxRule<RuleResultMatch<unknown>>);
    }

    const nomatch: TestSyntaxRule<RuleResultNoMatch>[] = [];
    {
      const nomatch1 = new TestSyntaxRule();
      nomatch1.result = {
        kind: 'nomatch',
        attempts: new MatchAttempts(undefined, [nomatch1]),
      } as const;

      const nomatch2 = new TestSyntaxRule();
      nomatch2.result = {
        kind: 'nomatch',
        attempts: new MatchAttempts(undefined, [nomatch2]),
      } as const;

      nomatch.push(nomatch1 as TestSyntaxRule<RuleResultNoMatch>);
      nomatch.push(nomatch2 as TestSyntaxRule<RuleResultNoMatch>);
    }

    describe('or', () => {
      it('should propagate on first success', () => {
        const rule = match[0].or(nomatch[0]);
        expect(rule.tryMatch(tokens)).toStrictEqual(match[0].result);
      });

      it('should merge on second success', () => {
        const rule = nomatch[0].or(match[0]);
        expect(rule.tryMatch(tokens)).toStrictEqual({
          ...match[0].result,
          optionalAttempts: new MatchAttempts(undefined, [
            ...(nomatch[0].result?.attempts.rules ?? []),
            ...(match[0].result?.optionalAttempts?.rules ?? []),
          ]),
        });
      });

      it('should merge on failure', () => {
        const rule = nomatch[0].or(nomatch[1]);
        expect(rule.tryMatch(tokens)).toStrictEqual({
          kind: 'nomatch',
          attempts: new MatchAttempts(undefined, [
            ...(nomatch[0].result?.attempts.rules ?? []),
            ...(nomatch[1].result?.attempts.rules ?? []),
          ]),
        });
      });
    });

    describe('followed by', () => {
      it('should propagate on first failure', () => {
        const rule = nomatch[0].followedBy(nomatch[1]);
        expect(rule.tryMatch(tokens)).toStrictEqual(nomatch[0].result);
      });

      it('should merge on second failure', () => {
        const rule = match[0].followedBy(nomatch[0]);
        expect(rule.tryMatch(tokens)).toStrictEqual({
          kind: 'nomatch',
          attempts: new MatchAttempts(undefined, [
            ...(nomatch[0].result?.attempts.rules ?? []),
            ...(match[0].result?.optionalAttempts?.rules ?? []),
          ]),
        });
      });

      it('should merge on success', () => {
        const rule = match[0].followedBy(match[1]);
        expect(rule.tryMatch(tokens)).toStrictEqual({
          kind: 'match',
          match: [match[0].result?.match, match[1].result?.match],
          optionalAttempts: new MatchAttempts(undefined, [
            ...(match[0].result?.optionalAttempts?.rules ?? []),
            ...(match[1].result?.optionalAttempts?.rules ?? []),
          ]),
        });
      });
    });

    describe('repeat', () => {
      it('should propagate on failure', () => {
        const rule = SyntaxRule.repeat(nomatch[0]);
        expect(rule.tryMatch(tokens)).toStrictEqual(nomatch[0].result);
      });

      it('should merge on success', () => {
        class TestSyntaxRuleRepeat<T = unknown> extends SyntaxRule<T> {
          private state: number;

          constructor(
            public first?: RuleResult<T>,
            public second?: RuleResult<T>
          ) {
            super();

            this.state = 0;
          }

          tryMatch(_tokens: LexerTokenStream): RuleResult<T> {
            if (this.state === 0) {
              this.state = 1;

              if (this.first === undefined) {
                throw 'test syntax rule repeat error';
              }

              return this.first;
            }

            if (this.second === undefined) {
              throw 'test syntax rule repeat error';
            }

            return this.second;
          }

          [Symbol.toStringTag](): string {
            return '[repeat test rule]';
          }
        }

        const matchThenNomatch = new TestSyntaxRuleRepeat();
        const firstResult = {
          kind: 'match',
          match: 1,
          optionalAttempts: new MatchAttempts(undefined, [matchThenNomatch]),
        } as const;
        const secondResult = {
          kind: 'nomatch',
          attempts: new MatchAttempts(undefined, [matchThenNomatch]),
        } as const;

        matchThenNomatch.first = firstResult;
        matchThenNomatch.second = secondResult;

        const rule = SyntaxRule.repeat(matchThenNomatch);
        expect(rule.tryMatch(tokens)).toStrictEqual({
          kind: 'match',
          match: [firstResult.match],
          optionalAttempts: new MatchAttempts(undefined, [
            ...firstResult.optionalAttempts.rules,
            ...secondResult.attempts.rules,
          ]),
        });
      });
    });

    describe('optional', () => {
      it('should propagate on failure', () => {
        const rule = SyntaxRule.optional(nomatch[0]);
        expect(rule.tryMatch(tokens)).toStrictEqual({
          kind: 'match',
          match: undefined,
          optionalAttempts: nomatch[0].result?.attempts,
        });
      });

      it('should propagate on success', () => {
        const rule = SyntaxRule.optional(match[0]);
        expect(rule.tryMatch(tokens)).toStrictEqual(match[0].result);
      });
    });
  });

  describe('map parser', () => {
    it('should return correct error with wrong return syntax in operations', () => {
      const input = `profile = "pro/file@1.0"
      provider = "provider"

      operation Foo {
        http GET "url" {
          response 200 {
            return map result {
              results = 1
            }
          }
        }
      }
      `;

      const source = new Source(input);

      expect(() => parseMap(source)).toThrowSyntaxError(
        "Error in script syntax: ',' expected.",
        '[input]:7:24',
        '6  |           response 200 {',
        '7  |             return map result {',
        '   |                        ^^^^^^',
        '8  |               results = 1',
        '',
        'Hint: This was parsed in script context, it might be an error in comlink syntax instead'
      );
    });
  });
});
