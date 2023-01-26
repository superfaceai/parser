import { Source } from '../../../../common/source';
import { PARSED_AST_VERSION, PARSED_VERSION } from '../../../../metadata';
import { SyntaxError } from '../../../error';
import {
  IdentifierTokenData,
  LexerToken,
  LexerTokenData,
  LexerTokenKind,
  LiteralTokenData,
  StringTokenData,
} from '../../../lexer/token';
import { RuleResult } from '../../rule';
import { ArrayLexerStream } from '../../util';
import { HasLocation } from '../common';
import * as rules from '.';

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
      message = SyntaxError.fromSyntaxRuleNoMatch(
        new Source(''),
        result
      ).message;
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

  return new LexerToken(data, {
    start: { line, column, charIndex: start },
    end: { line, column, charIndex: end },
  });
}

function tesMatch<I extends Record<string, unknown>>(
  input: I,
  first: LexerToken,
  last?: LexerToken
): I & HasLocation {
  return {
    ...input,
    location: {
      start: first.location.start,
      end: (last ?? first).location.end,
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
                  name: (tokens[2].data as IdentifierTokenData).identifier,
                  value: (tokens[4].data as LiteralTokenData).literal,
                },
                tokens[2],
                tokens[4]
              ),
              tesMatch(
                {
                  kind: 'EnumValue',
                  name: (tokens[6].data as IdentifierTokenData).identifier,
                  value: (tokens[8].data as LiteralTokenData).literal,
                },
                tokens[6],
                tokens[8]
              ),
              tesMatch(
                {
                  kind: 'EnumValue',
                  name: (tokens[10].data as IdentifierTokenData).identifier,
                  value: (tokens[12].data as StringTokenData).string,
                },
                tokens[10],
                tokens[12]
              ),
              tesMatch(
                {
                  kind: 'EnumValue',
                  name: (tokens[15].data as IdentifierTokenData).identifier,
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
                      name: (tokens[2].data as IdentifierTokenData).identifier,
                      value: (tokens[2].data as IdentifierTokenData).identifier,
                    },
                    tokens[2]
                  ),
                  tesMatch(
                    {
                      kind: 'EnumValue',
                      name: (tokens[4].data as IdentifierTokenData).identifier,
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
                        name: (tokens[2].data as IdentifierTokenData)
                          .identifier,
                        value: (tokens[2].data as IdentifierTokenData)
                          .identifier,
                      },
                      tokens[2]
                    ),
                    tesMatch(
                      {
                        kind: 'EnumValue',
                        name: (tokens[4].data as IdentifierTokenData)
                          .identifier,
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
            documentation: {
              title: 'Title',
              description: 'Description',
              location: tokens[0].location,
            },
          },
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
            documentation: {
              title: 'title',
              description: undefined,
              location: tokens[0].location,
            },
          },
          tokens[1],
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
                      name: (tokens[4].data as IdentifierTokenData).identifier,
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
            documentation: {
              title: 'Title',
              description: 'Description',
              location: tokens[0].location,
            },
          },
          tokens[1],
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
                value: tesMatch(
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

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'example' }), // 24
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'my_example' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'input' }), // 27
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'error' }), // 31
        tesTok({ kind: LexerTokenKind.LITERAL, literal: true }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'example' }), // 35
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'my_example_2' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'input' }), // 38
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }), // 42
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 15 }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }), // 46
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
                value: tesMatch(
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
                value: tesMatch(
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
                value: tesMatch(
                  {
                    kind: 'NonNullDefinition',
                    type: tesMatch(
                      {
                        kind: 'ObjectDefinition',
                        fields: [
                          tesMatch(
                            {
                              kind: 'FieldDefinition',
                              fieldName: (
                                tokens[12].data as IdentifierTokenData
                              ).identifier,
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
              tokens[9],
              tokens[15]
            ),
            error: tesMatch(
              {
                kind: 'UseCaseSlotDefinition',
                value: tesMatch(
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
                                name: (tokens[22].data as IdentifierTokenData)
                                  .identifier,
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
            examples: [
              tesMatch(
                {
                  kind: 'UseCaseSlotDefinition',
                  value: tesMatch(
                    {
                      kind: 'UseCaseExample',
                      exampleName: 'my_example',
                      input: tesMatch(
                        {
                          kind: 'UseCaseSlotDefinition',
                          value: tesMatch(
                            {
                              kind: 'ComlinkObjectLiteral',
                              fields: [],
                            },
                            tokens[28],
                            tokens[29]
                          ),
                        },
                        tokens[27],
                        tokens[29]
                      ),
                      error: tesMatch(
                        {
                          kind: 'UseCaseSlotDefinition',
                          value: tesMatch(
                            {
                              kind: 'ComlinkPrimitiveLiteral',
                              value: true,
                            },
                            tokens[32]
                          ),
                        },
                        tokens[31],
                        tokens[32]
                      ),
                    },
                    tokens[25],
                    tokens[34]
                  ),
                },
                tokens[24],
                tokens[34]
              ),
              tesMatch(
                {
                  kind: 'UseCaseSlotDefinition',
                  value: tesMatch(
                    {
                      kind: 'UseCaseExample',
                      exampleName: 'my_example_2',
                      input: tesMatch(
                        {
                          kind: 'UseCaseSlotDefinition',
                          value: tesMatch(
                            {
                              kind: 'ComlinkObjectLiteral',
                              fields: [],
                            },
                            tokens[39],
                            tokens[40]
                          ),
                        },
                        tokens[38],
                        tokens[40]
                      ),
                      result: tesMatch(
                        {
                          kind: 'UseCaseSlotDefinition',
                          value: tesMatch(
                            {
                              kind: 'ComlinkPrimitiveLiteral',
                              value: 15,
                            },
                            tokens[43]
                          ),
                        },
                        tokens[42],
                        tokens[43]
                      ),
                    },
                    tokens[36],
                    tokens[45]
                  ),
                },
                tokens[35],
                tokens[45]
              ),
            ],
          },
          tokens[0],
          tokens[46]
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
                value: tesMatch(
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
            documentation: {
              title: 'Title',
              description: 'Description',
              location: tokens[0].location,
            },
          },
          tokens[1],
          tokens[6]
        )
      );
    });
  });

  describe('document', () => {
    it('should parse profile header', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'name' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'scope/profile' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'version' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: '1.2.34' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.PROFILE_HEADER;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ProfileHeader',
            scope: 'scope',
            name: 'profile',
            version: {
              major: 1,
              minor: 2,
              patch: 34,
            },
          },
          tokens[0],
          tokens[5]
        )
      );
    });

    it('should parse profile header with documentation', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'name' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'profile-name' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'version' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: '11.12.3' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.PROFILE_HEADER;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ProfileHeader',
            name: 'profile-name',
            version: {
              major: 11,
              minor: 12,
              patch: 3,
            },
            documentation: {
              title: 'Title',
              description: 'Description',
              location: tokens[0].location,
            },
          },
          tokens[1],
          tokens[6]
        )
      );
    });

    it('should parse profile document', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: 'SOF' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'name' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'my_scope/profile' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'version' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: '1.2.3' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model1' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase1' }),
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
            astMetadata: {
              astVersion: PARSED_AST_VERSION,
              parserVersion: PARSED_VERSION,
              sourceChecksum: expect.anything(),
            },
            header: tesMatch(
              {
                kind: 'ProfileHeader',
                scope: 'my_scope',
                name: 'profile',
                version: {
                  major: 1,
                  minor: 2,
                  patch: 3,
                },
              },
              tokens[1],
              tokens[6]
            ),
            definitions: [
              tesMatch(
                {
                  kind: 'NamedModelDefinition',
                  modelName: (tokens[8].data as IdentifierTokenData).identifier,
                  type: tesMatch(
                    {
                      kind: 'ObjectDefinition',
                      fields: [
                        tesMatch(
                          {
                            kind: 'FieldDefinition',
                            fieldName: (tokens[10].data as IdentifierTokenData)
                              .identifier,
                            required: false,
                            type: undefined,
                          },
                          tokens[10]
                        ),
                      ],
                    },
                    tokens[9],
                    tokens[11]
                  ),
                },
                tokens[7],
                tokens[11]
              ),

              tesMatch(
                {
                  kind: 'UseCaseDefinition',
                  useCaseName: (tokens[13].data as IdentifierTokenData)
                    .identifier,
                  safety: undefined,
                  input: undefined,
                  result: tesMatch(
                    {
                      kind: 'UseCaseSlotDefinition',
                      value: tesMatch(
                        {
                          kind: 'ModelTypeName',
                          name: (tokens[16].data as IdentifierTokenData)
                            .identifier,
                        },
                        tokens[16]
                      ),
                    },
                    tokens[15],
                    tokens[16]
                  ),
                  asyncResult: undefined,
                  error: undefined,
                },
                tokens[12],
                tokens[17]
              ),
            ],
          },
          tokens[1],
          tokens[17]
        )
      );
    });

    it('should require full version in profile header', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'name' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'scope/profile' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'version' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: '1.2' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.PROFILE_HEADER;

      expect(rule.tryMatch(stream)).not.toBeAMatch();
    });
  });

  describe('comlink literals', () => {
    it('should parse primitive literal', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'hello' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.COMLINK_PRIMITIVE_LITERAL;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ComlinkPrimitiveLiteral',
            value: 'hello',
          },
          tokens[0]
        )
      );
    });

    it('should parse none literal', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'None' }),
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.COMLINK_NONE_LITERAL;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ComlinkNoneLiteral',
          },
          tokens[0]
        )
      );
    });

    it('should parse object literal', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'foo' }), // 1
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1234 }),
        tesTok({ kind: LexerTokenKind.NEWLINE }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'bar' }), // 5
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'baz' }), // 8
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: true }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }), // 12
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.COMLINK_OBJECT_LITERAL;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ComlinkObjectLiteral',
            fields: [
              tesMatch(
                {
                  kind: 'ComlinkAssignment',
                  key: ['foo'],
                  value: tesMatch(
                    {
                      kind: 'ComlinkPrimitiveLiteral',
                      value: 1234,
                    },
                    tokens[3]
                  ),
                },
                tokens[1],
                tokens[3]
              ),
              tesMatch(
                {
                  kind: 'ComlinkAssignment',
                  key: ['bar'],
                  value: tesMatch(
                    {
                      kind: 'ComlinkObjectLiteral',
                      fields: [
                        tesMatch(
                          {
                            kind: 'ComlinkAssignment',
                            key: ['baz'],
                            value: tesMatch(
                              {
                                kind: 'ComlinkPrimitiveLiteral',
                                value: true,
                              },
                              tokens[10]
                            ),
                          },
                          tokens[8],
                          tokens[10]
                        ),
                      ],
                    },
                    tokens[7],
                    tokens[11]
                  ),
                },
                tokens[5],
                tokens[11]
              ),
            ],
          },
          tokens[0],
          tokens[12]
        )
      );
    });

    it('should parse list literal', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1234 }), // 1
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'hello' }), // 3
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }), // 5
        tesTok({ kind: LexerTokenKind.LITERAL, literal: false }), // 6
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ']' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ',' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }), // 9
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ']' }), // 11
      ];
      const stream = new ArrayLexerStream(tokens);

      const rule = rules.COMLINK_LIST_LITERAL;

      expect(rule.tryMatch(stream)).toBeAMatch(
        tesMatch(
          {
            kind: 'ComlinkListLiteral',
            items: [
              tesMatch(
                {
                  kind: 'ComlinkPrimitiveLiteral',
                  value: 1234,
                },
                tokens[1]
              ),
              tesMatch(
                {
                  kind: 'ComlinkPrimitiveLiteral',
                  value: 'hello',
                },
                tokens[3]
              ),
              tesMatch(
                {
                  kind: 'ComlinkListLiteral',
                  items: [
                    tesMatch(
                      {
                        kind: 'ComlinkPrimitiveLiteral',
                        value: false,
                      },
                      tokens[6]
                    ),
                  ],
                },
                tokens[5],
                tokens[7]
              ),
              tesMatch(
                {
                  kind: 'ComlinkObjectLiteral',
                  fields: [],
                },
                tokens[9],
                tokens[10]
              ),
            ],
          },
          tokens[0],
          tokens[11]
        )
      );
    });
  });
});
