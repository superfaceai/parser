import { SyntaxError } from '../../../error';
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
import { RuleResult } from '../../rule';
import { ArrayLexerStream } from '../../util';
import * as rules from './index';
import {
  MAP,
  MAP_DEFINITION_HTTP_CALL,
  MAP_DEFINITION_STATEMENT,
  MAP_DOCUMENT,
  OPERATION_DEFINITION_HTTP_CALL,
  OPERATION_DEFINITION_STATEMENT,
  PROFILE_ID,
  PROVIDER_ID,
  STATEMENT_CONDITION,
} from './map';
import { ARGUMENT_LIST_ASSIGNMENT, SET_BLOCK_ASSIGNMENT } from './value';

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
      message = SyntaxError.fromSyntaxRuleNoMatch(new Source(''), result)
        .message;
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
function tesMatchJessiePrimitive(token: LexerToken) {
  const script = (token.data as JessieScriptTokenData).script;

  let value;
  if (script.startsWith('"') && script.endsWith('"')) {
    value = script.slice(1, script.length - 1);
  } else if (script === 'true') {
    value = true;
  } else if (script === 'false') {
    value = false;
  } else {
    value = parseInt(script);
  }

  return tesMatch(
    {
      kind: 'PrimitiveLiteral',
      value,
    },
    token
  );
}

describe('map syntax rules', () => {
  describe('atoms', () => {
    it('should parse array literal', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),

        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '42',
          sourceScript: '42',
          sourceMap: '',
        }), // 3
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),

        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '1 + 2',
          sourceScript: '1 + 2',
          sourceMap: '',
        }), // 3
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),

        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'call()',
          sourceScript: 'call()',
          sourceMap: '',
        }), // 5

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ']' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.ARRAY_LITERAL;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ArrayLiteral',
            elements: [
              tesMatchJessiePrimitive(tokens[1]),
              tesMatchJessie(tokens[3]),
              tesMatchJessie(tokens[5]),
            ],
          },
          tokens[0],
          tokens[6]
        )
      );
    });

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

      const rule = rules.OBJECT_LITERAL;

      expect(rule.tryMatch(stream)).toBeAMatch(
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
                  value: tesMatchJessiePrimitive(tokens[6]),
                },
                tokens[4],
                tokens[6]
              ),
            ],
          },
          tokens[0],
          tokens[7]
        )
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

      const rule = STATEMENT_CONDITION;

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

      const rule = rules.RETURN_STATEMENT;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ReturnStatement',
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
        )
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

      const rule = rules.FAIL_STATEMENT;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'FailStatement',
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
        )
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

      const rule = rules.MAP_RESULT_STATEMENT;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'MapResultStatement',
            condition: tesMatch(
              {
                kind: 'StatementCondition',
                expression: tesMatchJessie(tokens[4]),
              },
              tokens[2],
              tokens[5]
            ),
            value: tesMatchJessiePrimitive(tokens[6]),
          },
          tokens[0],
          tokens[6]
        )
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

      const rule = rules.MAP_ERROR_STATEMENT;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'MapErrorStatement',
            condition: tesMatch(
              {
                kind: 'StatementCondition',
                expression: tesMatchJessie(tokens[4]),
              },
              tokens[2],
              tokens[5]
            ),
            value: tesMatchJessiePrimitive(tokens[6]),
          },
          tokens[0],
          tokens[6]
        )
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

      const rule = SET_BLOCK_ASSIGNMENT;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'Assignment',
            key: [
              (tokens[0].data as StringTokenData).string,
              (tokens[2].data as IdentifierTokenData).identifier,
              (tokens[4].data as StringTokenData).string,
            ],
            value: tesMatchJessiePrimitive(tokens[6]),
          },
          tokens[0],
          tokens[6]
        )
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

      const rule = ARGUMENT_LIST_ASSIGNMENT;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'Assignment',
            key: [
              (tokens[0].data as StringTokenData).string,
              (tokens[2].data as IdentifierTokenData).identifier,
            ],
            value: tesMatchJessiePrimitive(tokens[4]),
          },
          tokens[0],
          tokens[4]
        )
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

      const rule = SET_BLOCK_ASSIGNMENT;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'Assignment',
            key: [
              (tokens[0].data as StringTokenData).string,
              (tokens[2].data as IdentifierTokenData).identifier,
              (tokens[4].data as StringTokenData).string,
            ],
            value: tesMatchJessiePrimitive(tokens[6]),
          },
          tokens[0],
          tokens[6]
        )
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

      const rule = rules.SET_STATEMENT;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'SetStatement',
            condition: undefined,
            assignments: [
              tesMatch(
                {
                  kind: 'Assignment',
                  key: [(tokens[0].data as IdentifierTokenData).identifier],
                  value: tesMatchJessiePrimitive(tokens[2]),
                },
                tokens[0],
                tokens[2]
              ),
            ],
          },
          tokens[0],
          tokens[2]
        )
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

      const rule = rules.SET_STATEMENT;

      expect(rule.tryMatch(stream)).toBeAMatch(
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
                  value: tesMatchJessiePrimitive(tokens[8]),
                },
                tokens[6],
                tokens[8]
              ),
            ],
          },
          tokens[0],
          tokens[9]
        )
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

      const rule = MAP_DEFINITION_HTTP_CALL;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'HttpCallStatement',
            method: (tokens[1].data as IdentifierTokenData).identifier,
            url: (tokens[2].data as StringTokenData).string,
            requestDefinition: {},
            responseHandlers: [],
          },
          tokens[0],
          tokens[4]
        )
      );
    });

    it('should parse full http call statement', () => {
      const tokens = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'http' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'POST' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'request' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'query' }), // 6
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'q' }), // 8
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: 'input.query',
          sourceScript: 'input.query',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'headers' }), // 12
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'content-type' }), // 14
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '"application/json"',
          sourceScript: '"application/json"',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'body' }), // 18
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'name' }), // 20
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'first' }), // 23
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '"john"',
          sourceScript: '"john"',
          sourceMap: '',
        }),

        tesTok({ kind: LexerTokenKind.NEWLINE }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'last' }), // 27
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '"doe"',
          sourceScript: '"doe"',
          sourceMap: '',
        }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'address' }), // 32
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '.' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'zip' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({
          kind: LexerTokenKind.JESSIE_SCRIPT,
          script: '123',
          sourceScript: '123',
          sourceMap: '',
        }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }), // end body

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }), // end request

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'response' }), // 39
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 200 }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'application/json' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'en-US' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'response' }), // 45
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
      const streamStart = stream.save();

      const expected = tesMatch(
        {
          kind: 'HttpCallStatement',
          method: (tokens[1].data as IdentifierTokenData).identifier,
          url: (tokens[2].data as StringTokenData).string,
          requestDefinition: {
            queryParameters: tesMatch(
              {
                kind: 'ObjectLiteral',
                fields: [
                  tesMatch(
                    {
                      kind: 'Assignment',
                      key: [(tokens[8].data as IdentifierTokenData).identifier],
                      value: tesMatchJessie(tokens[10]),
                    },
                    tokens[8],
                    tokens[10]
                  ),
                ],
              },
              tokens[7],
              tokens[11]
            ),
            headers: tesMatch(
              {
                kind: 'ObjectLiteral',
                fields: [
                  tesMatch(
                    {
                      kind: 'Assignment',
                      key: [(tokens[14].data as StringTokenData).string],
                      value: tesMatchJessiePrimitive(tokens[16]),
                    },
                    tokens[14],
                    tokens[16]
                  ),
                ],
              },
              tokens[13],
              tokens[17]
            ),
            body: tesMatch(
              {
                kind: 'ObjectLiteral',
                fields: [
                  tesMatch(
                    {
                      kind: 'Assignment',
                      key: [
                        (tokens[20].data as IdentifierTokenData).identifier,
                      ],
                      value: tesMatch(
                        {
                          kind: 'ObjectLiteral',
                          fields: [
                            tesMatch(
                              {
                                kind: 'Assignment',
                                key: [
                                  (tokens[23].data as IdentifierTokenData)
                                    .identifier,
                                ],
                                value: tesMatchJessiePrimitive(tokens[25]),
                              },
                              tokens[23],
                              tokens[25]
                            ),
                            tesMatch(
                              {
                                kind: 'Assignment',
                                key: [
                                  (tokens[27].data as IdentifierTokenData)
                                    .identifier,
                                ],
                                value: tesMatchJessiePrimitive(tokens[29]),
                              },
                              tokens[27],
                              tokens[29]
                            ),
                          ],
                        },
                        tokens[22],
                        tokens[30]
                      ),
                    },
                    tokens[20],
                    tokens[30]
                  ),
                  tesMatch(
                    {
                      kind: 'Assignment',
                      key: [
                        (tokens[32].data as IdentifierTokenData).identifier,
                        (tokens[34].data as IdentifierTokenData).identifier,
                      ],
                      value: tesMatchJessiePrimitive(tokens[36]),
                    },
                    tokens[32],
                    tokens[36]
                  ),
                ],
              },
              tokens[19],
              tokens[37]
            ),
          },
          responseHandlers: [
            tesMatch(
              {
                kind: 'HttpResponseHandler',
                statusCode: (tokens[40].data as LiteralTokenData).literal,
                contentType: (tokens[41].data as StringTokenData).string,
                contentLanguage: (tokens[42].data as StringTokenData).string,
                statements: [],
              },
              tokens[39],
              tokens[44]
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
                              (tokens[47].data as IdentifierTokenData)
                                .identifier,
                            ],
                            value: tesMatchJessiePrimitive(tokens[49]),
                          },
                          tokens[47],
                          tokens[49]
                        ),
                      ],
                    },
                    tokens[47],
                    tokens[49]
                  ),
                ],
              },
              tokens[45],
              tokens[50]
            ),
          ],
        },
        tokens[0],
        tokens[51]
      );

      expect(MAP_DEFINITION_HTTP_CALL.tryMatch(stream)).toBeAMatch(expected);
      stream.rollback(streamStart);
      expect(OPERATION_DEFINITION_HTTP_CALL.tryMatch(stream)).toBeAMatch(
        expected
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
      const streamStart = stream.save();

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

      expect(MAP_DEFINITION_STATEMENT.tryMatch(stream)).toBeAMatch(expected);
      stream.rollback(streamStart);
      expect(OPERATION_DEFINITION_STATEMENT.tryMatch(stream)).toBeAMatch(
        expected
      );
    });

    // TODO
    // it('should parse inline call statement', () => {

    // });
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

      const rule = PROFILE_ID;

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

      const rule = PROVIDER_ID;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'Provider',
            providerId: (tokens[2].data as StringTokenData).string,
          },
          tokens[0],
          tokens[2]
        )
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

      const rule = MAP;

      expect(rule.tryMatch(stream)).toBeAMatch(
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
        )
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

      const rule = MAP_DOCUMENT;

      expect(rule.tryMatch(stream)).toBeAMatch(
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
                    .identifier, // TODO
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
        )
      );
    });
  });
});
