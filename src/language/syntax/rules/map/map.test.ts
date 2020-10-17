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
import { RuleResult, SyntaxRule } from '../../rule';
import { ArrayLexerStream } from '../../util';
import { mapCommon, mapExtended, mapStrict } from './index';

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

function expectAllToBeAMatch<T>(
  expected: unknown,
  stream: LexerTokenStream,
  ...rules: SyntaxRule<T>[]
): asserts expected is T {
  const save = stream.save();

  for (const rule of rules) {
    expect(rule.tryMatch(stream)).toBeAMatch(expected);
    stream.rollback(save);
  }
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
        mapStrict.OBJECT_LITERAL,
        mapExtended.OBJECT_LITERAL
      );
    });

    it('should parse statement condition', () => {
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

      const rule = mapCommon.STATEMENT_CONDITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'StatementCondition',
            expression: tesMatchJessie(tokens[2]),
          },
          tokens[0],
          tokens[3]
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
                kind: 'StatementCondition',
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
        mapStrict.OPERATION_OUTCOME_STATEMENT,
        mapExtended.OPERATION_OUTCOME_STATEMENT
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
                kind: 'StatementCondition',
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
        mapStrict.OPERATION_OUTCOME_STATEMENT,
        mapExtended.OPERATION_OUTCOME_STATEMENT
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
                kind: 'StatementCondition',
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
        mapStrict.MAP_OUTCOME_STATEMENT,
        mapExtended.MAP_OUTCOME_STATEMENT
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
                kind: 'StatementCondition',
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
        mapStrict.MAP_OUTCOME_STATEMENT,
        mapExtended.MAP_OUTCOME_STATEMENT
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
        mapStrict.SET_BLOCK_ASSIGNMENT,
        mapExtended.SET_BLOCK_ASSIGNMENT
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
        mapStrict.ARGUMENT_LIST_ASSIGNMENT,
        mapExtended.ARGUMENT_LIST_ASSIGNMENT
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
        mapStrict.OBJECT_LITERAL_ASSIGNMENT,
        mapExtended.OBJECT_LITERAL_ASSIGNMENT
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
        mapStrict.SET_STATEMENT,
        mapExtended.SET_STATEMENT
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
                kind: 'StatementCondition',
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
        mapStrict.SET_STATEMENT,
        mapExtended.SET_STATEMENT
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
        mapStrict.MAP_SUBSTATEMENT,
        mapExtended.MAP_SUBSTATEMENT
      );
    });

    it('should parse full http call statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'http' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'POST' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'request' }), // 4
        tesTok({ kind: LexerTokenKind.STRING, string: '*' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'en-US' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'query' }), // 8
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'q' }), // 10
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'input.query',
          sourceScript: 'input.query',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'headers' }), // 14
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'content-type' }), // 16
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '"application/json"',
          sourceScript: '"application/json"',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'body' }), // 20
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '1 * 2 * 3',
          sourceScript: '1 * 2 * 3',
          sourceMap: '',
        }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }), // end request

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'response' }), // 24
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 200 }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'application/json' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'en-US' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'response' }), // 30
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

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
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
                          (tokens[10].data as IdentifierTokenData).identifier,
                        ],
                        value: tesMatchJessie(tokens[12]),
                      },
                      tokens[10],
                      tokens[12]
                    ),
                  ],
                },
                tokens[9],
                tokens[13]
              ),
              headers: tesMatch(
                {
                  kind: 'ObjectLiteral',
                  fields: [
                    tesMatch(
                      {
                        kind: 'Assignment',
                        key: [(tokens[16].data as StringTokenData).string],
                        value: tesMatchJessie(tokens[18]),
                      },
                      tokens[16],
                      tokens[18]
                    ),
                  ],
                },
                tokens[15],
                tokens[19]
              ),
              body: tesMatchJessie(tokens[22]),
            },
            tokens[4],
            tokens[23]
          ),
          responseHandlers: [
            tesMatch(
              {
                kind: 'HttpResponseHandler',
                statusCode: (tokens[25].data as LiteralTokenData).literal,
                contentType: (tokens[26].data as StringTokenData).string,
                contentLanguage: (tokens[27].data as StringTokenData).string,
                statements: [],
              },
              tokens[24],
              tokens[29]
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
                              (tokens[32].data as IdentifierTokenData)
                                .identifier,
                            ],
                            value: tesMatchJessie(tokens[34]),
                          },
                          tokens[32],
                          tokens[34]
                        ),
                      ],
                    },
                    tokens[32],
                    tokens[34]
                  ),
                ],
              },
              tokens[30],
              tokens[35]
            ),
          ],
        },
        tokens[0],
        tokens[36]
      );

      expectAllToBeAMatch(
        expected,
        stream,
        mapStrict.MAP_SUBSTATEMENT,
        mapStrict.OPERATION_SUBSTATEMENT,
        mapExtended.MAP_SUBSTATEMENT,
        mapExtended.OPERATION_SUBSTATEMENT
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
              kind: 'StatementCondition',
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
        mapStrict.MAP_SUBSTATEMENT,
        mapStrict.OPERATION_SUBSTATEMENT,
        mapExtended.MAP_SUBSTATEMENT,
        mapExtended.OPERATION_SUBSTATEMENT
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
        mapStrict.SET_STATEMENT,
        mapExtended.SET_STATEMENT
      );
    });
  });

  describe('document', () => {
    it('should parse profile id', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.STRING,
          string: 'http://example.com/profile',
        }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = mapCommon.PROFILE_ID;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ProfileId',
            profileId: (tokens[2].data as StringTokenData).string,
          },
          tokens[0],
          tokens[2]
        )
      );
    });

    it('should parse provider', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'provider' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.STRING,
          string: 'http://example.com/provider',
        }),
      ];
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'Provider',
            providerId: (tokens[2].data as StringTokenData).string,
          },
          tokens[0],
          tokens[2]
        ),
        stream,
        mapCommon.PROVIDER_ID
      );
    });

    it('should parse map', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.STRING,
          string: 'http://example.com/profile',
        }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'provider' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.STRING,
          string: 'http://example.com/provider',
        }),
      ];
      const stream = new ArrayLexerStream(tokens);

      expectAllToBeAMatch(
        tesMatch(
          {
            kind: 'Map',
            profileId: tesMatch(
              {
                kind: 'ProfileId',
                profileId: (tokens[2].data as StringTokenData).string,
              },
              tokens[0],
              tokens[2]
            ),
            provider: tesMatch(
              {
                kind: 'Provider',
                providerId: (tokens[5].data as StringTokenData).string,
              },
              tokens[3],
              tokens[5]
            ),
          },
          tokens[0],
          tokens[5]
        ),
        stream,
        mapCommon.MAP
      );
    });

    it('should parse MapDocument', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: 'SOF' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.STRING,
          string: 'http://example.com/profile',
        }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'provider' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.STRING,
          string: 'http://example.com/provider',
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
            map: tesMatch(
              {
                kind: 'Map',
                profileId: tesMatch(
                  {
                    kind: 'ProfileId',
                    profileId: (tokens[3].data as StringTokenData).string,
                  },
                  tokens[1],
                  tokens[3]
                ),
                provider: tesMatch(
                  {
                    kind: 'Provider',
                    providerId: (tokens[6].data as StringTokenData).string,
                  },
                  tokens[4],
                  tokens[6]
                ),
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
        mapStrict.MAP_DOCUMENT,
        mapExtended.MAP_DOCUMENT
      );
    });
  });
});
