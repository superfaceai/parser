import { SyntaxError } from '../../../error';
import {
  IdentifierTokenData,
  JessieScriptTokenData,
  LexerToken,
  LexerTokenData,
  LexerTokenKind,
  StringTokenData,
} from '../../../lexer/token';
import { Location, Source, Span } from '../../../source';
import { RuleResult } from '../../rule';
import { ArrayLexerStream } from '../../util';
import * as rules from './index';
import { MAP_DEFINITION_HTTP_CALL, STATEMENT_CONDITION } from './map';
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
// while also making sure that their spans and locations are random enough so that
// equality checks find when a wrong span or location is calculated.
let TES_TOK_STATE: { start: number; line: number } = { start: 0, line: 1 };
beforeEach(() => {
  TES_TOK_STATE = { start: 0, line: 1 };
});
function tesTok(data: LexerTokenData, bumpLine?: boolean): LexerToken {
  const start = Math.floor(Math.random() * 1000) + TES_TOK_STATE.start * 10000;
  const end = start + Math.floor(Math.random() * 100);

  if (bumpLine === true) {
    TES_TOK_STATE.line += 1;
  }
  const line = TES_TOK_STATE.line;
  const column = start;

  TES_TOK_STATE.start += 1;

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
              tesMatch(
                {
                  kind: 'PrimitiveLiteral',
                  value: 42,
                },
                tokens[1]
              ),
              tesMatch(
                {
                  kind: 'JessieExpression',
                  expression: (tokens[3].data as JessieScriptTokenData).script,
                  source: (tokens[3].data as JessieScriptTokenData)
                    .sourceScript,
                  sourceMap: (tokens[3].data as JessieScriptTokenData)
                    .sourceMap,
                },
                tokens[3]
              ),
              tesMatch(
                {
                  kind: 'JessieExpression',
                  expression: (tokens[5].data as JessieScriptTokenData).script,
                  source: (tokens[5].data as JessieScriptTokenData)
                    .sourceScript,
                  sourceMap: (tokens[5].data as JessieScriptTokenData)
                    .sourceMap,
                },
                tokens[5]
              ),
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

        tesTok({ kind: LexerTokenKind.STRING, string: 'bar' }, true),
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
                  value: tesMatch(
                    {
                      kind: 'JessieExpression',
                      expression: (tokens[3].data as JessieScriptTokenData)
                        .script,
                      source: (tokens[3].data as JessieScriptTokenData)
                        .sourceScript,
                      sourceMap: (tokens[3].data as JessieScriptTokenData)
                        .sourceMap,
                    },
                    tokens[3]
                  ),
                },
                tokens[1],
                tokens[3]
              ),
              tesMatch(
                {
                  kind: 'Assignment',
                  key: [(tokens[4].data as StringTokenData).string],
                  value: tesMatch(
                    {
                      kind: 'PrimitiveLiteral',
                      value: 'hello',
                    },
                    tokens[6]
                  ),
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
            expression: tesMatch(
              {
                kind: 'JessieExpression',
                expression: (tokens[2].data as JessieScriptTokenData).script,
                source: (tokens[2].data as JessieScriptTokenData).sourceScript,
                sourceMap: (tokens[2].data as JessieScriptTokenData).sourceMap,
              },
              tokens[2]
            ),
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
                expression: tesMatch(
                  {
                    kind: 'JessieExpression',
                    expression: (tokens[3].data as JessieScriptTokenData)
                      .script,
                    source: (tokens[3].data as JessieScriptTokenData)
                      .sourceScript,
                    sourceMap: (tokens[3].data as JessieScriptTokenData)
                      .sourceMap,
                  },
                  tokens[3]
                ),
              },
              tokens[1],
              tokens[4]
            ),
            value: tesMatch(
              {
                kind: 'JessieExpression',
                expression: (tokens[5].data as JessieScriptTokenData).script,
                source: (tokens[5].data as JessieScriptTokenData).sourceScript,
                sourceMap: (tokens[5].data as JessieScriptTokenData).sourceMap,
              },
              tokens[5]
            ),
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
                expression: tesMatch(
                  {
                    kind: 'JessieExpression',
                    expression: (tokens[3].data as JessieScriptTokenData)
                      .script,
                    source: (tokens[3].data as JessieScriptTokenData)
                      .sourceScript,
                    sourceMap: (tokens[3].data as JessieScriptTokenData)
                      .sourceMap,
                  },
                  tokens[3]
                ),
              },
              tokens[1],
              tokens[4]
            ),
            value: tesMatch(
              {
                kind: 'JessieExpression',
                expression: (tokens[5].data as JessieScriptTokenData).script,
                source: (tokens[5].data as JessieScriptTokenData).sourceScript,
                sourceMap: (tokens[5].data as JessieScriptTokenData).sourceMap,
              },
              tokens[5]
            ),
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
                expression: tesMatch(
                  {
                    kind: 'JessieExpression',
                    expression: (tokens[4].data as JessieScriptTokenData)
                      .script,
                    source: (tokens[4].data as JessieScriptTokenData)
                      .sourceScript,
                    sourceMap: (tokens[4].data as JessieScriptTokenData)
                      .sourceMap,
                  },
                  tokens[4]
                ),
              },
              tokens[2],
              tokens[5]
            ),
            value: tesMatch(
              {
                kind: 'PrimitiveLiteral',
                value: 15,
              },
              tokens[6]
            ),
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
                expression: tesMatch(
                  {
                    kind: 'JessieExpression',
                    expression: (tokens[4].data as JessieScriptTokenData)
                      .script,
                    source: (tokens[4].data as JessieScriptTokenData)
                      .sourceScript,
                    sourceMap: (tokens[4].data as JessieScriptTokenData)
                      .sourceMap,
                  },
                  tokens[4]
                ),
              },
              tokens[2],
              tokens[5]
            ),
            value: tesMatch(
              {
                kind: 'PrimitiveLiteral',
                value: 15,
              },
              tokens[6]
            ),
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
            value: tesMatch(
              {
                kind: 'PrimitiveLiteral',
                value: 1,
              },
              tokens[6]
            ),
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
            value: tesMatch(
              {
                kind: 'PrimitiveLiteral',
                value: 1,
              },
              tokens[4]
            ),
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
            value: tesMatch(
              {
                kind: 'PrimitiveLiteral',
                value: 1,
              },
              tokens[6]
            ),
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
                  value: tesMatch(
                    {
                      kind: 'PrimitiveLiteral',
                      value: 'hello',
                    },
                    tokens[2]
                  ),
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
                expression: tesMatch(
                  {
                    kind: 'JessieExpression',
                    expression: (tokens[3].data as JessieScriptTokenData)
                      .script,
                    source: (tokens[3].data as JessieScriptTokenData)
                      .sourceScript,
                    sourceMap: (tokens[3].data as JessieScriptTokenData)
                      .sourceMap,
                  },
                  tokens[3]
                ),
              },
              tokens[1],
              tokens[4]
            ),
            assignments: [
              tesMatch(
                {
                  kind: 'Assignment',
                  key: [(tokens[6].data as IdentifierTokenData).identifier],
                  value: tesMatch(
                    {
                      kind: 'PrimitiveLiteral',
                      value: 'hello',
                    },
                    tokens[8]
                  ),
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
  });
});
