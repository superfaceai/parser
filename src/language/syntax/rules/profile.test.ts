import { SyntaxError } from '../../error';
import {
  IdentifierTokenData,
  LexerToken,
  LexerTokenData,
  LexerTokenKind,
  LiteralTokenData,
  StringTokenData,
} from '../../lexer/token';
import { Location, Source, Span } from '../../source';
import { RuleResult } from '../rule';
import { ArrayLexerStream } from '../util';
import * as rules from './profile';

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

describe('profile syntax rules', () => {
  describe('types', () => {
    it('should parse scalar type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'boolean' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'number' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'string' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.PRIMITIVE_TYPE_NAME;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'PrimitiveTypeName',
            name: 'boolean',
          },
          tokens[0]
        )
      );

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'PrimitiveTypeName',
            name: 'number',
          },
          tokens[1]
        )
      );

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'PrimitiveTypeName',
            name: 'string',
          },
          tokens[2]
        )
      );
    });

    it('should parse enum type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'enum' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'one' }), // 2
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'true' }), // 6
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: true }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'hello' }), // 10
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'hello' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'hi' }), // 15

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.ENUM_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'EnumDefinition',
            values: [
              tesMatch(
                {
                  kind: 'EnumValue',
                  value: (tokens[4].data as LiteralTokenData).literal,
                },
                tokens[2],
                tokens[4]
              ),
              tesMatch(
                {
                  kind: 'EnumValue',
                  value: (tokens[8].data as LiteralTokenData).literal,
                },
                tokens[6],
                tokens[8]
              ),
              tesMatch(
                {
                  kind: 'EnumValue',
                  value: (tokens[12].data as StringTokenData).string,
                },
                tokens[10],
                tokens[12]
              ),
              tesMatch(
                {
                  kind: 'EnumValue',
                  value: (tokens[15].data as IdentifierTokenData).identifier,
                },
                tokens[15]
              ),
            ],
          },
          tokens[0],
          tokens[16]
        )
      );
    });

    it('should parse model type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.MODEL_TYPE_NAME;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ModelTypeName',
            name: 'MyType',
          },
          tokens[0]
        )
      );
    });

    it('should parse object type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field1' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field2' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.OBJECT_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ObjectDefinition',
            fields: [
              tesMatch(
                {
                  kind: 'FieldDefinition',
                  fieldName: (tokens[1].data as IdentifierTokenData).identifier,
                  required: false,
                  type: undefined,
                },
                tokens[1]
              ),
              tesMatch(
                {
                  kind: 'FieldDefinition',
                  fieldName: (tokens[3].data as IdentifierTokenData).identifier,
                  required: false,
                  type: tesMatch(
                    {
                      kind: 'ModelTypeName',
                      name: 'MyType',
                    },
                    tokens[4]
                  ),
                },
                tokens[3],
                tokens[4]
              ),
            ],
          },
          tokens[0],
          tokens[5]
        )
      );
    });
  });

  describe('type modifiers', () => {
    it('should parse list type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'string' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ']' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'boolean' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ']' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ']' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.LIST_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ListDefinition',
            elementType: tesMatch(
              {
                kind: 'ObjectDefinition',
                fields: [
                  tesMatch(
                    {
                      kind: 'FieldDefinition',
                      fieldName: (tokens[2].data as IdentifierTokenData)
                        .identifier,
                      required: false,
                      type: tesMatch(
                        {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                        tokens[3]
                      ),
                    },
                    tokens[2],
                    tokens[3]
                  ),
                ],
              },
              tokens[1],
              tokens[4]
            ),
          },
          tokens[0],
          tokens[5]
        )
      );

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ListDefinition',
            elementType: tesMatch(
              {
                kind: 'PrimitiveTypeName',
                name: 'boolean',
              },
              tokens[7]
            ),
          },
          tokens[6],
          tokens[8]
        )
      );

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ListDefinition',
            elementType: tesMatch(
              {
                kind: 'NonNullDefinition',
                type: tesMatch(
                  {
                    kind: 'ModelTypeName',
                    name: 'MyType',
                  },
                  tokens[10]
                ),
              },
              tokens[10],
              tokens[11]
            ),
          },
          tokens[9],
          tokens[12]
        )
      );
    });

    it('should parse non-null types', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'enum' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'value1' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'value2' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'boolean' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.TYPE;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'NonNullDefinition',
            type: tesMatch(
              {
                kind: 'EnumDefinition',
                values: [
                  tesMatch(
                    {
                      kind: 'EnumValue',
                      value: (tokens[2].data as IdentifierTokenData).identifier,
                    },
                    tokens[2]
                  ),
                  tesMatch(
                    {
                      kind: 'EnumValue',
                      value: (tokens[4].data as IdentifierTokenData).identifier,
                    },
                    tokens[4]
                  ),
                ],
              },
              tokens[0],
              tokens[5]
            ),
          },
          tokens[0],
          tokens[6]
        )
      );

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'NonNullDefinition',
            type: tesMatch(
              {
                kind: 'PrimitiveTypeName',
                name: 'boolean',
              },
              tokens[7]
            ),
          },
          tokens[7],
          tokens[8]
        )
      );

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'NonNullDefinition',
            type: tesMatch(
              {
                kind: 'ModelTypeName',
                name: 'MyType',
              },
              tokens[9]
            ),
          },
          tokens[9],
          tokens[10]
        )
      );
    });

    it('should parse union types', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'enum' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'value1' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'value2' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '|' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'boolean' }),

        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '|' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.TYPE;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'UnionDefinition',
            types: [
              tesMatch(
                {
                  kind: 'EnumDefinition',
                  values: [
                    tesMatch(
                      {
                        kind: 'EnumValue',
                        value: (tokens[2].data as IdentifierTokenData)
                          .identifier,
                      },
                      tokens[2]
                    ),
                    tesMatch(
                      {
                        kind: 'EnumValue',
                        value: (tokens[4].data as IdentifierTokenData)
                          .identifier,
                      },
                      tokens[4]
                    ),
                  ],
                },
                tokens[0],
                tokens[5]
              ),
              tesMatch(
                {
                  kind: 'PrimitiveTypeName',
                  name: 'boolean',
                },
                tokens[7]
              ),
              tesMatch(
                {
                  kind: 'NonNullDefinition',
                  type: tesMatch(
                    {
                      kind: 'ModelTypeName',
                      name: (tokens[9].data as IdentifierTokenData).identifier,
                    },
                    tokens[9]
                  ),
                },
                tokens[9],
                tokens[10]
              ),
            ],
          },
          tokens[0],
          tokens[10]
        )
      );
    });
  });

  describe('fields', () => {
    it('should parse field without type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
            required: false,
            type: undefined,
          },
          tokens[0]
        )
      );
    });

    it('should parse field with type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'boolean' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
            required: false,
            type: tesMatch(
              {
                kind: 'PrimitiveTypeName',
                name: 'boolean',
              },
              tokens[1]
            ),
          },
          tokens[0],
          tokens[1]
        )
      );
    });

    it('should parse field with object type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
            required: false,
            type: tesMatch(
              {
                kind: 'ObjectDefinition',
                fields: [
                  tesMatch(
                    {
                      kind: 'FieldDefinition',
                      fieldName: (tokens[2].data as IdentifierTokenData)
                        .identifier,
                      required: false,
                      type: undefined,
                    },
                    tokens[2]
                  ),
                ],
              },
              tokens[1],
              tokens[3]
            ),
          },
          tokens[0],
          tokens[3]
        )
      );
    });

    it('should parse required field with type and trailing comma', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'string' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
            required: true,
            type: tesMatch(
              {
                kind: 'PrimitiveTypeName',
                name: 'string',
              },
              tokens[2]
            ),
          },
          tokens[0],
          tokens[2]
        )
      );
    });

    it('should parse required field with type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'string' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
            required: true,
            type: tesMatch(
              {
                kind: 'PrimitiveTypeName',
                name: 'string',
              },
              tokens[2]
            ),
          },
          tokens[0],
          tokens[2]
        )
      );
    });

    it('should parse required field with trailing comma', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
            required: true,
            type: undefined,
          },
          tokens[0],
          tokens[1]
        )
      );
    });

    it('should parse required field', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
            required: true,
            type: undefined,
          },
          tokens[0],
          tokens[1]
        )
      );
    });

    it('should parse field with documentation', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[1].data as IdentifierTokenData).identifier,
            required: false,
            type: undefined,
            title: 'Title',
            description: 'Description',
          },
          tokens[0],
          tokens[1]
        )
      );
    });

    it('should parse reusable field', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.NAMED_FIELD_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'NamedFieldDefinition',
            fieldName: (tokens[1].data as IdentifierTokenData).identifier,
            type: undefined,
          },
          tokens[0],
          tokens[1]
        )
      );
    });

    it('should parse reusable field with type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.NAMED_FIELD_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'NamedFieldDefinition',
            fieldName: (tokens[1].data as IdentifierTokenData).identifier,
            type: tesMatch(
              {
                kind: 'ObjectDefinition',
                fields: [
                  tesMatch(
                    {
                      kind: 'FieldDefinition',
                      fieldName: (tokens[3].data as IdentifierTokenData)
                        .identifier,
                      required: false,
                      type: undefined,
                    },
                    tokens[3]
                  ),
                ],
              },
              tokens[2],
              tokens[4]
            ),
          },
          tokens[0],
          tokens[4]
        )
      );
    });

    it('should parse reusable field documentation', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'title' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.NAMED_FIELD_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'NamedFieldDefinition',
            fieldName: (tokens[2].data as IdentifierTokenData).identifier,
            type: undefined,
            title: 'title',
            description: undefined,
          },
          tokens[0],
          tokens[2]
        )
      );
    });
  });

  describe('model', () => {
    it('should parse named model', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.NAMED_MODEL_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'NamedModelDefinition',
            modelName: (tokens[1].data as IdentifierTokenData).identifier,
            type: undefined,
          },
          tokens[0],
          tokens[1]
        )
      );
    });

    it('should parse named model with type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'enum' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.NAMED_MODEL_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'NamedModelDefinition',
            modelName: (tokens[1].data as IdentifierTokenData).identifier,
            type: tesMatch(
              {
                kind: 'EnumDefinition',
                values: [
                  tesMatch(
                    {
                      kind: 'EnumValue',
                      value: (tokens[4].data as IdentifierTokenData).identifier,
                    },
                    tokens[4]
                  ),
                ],
              },
              tokens[2],
              tokens[5]
            ),
          },
          tokens[0],
          tokens[5]
        )
      );
    });

    it('should parse named model with object type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.NAMED_MODEL_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'NamedModelDefinition',
            modelName: (tokens[1].data as IdentifierTokenData).identifier,
            type: tesMatch(
              {
                kind: 'ObjectDefinition',
                fields: [
                  tesMatch(
                    {
                      kind: 'FieldDefinition',
                      fieldName: (tokens[3].data as IdentifierTokenData)
                        .identifier,
                      required: false,
                      type: undefined,
                    },
                    tokens[3]
                  ),
                ],
              },
              tokens[2],
              tokens[4]
            ),
          },
          tokens[0],
          tokens[4]
        )
      );
    });

    it('should parse named model with documentation', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.NAMED_MODEL_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'NamedModelDefinition',
            modelName: (tokens[2].data as IdentifierTokenData).identifier,
            type: undefined,
            title: 'Title',
            description: 'Description',
          },
          tokens[0],
          tokens[2]
        )
      );
    });
  });

  describe('usecase', () => {
    it('should parse minimum usecase', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Ping' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.USECASE_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'UseCaseDefinition',
            useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
            safety: undefined,
            input: undefined,
            result: undefined,
            asyncResult: undefined,
            error: undefined,
          },
          tokens[0],
          tokens[3]
        )
      );
    });

    it('should parse result only usecase', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.USECASE_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'UseCaseDefinition',
            useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
            safety: undefined,
            input: undefined,
            result: tesMatch(
              {
                kind: 'UseCaseSlotDefinition',
                type: tesMatch(
                  {
                    kind: 'ModelTypeName',
                    name: (tokens[4].data as IdentifierTokenData).identifier,
                  },
                  tokens[4]
                ),
              },
              tokens[3],
              tokens[4]
            ),
            asyncResult: undefined,
            error: undefined,
          },
          tokens[0],
          tokens[5]
        )
      );
    });

    it('should parse full usecase', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'safe' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'input' }), // 4
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }), // 7
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'async' }), // 9
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'number' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'error' }), // 16
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'string' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '|' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'enum' }), // 20
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'value' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }), // 24
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.USECASE_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'UseCaseDefinition',
            useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
            safety: 'safe',
            input: tesMatch(
              {
                kind: 'UseCaseSlotDefinition',
                type: tesMatch(
                  {
                    kind: 'ObjectDefinition',
                    fields: [],
                  },
                  tokens[5],
                  tokens[6]
                ),
              },
              tokens[4],
              tokens[6]
            ),
            result: tesMatch(
              {
                kind: 'UseCaseSlotDefinition',
                type: tesMatch(
                  {
                    kind: 'ModelTypeName',
                    name: (tokens[8].data as IdentifierTokenData).identifier,
                  },
                  tokens[8]
                ),
              },
              tokens[7],
              tokens[8]
            ),
            asyncResult: tesMatch(
              {
                kind: 'UseCaseSlotDefinition',
                type: tesMatch(
                  {
                    kind: 'NonNullDefinition',
                    type: tesMatch(
                      {
                        kind: 'ObjectDefinition',
                        fields: [
                          tesMatch(
                            {
                              kind: 'FieldDefinition',
                              fieldName: (tokens[12]
                                .data as IdentifierTokenData).identifier,
                              required: false,
                              type: tesMatch(
                                {
                                  kind: 'PrimitiveTypeName',
                                  name: 'number',
                                },
                                tokens[13]
                              ),
                            },
                            tokens[12],
                            tokens[13]
                          ),
                        ],
                      },
                      tokens[11],
                      tokens[14]
                    ),
                  },
                  tokens[11],
                  tokens[15]
                ),
              },
              tokens[10],
              tokens[15]
            ),
            error: tesMatch(
              {
                kind: 'UseCaseSlotDefinition',
                type: tesMatch(
                  {
                    kind: 'UnionDefinition',
                    types: [
                      tesMatch(
                        {
                          kind: 'NonNullDefinition',
                          type: tesMatch(
                            {
                              kind: 'PrimitiveTypeName',
                              name: 'string',
                            },
                            tokens[17]
                          ),
                        },
                        tokens[17],
                        tokens[18]
                      ),
                      tesMatch(
                        {
                          kind: 'EnumDefinition',
                          values: [
                            tesMatch(
                              {
                                kind: 'EnumValue',
                                value: (tokens[22].data as IdentifierTokenData)
                                  .identifier,
                              },
                              tokens[22]
                            ),
                          ],
                        },
                        tokens[20],
                        tokens[23]
                      ),
                    ],
                  },
                  tokens[17],
                  tokens[23]
                ),
              },
              tokens[16],
              tokens[23]
            ),
          },
          tokens[0],
          tokens[24]
        )
      );
    });

    it('should parse usecase with documentation', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.USECASE_DEFINITION;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'UseCaseDefinition',
            useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
            safety: undefined,
            input: undefined,
            result: tesMatch(
              {
                kind: 'UseCaseSlotDefinition',
                type: tesMatch(
                  {
                    kind: 'ModelTypeName',
                    name: (tokens[5].data as IdentifierTokenData).identifier,
                  },
                  tokens[5]
                ),
              },
              tokens[4],
              tokens[5]
            ),
            asyncResult: undefined,
            error: undefined,
            title: 'Title',
            description: 'Description',
          },
          tokens[0],
          tokens[6]
        )
      );
    });
  });

  describe('document', () => {
    it('should parse profile id', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.PROFILE_ID;

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

    it('should parse profile', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.PROFILE;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'Profile',
            profileId: tesMatch(
              {
                kind: 'ProfileId',
                profileId: (tokens[2].data as StringTokenData).string,
              },
              tokens[0],
              tokens[2]
            ),
          },
          tokens[0],
          tokens[2]
        )
      );
    });

    it('should parse profile with documentation', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.PROFILE;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'Profile',
            profileId: tesMatch(
              {
                kind: 'ProfileId',
                profileId: (tokens[3].data as StringTokenData).string,
              },
              tokens[1],
              tokens[3]
            ),
            title: 'Title',
            description: 'Description',
          },
          tokens[0],
          tokens[3]
        )
      );
    });

    it('should parse profile document', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: 'SOF' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: 'EOF' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.PROFILE_DOCUMENT;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ProfileDocument',
            profile: tesMatch(
              {
                kind: 'Profile',
                profileId: tesMatch(
                  {
                    kind: 'ProfileId',
                    profileId: (tokens[3].data as StringTokenData).string,
                  },
                  tokens[1],
                  tokens[3]
                ),
              },
              tokens[1],
              tokens[3]
            ),
            definitions: [
              tesMatch(
                {
                  kind: 'NamedModelDefinition',
                  modelName: (tokens[4].data as IdentifierTokenData).identifier,
                  type: tesMatch(
                    {
                      kind: 'ObjectDefinition',
                      fields: [
                        tesMatch(
                          {
                            kind: 'FieldDefinition',
                            fieldName: (tokens[7].data as IdentifierTokenData)
                              .identifier,
                            required: false,
                            type: undefined,
                          },
                          tokens[7]
                        ),
                      ],
                    },
                    tokens[6],
                    tokens[8]
                  ),
                },
                tokens[4],
                tokens[8]
              ),

              tesMatch(
                {
                  kind: 'UseCaseDefinition',
                  useCaseName: (tokens[10].data as IdentifierTokenData)
                    .identifier,
                  safety: undefined,
                  input: undefined,
                  result: tesMatch(
                    {
                      kind: 'UseCaseSlotDefinition',
                      type: tesMatch(
                        {
                          kind: 'ModelTypeName',
                          name: (tokens[13].data as IdentifierTokenData)
                            .identifier,
                        },
                        tokens[13]
                      ),
                    },
                    tokens[12],
                    tokens[13]
                  ),
                  asyncResult: undefined,
                  error: undefined,
                },
                tokens[9],
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
