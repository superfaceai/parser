import {
  IdentifierTokenData,
  LexerToken,
  LexerTokenData,
  LexerTokenKind,
  LiteralTokenData,
  StringTokenData,
} from '../../lexer/token';
import { Location, Span } from '../../source';
import { BufferedIterator } from '../util';
import * as rules from './profile';
import { RuleResult } from './rule';

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
      message = "Rule didn't match";
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

  return new LexerToken(data, { start, end }, { line, column });
}

function tesMatch<I extends {}>(
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

describe('syntax rules', () => {
  describe('types', () => {
    it('should parse scalar type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'boolean' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'number' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'string' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.PRIMITIVE_TYPE_NAME;

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'PrimitiveTypeName',
            name: 'boolean',
          },
          tokens[0]
        )
      );

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'PrimitiveTypeName',
            name: 'number',
          },
          tokens[1]
        )
      );

      expect(rule.tryMatch(buf)).toBeAMatch(
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

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'one' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'true' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: true }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'hello' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'hello' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'hi' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.ENUM_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
                  value: (tokens[7].data as LiteralTokenData).literal,
                },
                tokens[5],
                tokens[7]
              ),
              tesMatch(
                {
                  kind: 'EnumValue',
                  value: (tokens[10].data as StringTokenData).string,
                },
                tokens[8],
                tokens[10]
              ),
              tesMatch(
                {
                  kind: 'EnumValue',
                  value: (tokens[11].data as IdentifierTokenData).identifier,
                },
                tokens[11]
              ),
            ],
          },
          tokens[0],
          tokens[12]
        )
      );
    });

    it('should parse model type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.MODEL_TYPE_NAME;

      expect(rule.tryMatch(buf)).toBeAMatch(
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

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field2' }, true),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.OBJECT_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'ObjectDefinition',
            fields: [
              tesMatch(
                {
                  kind: 'FieldDefinition',
                  fieldName: (tokens[1].data as IdentifierTokenData).identifier,
                  type: undefined,
                },
                tokens[1]
              ),
              tesMatch(
                {
                  kind: 'FieldDefinition',
                  fieldName: (tokens[2].data as IdentifierTokenData).identifier,
                  type: tesMatch(
                    {
                      kind: 'ModelTypeName',
                      name: 'MyType',
                    },
                    tokens[3]
                  ),
                },
                tokens[2],
                tokens[3]
              ),
            ],
          },
          tokens[0],
          tokens[4]
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
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.LIST_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
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

      expect(rule.tryMatch(buf)).toBeAMatch(
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

      expect(rule.tryMatch(buf)).toBeAMatch(
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
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'value2' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'boolean' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.TYPE;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
                      value: (tokens[3].data as IdentifierTokenData).identifier,
                    },
                    tokens[3]
                  ),
                ],
              },
              tokens[0],
              tokens[4]
            ),
          },
          tokens[0],
          tokens[5]
        )
      );

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'NonNullDefinition',
            type: tesMatch(
              {
                kind: 'PrimitiveTypeName',
                name: 'boolean',
              },
              tokens[6]
            ),
          },
          tokens[6],
          tokens[7]
        )
      );

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'NonNullDefinition',
            type: tesMatch(
              {
                kind: 'ModelTypeName',
                name: 'MyType',
              },
              tokens[8]
            ),
          },
          tokens[8],
          tokens[9]
        )
      );
    });

    it('should parse union types', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'enum' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'value1' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'value2' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '|' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'boolean' }),

        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '|' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.TYPE;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
                        value: (tokens[3].data as IdentifierTokenData)
                          .identifier,
                      },
                      tokens[3]
                    ),
                  ],
                },
                tokens[0],
                tokens[4]
              ),
              tesMatch(
                {
                  kind: 'PrimitiveTypeName',
                  name: 'boolean',
                },
                tokens[6]
              ),
              tesMatch(
                {
                  kind: 'NonNullDefinition',
                  type: tesMatch(
                    {
                      kind: 'ModelTypeName',
                      name: (tokens[8].data as IdentifierTokenData).identifier,
                    },
                    tokens[8]
                  ),
                },
                tokens[8],
                tokens[9]
              ),
            ],
          },
          tokens[0],
          tokens[9]
        )
      );
    });
  });

  describe('fields', () => {
    it('should parse field without type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
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
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
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

    it('should parse field with object type sugar', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
            type: tesMatch(
              {
                kind: 'ObjectDefinition',
                fields: [
                  tesMatch(
                    {
                      kind: 'FieldDefinition',
                      fieldName: (tokens[2].data as IdentifierTokenData)
                        .identifier,
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

    it('should parse field with documentation', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[1].data as IdentifierTokenData).identifier,
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
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
        tesTok({ kind: LexerTokenKind.STRING, string: 'Description' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'NamedFieldDefinition',
            fieldName: (tokens[2].data as IdentifierTokenData).identifier,
            type: undefined,
            title: undefined,
            description: 'Description',
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
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_MODEL_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_MODEL_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
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

    it('should parse named model with object type sugar', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_MODEL_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_MODEL_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.USECASE_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'UseCaseDefinition',
            useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
            safety: undefined,
            input: undefined,
            result: tesMatch(
              {
                kind: 'ModelTypeName',
                name: (tokens[4].data as IdentifierTokenData).identifier,
              },
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
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.USECASE_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'UseCaseDefinition',
            useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
            safety: 'safe',
            input: tesMatch(
              {
                kind: 'ObjectDefinition',
                fields: [],
              },
              tokens[5],
              tokens[6]
            ),
            result: tesMatch(
              {
                kind: 'ModelTypeName',
                name: (tokens[8].data as IdentifierTokenData).identifier,
              },
              tokens[8]
            ),
            asyncResult: tesMatch(
              {
                kind: 'NonNullDefinition',
                type: tesMatch(
                  {
                    kind: 'ObjectDefinition',
                    fields: [
                      tesMatch(
                        {
                          kind: 'FieldDefinition',
                          fieldName: (tokens[12].data as IdentifierTokenData)
                            .identifier,
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
            error: tesMatch(
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
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.USECASE_DEFINITION;

      expect(rule.tryMatch(buf)).toBeAMatch(
        tesMatch(
          {
            kind: 'UseCaseDefinition',
            useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
            safety: undefined,
            input: undefined,
            result: tesMatch(
              {
                kind: 'ModelTypeName',
                name: (tokens[5].data as IdentifierTokenData).identifier,
              },
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
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.PROFILE_ID;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.PROFILE;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.PROFILE;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.PROFILE_DOCUMENT;

      expect(rule.tryMatch(buf)).toBeAMatch(
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
                      kind: 'ModelTypeName',
                      name: (tokens[13].data as IdentifierTokenData).identifier,
                    },
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
