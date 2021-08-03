import { SyntaxError } from '../../../error';
import { LexerTokenStream } from '../../../lexer';
import {
  IdentifierTokenData,
  JessieScriptTokenData,
  LexerToken,
  LexerTokenData,
  LexerTokenKind,
  LiteralTokenData,
  StringTokenData,
} from '../../../lexer/token';
import { Location, Source, Span } from '../../../source';
import { allFeatures, PARSER_FEATURES, ParserFeature } from '../../features';
import { RuleResult, SyntaxRule } from '../../rule';
import { ArrayLexerStream } from '../../util';
import * as mapRules from './index';

// Declare custom matcher for sake of Typescript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeAMatch<M>(match?: M): R;
    }
  }
}
expect.extend({
  toBeAMatch(result: RuleResult<unknown>, match?: unknown) {
    let pass = true;
    let message = "Rule matched but it wasn't expected to";

    if (result.kind !== 'match') {
      pass = false;

      const token = result.attempts.token;
      const tokenInfo =
        token === undefined
          ? ''
          : ' at token #' +
            Math.trunc(token.location.line / 10000).toString() +
            ': ' +
            token.toString();
      message =
        SyntaxError.fromSyntaxRuleNoMatch(new Source(''), result).message +
        tokenInfo;
    } else if (match !== undefined) {
      if (!this.equals(result.match, match)) {
        pass = false;
        message = this.utils.printDiffOrStringify(
          match,
          result.match,
          'Expected',
          'Received',
          this.expand
        );
      }
    }

    return {
      pass,
      message: (): string => {
        return (
          this.utils.matcherHint('toBeAMatch', undefined, undefined, {
            isNot: this.isNot,
            promise: this.promise,
          }) +
          '\n\n' +
          message
        );
      },
    };
  },
});

// Ensures that token spans are correctly ordered in delcaration order
let TES_TOK_STATE = 1;
beforeEach(() => {
  TES_TOK_STATE = 1;
});
function tesTok(data: LexerTokenData): LexerToken {
  const start = Math.floor(Math.random() * 100) + TES_TOK_STATE * 10000;
  const end = start;

  const line = start;
  const column = start;

  TES_TOK_STATE += 1;

  return new LexerToken(data, { line, column }, { start, end });
}

function tesMatch<I extends Record<string, unknown>>(
  input: I,
  first: LexerToken,
  last?: LexerToken
): I & { location: Location; span: Span } {
  return {
    ...input,
    location: first.location,
    span: {
      start: first.span.start,
      end: (last ?? first).span.end,
    },
  };
}
function tesMatchJessie(token: LexerToken) {
  const data = token.data as JessieScriptTokenData;

  return tesMatch(
    {
      kind: 'JessieExpression',
      expression: data.script,
      source: data.sourceScript,
      sourceMap: data.sourceMap,
    },
    token
  );
}

/**
 * Expects rules to match with features enabled and depending on `baseMatch` either match or fail without features.
 */
function expectXToBeAMatchBase<T>(
  expected: unknown,
  stream: LexerTokenStream,
  baseMatch: boolean,
  rule: SyntaxRule<T> | SyntaxRule<T>[],
  ...features: ParserFeature[]
): asserts expected is T {
  const rules = Array.isArray(rule) ? rule : [rule];
  const featuresSave = { ...PARSER_FEATURES };
  const save = stream.save();

  for (const feature of features) {
    PARSER_FEATURES[feature] = false;
  }
  for (const rule of rules) {
    const m = rule.tryMatch(stream);
    if (baseMatch) {
      expect(m).toBeAMatch(expected);
    } else {
      expect(m).not.toBeAMatch(expected);
    }
    stream.rollback(save);
  }

  for (const feature of features) {
    PARSER_FEATURES[feature] = true;
  }
  for (const rule of rules) {
    expect(rule.tryMatch(stream)).toBeAMatch(expected);
    stream.rollback(save);
  }

  for (const feature of features) {
    PARSER_FEATURES[feature] = featuresSave[feature];
  }
}
/**
 * Expects all rules to match with and without enabled features.
 */
function expectAllToBeAMatch<T>(
  expected: unknown,
  stream: LexerTokenStream,
  rule: SyntaxRule<T> | SyntaxRule<T>[],
  ...features: ParserFeature[]
): asserts expected is T {
  return expectXToBeAMatchBase(expected, stream, true, rule, ...features);
}
/**
 * Expects rules to match only with enabled features.
 */
function expectFeaturesToBeAMatch<T>(
  expected: unknown,
  stream: LexerTokenStream,
  rule: SyntaxRule<T> | SyntaxRule<T>[],
  ...features: ParserFeature[]
): asserts expected is T {
  return expectXToBeAMatchBase(expected, stream, false, rule, ...features);
}

/* eslint jest/expect-expect: ['error', { 'assertFunctionNames': ['expect', 'expectAllToBeAMatch'] }] */

describe('strict map syntax rules', () => {
  describe('atoms', () => {
    it('should parse object literal', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.STRING, string: 'foo' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'call()',
          sourceScript: 'call()',
          sourceMap: '',
        }),

        tesTok({ kind: LexerTokenKind.STRING, string: 'bar' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '"hello"',
          sourceScript: '"hello"',
          sourceMap: '',
        }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'ObjectLiteral',
            fields: [
              tesMatch(
                {
                  kind: 'Assignment',
                  key: [(tokens[1].data as StringTokenData).string],
                  value: tesMatchJessie(tokens[3]),
                },
                tokens[1],
                tokens[3]
              ),
              tesMatch(
                {
                  kind: 'Assignment',
                  key: [(tokens[4].data as StringTokenData).string],
                  value: tesMatchJessie(tokens[6]),
                },
                tokens[4],
                tokens[6]
              ),
            ],
          },
          tokens[0],
          tokens[7]
        ),
        stream,
        mapRules.OBJECT_LITERAL,
        ...allFeatures()
      );
    });

    it('should parse condition atom', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'if' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '(' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'call()',
          sourceScript: 'call()',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ')' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = mapRules.CONDITION_ATOM;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ConditionAtom',
            expression: tesMatchJessie(tokens[2]),
          },
          tokens[0],
          tokens[3]
        )
      );
    });

    it('should parse iteration atom', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'foreach' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '(' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'i' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'of' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '[1, 2, 3]',
          sourceScript: '[1, 2, 3]',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ')' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = mapRules.ITERATION_ATOM;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'IterationAtom',
            iterationVariable: (tokens[2].data as IdentifierTokenData)
              .identifier,
            iterable: tesMatchJessie(tokens[4]),
          },
          tokens[0],
          tokens[5]
        )
      );
    });
  });

  describe('contextual statements', () => {
    it('should parse return statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'return' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'if' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '(' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'condition',
          sourceScript: 'condition',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ')' }),

        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '1 + 2',
          sourceMap: '',
          sourceScript: '1 + 2',
        }),
      ] as const;
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'OutcomeStatement',
            isError: false,
            terminateFlow: true,
            condition: tesMatch(
              {
                kind: 'ConditionAtom',
                expression: tesMatchJessie(tokens[3]),
              },
              tokens[1],
              tokens[4]
            ),
            value: tesMatchJessie(tokens[5]),
          },
          tokens[0],
          tokens[5]
        ),
        stream,
        mapRules.OPERATION_OUTCOME_STATEMENT,
        ...allFeatures()
      );
    });

    it('should parse fail statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'fail' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'if' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '(' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'false',
          sourceScript: 'false',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ')' }),

        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '3 + 4',
          sourceMap: '',
          sourceScript: '3 + 4',
        }),
      ] as const;
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'OutcomeStatement',
            isError: true,
            terminateFlow: true,
            condition: tesMatch(
              {
                kind: 'ConditionAtom',
                expression: tesMatchJessie(tokens[3]),
              },
              tokens[1],
              tokens[4]
            ),
            value: tesMatchJessie(tokens[5]),
          },
          tokens[0],
          tokens[5]
        ),
        stream,
        mapRules.OPERATION_OUTCOME_STATEMENT,
        ...allFeatures()
      );
    });

    it('should parse map result statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'map' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'if' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '(' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'false',
          sourceScript: 'false',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ')' }),

        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '15',
          sourceMap: '',
          sourceScript: '15',
        }),
      ] as const;
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'OutcomeStatement',
            isError: false,
            terminateFlow: false,
            condition: tesMatch(
              {
                kind: 'ConditionAtom',
                expression: tesMatchJessie(tokens[4]),
              },
              tokens[2],
              tokens[5]
            ),
            value: tesMatchJessie(tokens[6]),
          },
          tokens[0],
          tokens[6]
        ),
        stream,
        mapRules.MAP_OUTCOME_STATEMENT,
        ...allFeatures()
      );
    });

    it('should parse map error statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'map' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'error' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'if' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '(' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'false',
          sourceScript: 'false',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ')' }),

        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '15',
          sourceMap: '',
          sourceScript: '15',
        }),
      ] as const;
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'OutcomeStatement',
            isError: true,
            terminateFlow: false,
            condition: tesMatch(
              {
                kind: 'ConditionAtom',
                expression: tesMatchJessie(tokens[4]),
              },
              tokens[2],
              tokens[5]
            ),
            value: tesMatchJessie(tokens[6]),
          },
          tokens[0],
          tokens[6]
        ),
        stream,
        mapRules.MAP_OUTCOME_STATEMENT,
        ...allFeatures()
      );
    });
  });

  describe('assignments', () => {
    it('should parse set block assignment', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'foo-bar' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '.' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: '_baz' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '.' }),
        tesTok({ kind: LexerTokenKind.STRING, string: '1qux' }),

        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),

        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '1',
          sourceScript: '1',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ';' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'Assignment',
            key: [
              (tokens[0].data as StringTokenData).string,
              (tokens[2].data as IdentifierTokenData).identifier,
              (tokens[4].data as StringTokenData).string,
            ],
            value: tesMatchJessie(tokens[6]),
          },
          tokens[0],
          tokens[6]
        ),
        stream,
        mapRules.SET_BLOCK_ASSIGNMENT,
        ...allFeatures()
      );
    });

    it('should parse argument list assignment', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'foo-bar' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '.' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: '_baz' }),

        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),

        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '1',
          sourceMap: '',
          sourceScript: '1',
        }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'Assignment',
            key: [
              (tokens[0].data as StringTokenData).string,
              (tokens[2].data as IdentifierTokenData).identifier,
            ],
            value: tesMatchJessie(tokens[4]),
          },
          tokens[0],
          tokens[4]
        ),
        stream,
        mapRules.ARGUMENT_LIST_ASSIGNMENT,
        ...allFeatures()
      );
    });

    it('should parse object literal assignment', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'foo-bar' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '.' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: '_baz' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '.' }),
        tesTok({ kind: LexerTokenKind.STRING, string: '1qux' }),

        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),

        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '1',
          sourceScript: '1',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'Assignment',
            key: [
              (tokens[0].data as StringTokenData).string,
              (tokens[2].data as IdentifierTokenData).identifier,
              (tokens[4].data as StringTokenData).string,
            ],
            value: tesMatchJessie(tokens[6]),
          },
          tokens[0],
          tokens[6]
        ),
        stream,
        mapRules.OBJECT_LITERAL_ASSIGNMENT,
        ...allFeatures()
      );
    });
  });

  describe('statements', () => {
    it('should parse raw set statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'foo' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '"hello"',
          sourceScript: '"hello"',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
      ] as const;
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'SetStatement',
            condition: undefined,
            assignments: [
              tesMatch(
                {
                  kind: 'Assignment',
                  key: [(tokens[0].data as IdentifierTokenData).identifier],
                  value: tesMatchJessie(tokens[2]),
                },
                tokens[0],
                tokens[2]
              ),
            ],
          },
          tokens[0],
          tokens[2]
        ),
        stream,
        mapRules.SET_STATEMENT,
        ...allFeatures()
      );
    });

    it('should parse set block statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'set' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'if' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '(' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'condition',
          sourceScript: 'condition',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ')' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }), // 5

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'foo' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '"hello"',
          sourceScript: '"hello"',
          sourceMap: '',
        }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ] as const;
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'SetStatement',
            condition: tesMatch(
              {
                kind: 'ConditionAtom',
                expression: tesMatchJessie(tokens[3]),
              },
              tokens[1],
              tokens[4]
            ),
            assignments: [
              tesMatch(
                {
                  kind: 'Assignment',
                  key: [(tokens[6].data as IdentifierTokenData).identifier],
                  value: tesMatchJessie(tokens[8]),
                },
                tokens[6],
                tokens[8]
              ),
            ],
          },
          tokens[0],
          tokens[9]
        ),
        stream,
        mapRules.SET_STATEMENT,
        ...allFeatures()
      );
    });

    it('should parse minimal http call statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'http' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'GET' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ] as const;
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'HttpCallStatement',
            method: (tokens[1].data as IdentifierTokenData).identifier,
            url: (tokens[2].data as StringTokenData).string,
            responseHandlers: [],
          },
          tokens[0],
          tokens[4]
        ),
        stream,
        mapRules.MAP_SUBSTATEMENT,
        ...allFeatures()
      );
    });

    it('should parse full http call statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'http' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'POST' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'security' }), // 4
        tesTok({ kind: LexerTokenKind.STRING, string: 'my_apikey' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'request' }), // 7
        tesTok({ kind: LexerTokenKind.STRING, string: '*' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'en-US' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'query' }), // 11
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'q' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'input.query',
          sourceScript: 'input.query',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'headers' }), // 17
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'content-type' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '"application/json"',
          sourceScript: '"application/json"',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'body' }), // 23
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '1 * 2 * 3',
          sourceScript: '1 * 2 * 3',
          sourceMap: '',
        }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }), // end request

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'response' }), // 27
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 200 }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'application/json' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'en-US' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'response' }), // 33
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'value' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '7',
          sourceScript: '7',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }), // 39
      ];
      const stream = new ArrayLexerStream(tokens);

      const expected = tesMatch(
        {
          kind: 'HttpCallStatement',
          method: (tokens[1].data as IdentifierTokenData).identifier,
          url: (tokens[2].data as StringTokenData).string,
          request: tesMatch(
            {
              kind: 'HttpRequest',
              contentLanguage: 'en-US',
              query: tesMatch(
                {
                  kind: 'ObjectLiteral',
                  fields: [
                    tesMatch(
                      {
                        kind: 'Assignment',
                        key: [
                          (tokens[13].data as IdentifierTokenData).identifier,
                        ],
                        value: tesMatchJessie(tokens[15]),
                      },
                      tokens[13],
                      tokens[15]
                    ),
                  ],
                },
                tokens[12],
                tokens[16]
              ),
              headers: tesMatch(
                {
                  kind: 'ObjectLiteral',
                  fields: [
                    tesMatch(
                      {
                        kind: 'Assignment',
                        key: [(tokens[19].data as StringTokenData).string],
                        value: tesMatchJessie(tokens[21]),
                      },
                      tokens[19],
                      tokens[21]
                    ),
                  ],
                },
                tokens[18],
                tokens[22]
              ),
              body: tesMatchJessie(tokens[25]),
              security: [
                {
                  id: (tokens[5].data as StringTokenData).string,
                },
              ],
            },
            tokens[4],
            tokens[26]
          ),
          responseHandlers: [
            tesMatch(
              {
                kind: 'HttpResponseHandler',
                statusCode: (tokens[28].data as LiteralTokenData).literal,
                contentType: (tokens[29].data as StringTokenData).string,
                contentLanguage: (tokens[30].data as StringTokenData).string,
                statements: [],
              },
              tokens[27],
              tokens[32]
            ),
            tesMatch(
              {
                kind: 'HttpResponseHandler',
                statements: [
                  tesMatch(
                    {
                      kind: 'SetStatement',
                      assignments: [
                        tesMatch(
                          {
                            kind: 'Assignment',
                            key: [
                              (tokens[35].data as IdentifierTokenData)
                                .identifier,
                            ],
                            value: tesMatchJessie(tokens[37]),
                          },
                          tokens[35],
                          tokens[37]
                        ),
                      ],
                    },
                    tokens[35],
                    tokens[37]
                  ),
                ],
              },
              tokens[33],
              tokens[38]
            ),
          ],
        },
        tokens[0],
        tokens[39]
      );

      expectAllToBeAMatch(
        expected,
        stream,
        [mapRules.MAP_SUBSTATEMENT, mapRules.OPERATION_SUBSTATEMENT],
        ...allFeatures()
      );
    });

    it('should parse http call request variables with body as inline call', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'body' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),

        tesTok({
          kind: LexerTokenKind.IDENTIFIER,
          identifier: 'call',
        }),
        tesTok({
          kind: LexerTokenKind.IDENTIFIER,
          identifier: 'Op',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '(' }),
        tesTok({
          kind: LexerTokenKind.IDENTIFIER,
          identifier: 'arg',
        }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.LITERAL,
          literal: 3,
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ')' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const expected = {
        body: tesMatch(
          {
            kind: 'InlineCall',
            operationName: 'Op',
            arguments: [
              tesMatch(
                {
                  kind: 'Assignment',
                  key: [(tokens[6].data as IdentifierTokenData).identifier],
                  value: tesMatch(
                    {
                      kind: 'PrimitiveLiteral',
                      value: 3,
                    },
                    tokens[8]
                  ),
                },
                tokens[6],
                tokens[8]
              ),
            ],
          },
          tokens[3],
          tokens[9]
        ),
        span: {
          start: tokens[0].span.start,
          end: tokens[10].span.end,
        },
      };

      expectAllToBeAMatch(
        expected,
        stream,
        [mapRules.HTTP_REQUEST_VARIABLES_BLOCK],
        ...allFeatures()
      );
    });

    it('should parse call statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'call' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Foo' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '(' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ')' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'if' }), // 4
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '(' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'bar',
          sourceScript: 'bar',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ')' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const expected = tesMatch(
        {
          kind: 'CallStatement',
          condition: tesMatch(
            {
              kind: 'ConditionAtom',
              expression: tesMatchJessie(tokens[6]),
            },
            tokens[4],
            tokens[7]
          ),
          operationName: (tokens[1].data as IdentifierTokenData).identifier,
          arguments: [],
          statements: [],
        },
        tokens[0],
        tokens[9]
      );

      expectAllToBeAMatch(
        expected,
        stream,
        [mapRules.MAP_SUBSTATEMENT, mapRules.OPERATION_SUBSTATEMENT],
        ...allFeatures()
      );
    });

    it('should parse inline call statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'foo' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'call' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Foo' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '(' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ')' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'SetStatement',
            assignments: [
              tesMatch(
                {
                  kind: 'Assignment',
                  key: [(tokens[0].data as IdentifierTokenData).identifier],
                  value: tesMatch(
                    {
                      kind: 'InlineCall',
                      operationName: (tokens[3].data as IdentifierTokenData)
                        .identifier,
                      arguments: [],
                    },
                    tokens[2],
                    tokens[5]
                  ),
                },
                tokens[0],
                tokens[5]
              ),
            ],
          },
          tokens[0],
          tokens[5]
        ),
        stream,
        mapRules.SET_STATEMENT,
        ...allFeatures()
      );
    });
  });

  describe('document', () => {
    it('should parse map header', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.STRING,
          string: 'scope/profile@1.0.3',
        }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'provider' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.STRING,
          string: 'provider',
        }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'variant' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.STRING,
          string: 'my-v4riant',
        }),
      ];
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'MapHeader',
            profile: {
              scope: 'scope',
              name: 'profile',
              version: {
                major: 1,
                minor: 0,
                patch: 3,
              },
            },
            provider: 'provider',
            variant: 'my-v4riant',
          },
          tokens[0],
          tokens[8]
        ),
        stream,
        mapRules.MAP_HEADER,
        ...allFeatures()
      );
    });

    it('should parse MapDocument', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: 'SOF' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.STRING,
          string: 'pro-file@111',
        }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'provider' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.STRING,
          string: 'pro_v1der',
        }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'map' }), // 7
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Foo' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'operation' }), // 11
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Foo' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: 'EOF' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'MapDocument',
            header: tesMatch(
              {
                kind: 'MapHeader',
                profile: {
                  name: 'pro-file',
                  version: {
                    major: 111,
                    minor: 0,
                    patch: 0,
                  },
                },
                provider: 'pro_v1der',
              },
              tokens[1],
              tokens[6]
            ),
            definitions: [
              tesMatch(
                {
                  kind: 'MapDefinition',
                  name: (tokens[8].data as IdentifierTokenData).identifier,
                  usecaseName: (tokens[8].data as IdentifierTokenData)
                    .identifier,
                  statements: [],
                },
                tokens[7],
                tokens[10]
              ),
              tesMatch(
                {
                  kind: 'OperationDefinition',
                  name: (tokens[12].data as IdentifierTokenData).identifier,
                  statements: [],
                },
                tokens[11],
                tokens[14]
              ),
            ],
          },
          tokens[1],
          tokens[14]
        ),
        stream,
        mapRules.MAP_DOCUMENT,
        ...allFeatures()
      );
    });
  });
});

describe('extended map syntax rules', () => {
  describe('feature nested_object_literals', () => {
    const tokens = [
      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'set' }),
      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'foo' }),
      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'bar' }),
      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'baz' }),
      tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
      tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
    ];
    const stream = new ArrayLexerStream(tokens);

    expectFeaturesToBeAMatch(
      tesMatch(
        {
          kind: 'SetStatement',
          assignments: [
            tesMatch(
              {
                kind: 'Assignment',
                key: [(tokens[2].data as IdentifierTokenData).identifier],
                value: tesMatch(
                  {
                    kind: 'ObjectLiteral',
                    fields: [
                      tesMatch(
                        {
                          kind: 'Assignment',
                          key: [
                            (tokens[4].data as IdentifierTokenData).identifier,
                          ],
                          value: tesMatch(
                            {
                              kind: 'ObjectLiteral',
                              fields: [
                                tesMatch(
                                  {
                                    kind: 'Assignment',
                                    key: [
                                      (tokens[6].data as IdentifierTokenData)
                                        .identifier,
                                    ],
                                    value: tesMatch(
                                      {
                                        kind: 'PrimitiveLiteral',
                                        value: (
                                          tokens[8].data as LiteralTokenData
                                        ).literal,
                                      },
                                      tokens[8]
                                    ),
                                  },
                                  tokens[6],
                                  tokens[8]
                                ),
                              ],
                            },
                            tokens[5],
                            tokens[9]
                          ),
                        },
                        tokens[4],
                        tokens[9]
                      ),
                    ],
                  },
                  tokens[3],
                  tokens[10]
                ),
              },
              tokens[2],
              tokens[10]
            ),
          ],
        },
        tokens[0],
        tokens[11]
      ),
      stream,
      mapRules.SET_STATEMENT,
      'nested_object_literals'
    );
  });

  describe('feature shorthand_http_request_slots', () => {
    const tokensA = [
      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'request' }),
      tesTok({ kind: LexerTokenKind.STRING, string: 'application/json' }),
      tesTok({ kind: LexerTokenKind.STRING, string: 'en-US' }),

      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'query' }),
      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
    ];

    const tokensB = [
      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'request' }),
      tesTok({ kind: LexerTokenKind.STRING, string: 'application/json' }),
      tesTok({ kind: LexerTokenKind.STRING, string: 'en-US' }),

      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'headers' }),
      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
    ];

    const tokensC = [
      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'request' }),
      tesTok({ kind: LexerTokenKind.STRING, string: 'application/json' }),
      tesTok({ kind: LexerTokenKind.STRING, string: 'en-US' }),

      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'body' }),
      tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
      tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
      tesTok({ kind: LexerTokenKind.NEWLINE }),
    ];

    const streamA = new ArrayLexerStream(tokensA);
    expectFeaturesToBeAMatch(
      tesMatch(
        {
          contentType: 'application/json',
          contentLanguage: 'en-US',
          query: tesMatch(
            {
              kind: 'ObjectLiteral',
              fields: [],
            },
            tokensA[4],
            tokensA[5]
          ),
        },
        tokensA[0],
        tokensA[5]
      ),
      streamA,
      mapRules.HTTP_CALL_STATEMENT_REQUEST,
      'shorthand_http_request_slots'
    );

    const streamB = new ArrayLexerStream(tokensB);
    expectFeaturesToBeAMatch(
      tesMatch(
        {
          contentType: 'application/json',
          contentLanguage: 'en-US',
          headers: tesMatch(
            {
              kind: 'ObjectLiteral',
              fields: [],
            },
            tokensB[4],
            tokensB[5]
          ),
        },
        tokensB[0],
        tokensB[5]
      ),
      streamB,
      mapRules.HTTP_CALL_STATEMENT_REQUEST,
      'shorthand_http_request_slots'
    );

    const streamC = new ArrayLexerStream(tokensC);
    expectFeaturesToBeAMatch(
      tesMatch(
        {
          contentType: 'application/json',
          contentLanguage: 'en-US',
          body: tesMatch(
            {
              kind: 'PrimitiveLiteral',
              value: (tokensC[5].data as LiteralTokenData).literal,
            },
            tokensC[5]
          ),
        },
        tokensC[0],
        tokensC[5]
      ),
      streamC,
      mapRules.HTTP_CALL_STATEMENT_REQUEST,
      'shorthand_http_request_slots'
    );
  });

  describe('feature multiple_security_schemes', () => {
    const tokens = [
      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'http' }),
      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'GET' }),
      tesTok({ kind: LexerTokenKind.STRING, string: 'url' }),
      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'security' }),
      tesTok({ kind: LexerTokenKind.STRING, string: 'my_apikey' }),
      tesTok({ kind: LexerTokenKind.NEWLINE }),

      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'security' }),
      tesTok({ kind: LexerTokenKind.STRING, string: 'my_bearer' }),
      tesTok({ kind: LexerTokenKind.NEWLINE }),

      tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'security' }),
      tesTok({ kind: LexerTokenKind.STRING, string: 'my_basicauth' }),
      tesTok({ kind: LexerTokenKind.NEWLINE }),

      tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
    ];
    const stream = new ArrayLexerStream(tokens);

    expectFeaturesToBeAMatch(
      tesMatch(
        {
          kind: 'HttpCallStatement',
          method: (tokens[1].data as IdentifierTokenData).identifier,
          url: (tokens[2].data as StringTokenData).string,
          request: tesMatch(
            {
              kind: 'HttpRequest',
              security: [
                { id: (tokens[5].data as StringTokenData).string },
                { id: (tokens[8].data as StringTokenData).string },
                { id: (tokens[11].data as StringTokenData).string },
              ],
            },
            tokens[4],
            tokens[11]
          ),
          responseHandlers: [],
        },
        tokens[0],
        tokens[13]
      ),
      stream,
      [mapRules.MAP_SUBSTATEMENT, mapRules.OPERATION_SUBSTATEMENT],
      'multiple_security_schemes'
    );
  });
});
