import {
  DecoratorTokenData,
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

// Ensures that token spans are correctly ordered in delcaration order
// while also making sure that their spans and locations are random enough so that
// equality checks find when a wrong span or location is calculated.
let TES_TOK_STATE = 0;
beforeEach(() => {
  TES_TOK_STATE = 0;
});
function tesTok(data: LexerTokenData): LexerToken {
  const start = Math.floor(Math.random() * 1000) + TES_TOK_STATE * 10000;
  const end = start + Math.floor(Math.random() * 100);

  const line = Math.floor(Math.random() * 500);
  const column = Math.floor(Math.random() * 80);

  TES_TOK_STATE += 1;

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
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Boolean' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Number' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'String' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.PRIMITIVE_TYPE_NAME;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'PrimitiveTypeName',
            name: 'boolean',
          },
          tokens[0]
        ),
        optionalFailure: undefined,
      });

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'PrimitiveTypeName',
            name: 'number',
          },
          tokens[1]
        ),
        optionalFailure: undefined,
      });

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'PrimitiveTypeName',
            name: 'string',
          },
          tokens[2]
        ),
        optionalFailure: undefined,
      });
    });

    it('should parse enum type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Enum' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: true }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'hello' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'HI' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.ENUM_DEFINITION;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'EnumDefinition',
            values: [
              tesMatch(
                {
                  kind: 'EnumValue',
                  value: (tokens[2].data as LiteralTokenData).literal,
                },
                tokens[2]
              ),
              tesMatch(
                {
                  kind: 'EnumValue',
                  value: (tokens[3].data as LiteralTokenData).literal,
                },
                tokens[3]
              ),
              tesMatch(
                {
                  kind: 'EnumValue',
                  value: (tokens[4].data as StringTokenData).string,
                },
                tokens[4]
              ),
              tesMatch(
                {
                  kind: 'EnumValue',
                  value: (tokens[5].data as IdentifierTokenData).identifier,
                },
                tokens[5]
              ),
            ],
          },
          tokens[0],
          tokens[6]
        ),
        optionalFailure: undefined,
      });
    });

    it('should parse model type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.MODEL_TYPE_NAME;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'ModelTypeName',
            name: 'MyType',
          },
          tokens[0]
        ),
        optionalFailure: undefined,
      });
    });

    it('should parse object type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.OBJECT_DEFINITION;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
                    tokens[4]
                  ),
                },
                tokens[2],
                tokens[4]
              ),
            ],
          },
          tokens[0],
          tokens[5]
        ),
        optionalFailure: undefined,
      });
    });
  });

  describe('type modifiers', () => {
    it('should parse list type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'String' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ']' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Boolean' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ']' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ']' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.LIST_DEFINITION;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
                        tokens[4]
                      ),
                    },
                    tokens[2],
                    tokens[4]
                  ),
                ],
              },
              tokens[1],
              tokens[5]
            ),
          },
          tokens[0],
          tokens[6]
        ),
        optionalFailure: undefined,
      });

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'ListDefinition',
            elementType: tesMatch(
              {
                kind: 'PrimitiveTypeName',
                name: 'boolean',
              },
              tokens[8]
            ),
          },
          tokens[7],
          tokens[9]
        ),
        optionalFailure: undefined,
      });

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
                  tokens[11]
                ),
              },
              tokens[11],
              tokens[12]
            ),
          },
          tokens[10],
          tokens[13]
        ),
        optionalFailure: undefined,
      });
    });

    it('should parse non-null types', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Enum' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 2 }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Boolean' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NON_NULL_DEFINITION;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'NonNullDefinition',
            type: tesMatch(
              {
                kind: 'EnumDefinition',
                values: [
                  tesMatch(
                    {
                      kind: 'EnumValue',
                      value: (tokens[2].data as LiteralTokenData).literal,
                    },
                    tokens[2]
                  ),
                  tesMatch(
                    {
                      kind: 'EnumValue',
                      value: (tokens[3].data as LiteralTokenData).literal,
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
        ),
        optionalFailure: undefined,
      });

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
        ),
        optionalFailure: undefined,
      });

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
        ),
        optionalFailure: undefined,
      });
    });

    it('should parse union types', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Enum' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 2 }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '|' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Boolean' }),

        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '|' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.UNION_DEFINITION;

      expect(rule.tryMatch(buf)).toMatchObject({
        kind: 'match',
        match: tesMatch(
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
                        value: (tokens[2].data as LiteralTokenData).literal,
                      },
                      tokens[2]
                    ),
                    tesMatch(
                      {
                        kind: 'EnumValue',
                        value: (tokens[3].data as LiteralTokenData).literal,
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
        ),
      });
    });
  });

  describe('fields', () => {
    it('should parse field without type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toMatchObject({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
            type: undefined,
          },
          tokens[0]
        ),
      });
    });

    it('should parse field with type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Boolean' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[0].data as IdentifierTokenData).identifier,
            type: tesMatch(
              {
                kind: 'PrimitiveTypeName',
                name: 'boolean',
              },
              tokens[2]
            ),
          },
          tokens[0],
          tokens[2]
        ),
        optionalFailure: undefined,
      });
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

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
        ),
        optionalFailure: undefined,
      });
    });

    it('should parse field with documentation', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toMatchObject({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'FieldDefinition',
            fieldName: (tokens[1].data as IdentifierTokenData).identifier,
            type: undefined,
            title: 'Title',
            description: 'Description',
          },
          tokens[0],
          tokens[1]
        ),
      });
    });

    it('should parse reusable field', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toMatchObject({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'NamedFieldDefinition',
            fieldName: (tokens[1].data as IdentifierTokenData).identifier,
            type: undefined,
          },
          tokens[0],
          tokens[1]
        ),
      });
    });

    it('should parse reusable field with type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
                      fieldName: (tokens[4].data as IdentifierTokenData)
                        .identifier,
                      type: undefined,
                    },
                    tokens[4]
                  ),
                ],
              },
              tokens[3],
              tokens[5]
            ),
          },
          tokens[0],
          tokens[5]
        ),
        optionalFailure: undefined,
      });
    });

    it('should parse reusable field documentation', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'Description' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_FIELD_DEFINITION;

      expect(rule.tryMatch(buf)).toMatchObject({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'NamedFieldDefinition',
            fieldName: (tokens[2].data as IdentifierTokenData).identifier,
            type: undefined,
            title: undefined,
            description: 'Description',
          },
          tokens[0],
          tokens[2]
        ),
      });
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

      expect(rule.tryMatch(buf)).toMatchObject({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'NamedModelDefinition',
            modelName: (tokens[1].data as IdentifierTokenData).identifier,
            type: undefined,
          },
          tokens[0],
          tokens[1]
        ),
      });
    });

    it('should parse named model with type', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Enum' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_MODEL_DEFINITION;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
                      value: (tokens[5].data as IdentifierTokenData).identifier,
                    },
                    tokens[5]
                  ),
                ],
              },
              tokens[3],
              tokens[6]
            ),
          },
          tokens[0],
          tokens[6]
        ),
        optionalFailure: undefined,
      });
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

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
        ),
        optionalFailure: undefined,
      });
    });

    it('should parse named model with documentation', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.NAMED_MODEL_DEFINITION;

      expect(rule.tryMatch(buf)).toMatchObject({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'NamedModelDefinition',
            modelName: (tokens[2].data as IdentifierTokenData).identifier,
            type: undefined,
            title: 'Title',
            description: 'Description',
          },
          tokens[0],
          tokens[2]
        ),
      });
    });
  });

  describe('usecase', () => {
    it('should parse minimum usecase', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.USECASE_DEFINITION;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
          },
          tokens[0],
          tokens[6]
        ),
        optionalFailure: undefined,
      });
    });

    it('should parse full usecase', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.DECORATOR, decorator: 'safe' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'input' }), // 4
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }), // 8
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'async' }), // 11
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Number' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'error' }), // 20
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'String' }), // 22
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '|' }),

        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Enum' }), // 25
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: true }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
        tesTok({ kind: LexerTokenKind.LITERAL, literal: 2 }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }), // 31
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.USECASE_DEFINITION;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'UseCaseDefinition',
            useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
            safety: (tokens[2].data as DecoratorTokenData).decorator,
            input: tesMatch(
              {
                kind: 'ObjectDefinition',
                fields: [],
              },
              tokens[6],
              tokens[7]
            ),
            result: tesMatch(
              {
                kind: 'ModelTypeName',
                name: (tokens[10].data as IdentifierTokenData).identifier,
              },
              tokens[10]
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
                          fieldName: (tokens[15].data as IdentifierTokenData)
                            .identifier,
                          type: tesMatch(
                            {
                              kind: 'PrimitiveTypeName',
                              name: 'number',
                            },
                            tokens[17]
                          ),
                        },
                        tokens[15],
                        tokens[17]
                      ),
                    ],
                  },
                  tokens[14],
                  tokens[18]
                ),
              },
              tokens[14],
              tokens[19]
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
                        tokens[22]
                      ),
                    },
                    tokens[22],
                    tokens[23]
                  ),
                  tesMatch(
                    {
                      kind: 'EnumDefinition',
                      values: [
                        tesMatch(
                          {
                            kind: 'EnumValue',
                            value: (tokens[27].data as LiteralTokenData)
                              .literal,
                          },
                          tokens[27]
                        ),
                        tesMatch(
                          {
                            kind: 'EnumValue',
                            value: (tokens[28].data as LiteralTokenData)
                              .literal,
                          },
                          tokens[28]
                        ),
                        tesMatch(
                          {
                            kind: 'EnumValue',
                            value: (tokens[29].data as LiteralTokenData)
                              .literal,
                          },
                          tokens[29]
                        ),
                      ],
                    },
                    tokens[25],
                    tokens[30]
                  ),
                ],
              },
              tokens[22],
              tokens[30]
            ),
          },
          tokens[0],
          tokens[31]
        ),
        optionalFailure: undefined,
      });
    });

    it('should parse usecase with documentation', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'result' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.USECASE_DEFINITION;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'UseCaseDefinition',
            useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
            safety: undefined,
            input: undefined,
            result: tesMatch(
              {
                kind: 'ModelTypeName',
                name: (tokens[6].data as IdentifierTokenData).identifier,
              },
              tokens[6]
            ),
            asyncResult: undefined,
            error: undefined,
            title: 'Title',
            description: 'Description',
          },
          tokens[0],
          tokens[7]
        ),
        optionalFailure: undefined,
      });
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

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
          {
            kind: 'ProfileId',
            profileId: (tokens[2].data as StringTokenData).string,
          },
          tokens[0],
          tokens[2]
        ),
        optionalFailure: undefined,
      });
    });

    it('should parse profile', () => {
      const tokens: ReadonlyArray<LexerToken> = [
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
        tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.PROFILE;

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
        ),
        optionalFailure: undefined,
      });
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

      expect(rule.tryMatch(buf)).toStrictEqual({
        kind: 'match',
        match: tesMatch(
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
        ),
        optionalFailure: undefined,
      });
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
        tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
        tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),
        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

        tesTok({ kind: LexerTokenKind.SEPARATOR, separator: 'EOF' }),
      ];
      const buf = new BufferedIterator(tokens[Symbol.iterator]());

      const rule = rules.PROFILE_DOCUMENT;

      expect(rule.tryMatch(buf)).toMatchObject({
        kind: 'match',
        match: tesMatch(
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
                      name: (tokens[14].data as IdentifierTokenData).identifier,
                    },
                    tokens[14]
                  ),
                  asyncResult: undefined,
                  error: undefined,
                },
                tokens[9],
                tokens[15]
              ),
            ],
          },
          tokens[1],
          tokens[15]
        ),
      });
    });
  });
});
