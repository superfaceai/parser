import * as rules from './profile';
import { LexerToken, LexerTokenData, LexerTokenKind, IdentifierTokenData, LiteralTokenData, StringTokenData, DecoratorTokenData } from '../../lexer/token';
import { BufferedIterator } from '../util';
import { Location, Span } from '../../source';

// Ensures that token spans are correctly ordered in delcaration order
// while also making sure that their spans and locations are random enough so that
// equality checks find when a wrong span or location is calculated.
let TES_TOK_STATE = 0
beforeEach(() => {
	TES_TOK_STATE = 0
})
function tesTok(data: LexerTokenData): LexerToken {
	const start = Math.floor(Math.random() * 1000) + TES_TOK_STATE * 10000;
	const end = start + Math.floor(Math.random() * 100);

	const line = Math.floor(Math.random() * 500);
	const column = Math.floor(Math.random() * 80);

	TES_TOK_STATE += 1;

	return new LexerToken(
		data,
		{ start, end },
		{ line, column }
	)
}

function tesMatch<I extends {}>(input: I, first: LexerToken, last?: LexerToken): I & { location: Location, span: Span } {
	return {
		...input,
		location: first.location,
		span: {
			start: first.span.start,
			end: (last ?? first).span.end
		}
	};
}

describe('syntax rules', () => {
	describe('types', () => {
		it('should parse scalar type', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Boolean' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Number' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'String' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.SCALAR_TYPE

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ScalarTypeNode',
						name: 'boolean'
					}, tokens[0])
				}
			)

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ScalarTypeNode',
						name: 'number'
					}, tokens[1])
				}
			)

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ScalarTypeNode',
						name: 'string'
					}, tokens[2])
				}
			)
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
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.ENUM_TYPE

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'EnumTypeNode',
    					enumValues: [
							(tokens[2].data as LiteralTokenData).literal,
							(tokens[3].data as LiteralTokenData).literal,
							(tokens[4].data as StringTokenData).string,
							(tokens[5].data as IdentifierTokenData).identifier
						]
					}, tokens[0], tokens[6])
				}
			)
		});

		it('should parse model type', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.MODEL_TYPE

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ModelTypeNode',
						name: 'MyType'
					}, tokens[0])
				}
			)
		});

		it('should parse object type', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
				
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
				
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'MyType' }),

				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.OBJECT_TYPE

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ObjectTypeNode',
    					fields: [
							tesMatch({
								kind: 'FieldDefinitionNode',
								fieldName: tesMatch({
									kind: 'FieldNameNode',
									fieldName: (tokens[1].data as IdentifierTokenData).identifier
								}, tokens[1]),
								type: undefined
							}, tokens[1]),
							tesMatch({
								kind: 'FieldDefinitionNode',
								fieldName: tesMatch({
									kind: 'FieldNameNode',
									fieldName: (tokens[2].data as IdentifierTokenData).identifier
								}, tokens[2]),
								type: tesMatch({
									kind: 'ModelTypeNode',
									name: 'MyType'
								}, tokens[4])
							}, tokens[2], tokens[4])
						]
					}, tokens[0], tokens[5])
				}
			)
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
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.LIST_TYPE

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ListTypeNode',
						type: tesMatch({
							kind: 'ObjectTypeNode',
							fields: [
								tesMatch({
									kind: 'FieldDefinitionNode',
									fieldName: tesMatch({
										kind: 'FieldNameNode',
										fieldName: (tokens[2].data as IdentifierTokenData).identifier
									}, tokens[2]),
									type: tesMatch({
										kind: 'ScalarTypeNode',
										name: 'string'
									}, tokens[4])
								}, tokens[2], tokens[4])
							]
						}, tokens[1], tokens[5])
					}, tokens[0], tokens[6])
				}
			)

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ListTypeNode',
						type: tesMatch({
							kind: 'ScalarTypeNode',
							name: 'boolean'
						}, tokens[8])
					}, tokens[7], tokens[9])
				}
			)

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ListTypeNode',
						type:  tesMatch({
							kind: 'NonNullTypeNode',
							type: tesMatch({
								kind: 'ModelTypeNode',
								name: 'MyType'
							}, tokens[11])
						}, tokens[11], tokens[12])
					}, tokens[10], tokens[13])
				}
			)
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
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.NON_NULL_TYPE

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'NonNullTypeNode',
						type: tesMatch({
							kind: 'EnumTypeNode',
							enumValues: [
								(tokens[2].data as LiteralTokenData).literal,
								(tokens[3].data as LiteralTokenData).literal
							]
						}, tokens[0], tokens[4])
					}, tokens[0], tokens[5])
				}
			)

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'NonNullTypeNode',
						type: tesMatch({
							kind: 'ScalarTypeNode',
							name: 'boolean'
						}, tokens[6])
					}, tokens[6], tokens[7])
				}
			)

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'NonNullTypeNode',
						type: tesMatch({
							kind: 'ModelTypeNode',
							name: 'MyType'
						}, tokens[8])
					}, tokens[8], tokens[9])
				}
			)
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
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.UNION_TYPE

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'UnionTypeNode',
						types: [
							tesMatch({
								kind: 'EnumTypeNode',
								enumValues: [
									(tokens[2].data as LiteralTokenData).literal,
									(tokens[3].data as LiteralTokenData).literal
								]
							}, tokens[0], tokens[4]),
							tesMatch({
								kind: 'ScalarTypeNode',
								name: 'boolean'
							}, tokens[6]),
							tesMatch({
								kind: 'NonNullTypeNode',
								type: tesMatch({
									kind: 'ModelTypeNode',
									name: (tokens[8].data as IdentifierTokenData).identifier
								}, tokens[8])
							}, tokens[8], tokens[9])
						]
					}, tokens[0], tokens[9])
				}
			)
		});
	});

	describe('fields', () => {
		it('should parse field name', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.FIELD_NAME

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'FieldNameNode',
						fieldName: (tokens[0].data as IdentifierTokenData).identifier
					}, tokens[0])
				}
			)
		});

		it('should parse field without type', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.FIELD_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'FieldDefinitionNode',
						fieldName: tesMatch({
							kind: 'FieldNameNode',
							fieldName: (tokens[0].data as IdentifierTokenData).identifier
						}, tokens[0]),
						type: undefined
					}, tokens[0])
				}
			)
		});

		it('should parse field with type', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Boolean' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.FIELD_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'FieldDefinitionNode',
						fieldName: tesMatch({
							kind: 'FieldNameNode',
							fieldName: (tokens[0].data as IdentifierTokenData).identifier
						}, tokens[0]),
						type: tesMatch({
							kind: 'ScalarTypeNode',
							name: 'boolean'
						}, tokens[2])
					}, tokens[0], tokens[2])
				}
			)
		});

		it('should parse field with object type sugar', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.FIELD_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'FieldDefinitionNode',
						fieldName: tesMatch({
							kind: 'FieldNameNode',
							fieldName: (tokens[0].data as IdentifierTokenData).identifier
						}, tokens[0]),
						type: tesMatch({
							kind: 'ObjectTypeNode',
							fields: [
								tesMatch({
									kind: 'FieldDefinitionNode',
									fieldName: tesMatch({
										kind: 'FieldNameNode',
										fieldName: (tokens[2].data as IdentifierTokenData).identifier
									}, tokens[2]),
									type: undefined
								}, tokens[2])
							]
						}, tokens[1], tokens[3])
					}, tokens[0], tokens[3])
				}
			)
		});

		it('should parse field with documentation', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.FIELD_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'FieldDefinitionNode',
						fieldName: tesMatch({
							kind: 'FieldNameNode',
							fieldName: (tokens[1].data as IdentifierTokenData).identifier
						}, tokens[1]),
						type: undefined,
						title: 'Title',
						description: 'Description'
					}, tokens[0], tokens[1])
				}
			)
		});

		it('should parse reusable field', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.REUSABLE_FIELD_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ReusableFieldDefinitionNode',
						fieldName: tesMatch({
							kind: 'FieldNameNode',
							fieldName: (tokens[1].data as IdentifierTokenData).identifier
						}, tokens[1]),
						type: undefined
					}, tokens[0], tokens[1])
				}
			)
		});

		it('should parse reusable field with type', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.REUSABLE_FIELD_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ReusableFieldDefinitionNode',
						fieldName: tesMatch({
							kind: 'FieldNameNode',
							fieldName: (tokens[1].data as IdentifierTokenData).identifier
						}, tokens[1]),
						type: tesMatch({
							kind: 'ObjectTypeNode',
							fields: [
								tesMatch({
									kind: 'FieldDefinitionNode',
									fieldName: tesMatch({
										kind: 'FieldNameNode',
										fieldName: (tokens[4].data as IdentifierTokenData).identifier
									}, tokens[4]),
									type: undefined
								}, tokens[4])
							]
						}, tokens[3], tokens[5])
					}, tokens[0], tokens[5])
				}
			)
		});

		it('should parse reusable field documentation', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.STRING, string: 'Description' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.REUSABLE_FIELD_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ReusableFieldDefinitionNode',
						fieldName: tesMatch({
							kind: 'FieldNameNode',
							fieldName: (tokens[2].data as IdentifierTokenData).identifier
						}, tokens[2]),
						type: undefined,
						title: undefined,
						description: 'Description'
					}, tokens[0], tokens[2])
				}
			)
		});
	});

	describe('model', () => {
		it('should parse named model', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.NAMED_MODEL_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'NamedModelDefinitionNode',
						modelName: tesMatch({
							kind: 'ModelTypeNode',
							name: (tokens[1].data as IdentifierTokenData).identifier
						}, tokens[1]),
						type: undefined
					}, tokens[0], tokens[1])
				}
			)
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
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.NAMED_MODEL_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'NamedModelDefinitionNode',
						modelName: tesMatch({
							kind: 'ModelTypeNode',
							name: (tokens[1].data as IdentifierTokenData).identifier
						}, tokens[1]),
						type: tesMatch({
							kind: 'EnumTypeNode',
							enumValues: [
								(tokens[5].data as IdentifierTokenData).identifier
							]
						}, tokens[3], tokens[6])
					}, tokens[0], tokens[6])
				}
			)
		});

		it('should parse named model with object type sugar', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'field' }),
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.NAMED_MODEL_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'NamedModelDefinitionNode',
						modelName: tesMatch({
							kind: 'ModelTypeNode',
							name: (tokens[1].data as IdentifierTokenData).identifier
						}, tokens[1]),
						type: tesMatch({
							kind: 'ObjectTypeNode',
							fields: [
								tesMatch({
									kind: 'FieldDefinitionNode',
									fieldName: tesMatch({
										kind: 'FieldNameNode',
										fieldName: (tokens[3].data as IdentifierTokenData).identifier
									}, tokens[3]),
									type: undefined
								}, tokens[3])
							]
						}, tokens[2], tokens[4])
					}, tokens[0], tokens[4])
				}
			)
		});

		it('should parse named model with documentation', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'model' })
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.NAMED_MODEL_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'NamedModelDefinitionNode',
						modelName: tesMatch({
							kind: 'ModelTypeNode',
							name: (tokens[2].data as IdentifierTokenData).identifier
						}, tokens[2]),
						type: undefined,
						title: 'Title',
						description: 'Description'
					}, tokens[0], tokens[2])
				}
			)
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
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.USECASE_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'UseCaseDefinitionNode',
						useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
						safety: undefined,
						input: undefined,
						result: tesMatch({
							kind: 'ModelTypeNode',
							name: (tokens[5].data as IdentifierTokenData).identifier
						}, tokens[5]),
						asyncResult: undefined,
						errors: undefined
					}, tokens[0], tokens[6])
				}
			)
		});

		it('should parse full usecase', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'usecase' }),
				tesTok({ kind: LexerTokenKind.DECORATOR, decorator: 'safe' }),
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),

				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'input' }), // 4
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Boolean' }),
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

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

				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'errors' }), // 20
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: ':' }),
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '[' }),

				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'String' }), // 23
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: '!' }),

				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'Enum' }), // 25
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '{' }),
				tesTok({ kind: LexerTokenKind.LITERAL, literal: true}),
				tesTok({ kind: LexerTokenKind.LITERAL, literal: 1 }),
				tesTok({ kind: LexerTokenKind.LITERAL, literal: 2 }),
				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }),

				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: ']' }),

				tesTok({ kind: LexerTokenKind.SEPARATOR, separator: '}' }), // 32
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.USECASE_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'UseCaseDefinitionNode',
						useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
						safety: (tokens[2].data as DecoratorTokenData).decorator,
						input: tesMatch({
							kind: 'NonNullTypeNode',
							type: tesMatch({
								kind: 'ScalarTypeNode',
								name: 'boolean'
							}, tokens[6])
						}, tokens[6], tokens[7]),
						result: tesMatch({
							kind: 'ModelTypeNode',
							name: (tokens[10].data as IdentifierTokenData).identifier
						}, tokens[10]),
						asyncResult: tesMatch({
							kind: 'NonNullTypeNode',
							type: tesMatch({
								kind: 'ObjectTypeNode',
								fields: [
									tesMatch({
										kind: 'FieldDefinitionNode',
										fieldName: tesMatch({
											kind: 'FieldNameNode',
											fieldName: (tokens[15].data as IdentifierTokenData).identifier
										}, tokens[15]),
										type: tesMatch({
											kind: 'ScalarTypeNode',
											name: 'number'
										}, tokens[17])
									}, tokens[15], tokens[17]),
								]
							}, tokens[14], tokens[18])
						}, tokens[14], tokens[19]),
						errors: [
							tesMatch({
								kind: 'NonNullTypeNode',
								type: tesMatch({
									kind: 'ScalarTypeNode',
									name: 'string'
								}, tokens[23])
							}, tokens[23], tokens[24]),
							tesMatch({
								kind: 'EnumTypeNode',
								enumValues: [
									(tokens[27].data as LiteralTokenData).literal,
									(tokens[28].data as LiteralTokenData).literal,
									(tokens[29].data as LiteralTokenData).literal,
								]
							}, tokens[25], tokens[30])
						],
					}, tokens[0], tokens[32])
				}
			)
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
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.USECASE_DEFINITION

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'UseCaseDefinitionNode',
						useCaseName: (tokens[1].data as IdentifierTokenData).identifier,
						safety: undefined,
						input: undefined,
						result: tesMatch({
							kind: 'ModelTypeNode',
							name: (tokens[6].data as IdentifierTokenData).identifier
						}, tokens[6]),
						asyncResult: undefined,
						errors: undefined,
						title: 'Title',
						description: 'Description'
					}, tokens[0], tokens[7])
				}
			)
		});
	});

	describe('document', () => {
		it('should parse profile id', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
				tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.PROFILE_ID

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ProfileIdNode',
						profileId: (tokens[2].data as StringTokenData).string,
					}, tokens[0], tokens[2])
				}
			)
		});

		it('should parse profile', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
				tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.PROFILE

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ProfileNode',
						profileId: tesMatch({
							kind: 'ProfileIdNode',
							profileId: (tokens[2].data as StringTokenData).string,
						}, tokens[0], tokens[2])
					}, tokens[0], tokens[2])
				}
			)
		});

		it('should parse profile with documentation', () => {
			const tokens: ReadonlyArray<LexerToken> = [
				tesTok({ kind: LexerTokenKind.STRING, string: 'Title\n\nDescription' }),
				tesTok({ kind: LexerTokenKind.IDENTIFIER, identifier: 'profile' }),
				tesTok({ kind: LexerTokenKind.OPERATOR, operator: '=' }),
				tesTok({ kind: LexerTokenKind.STRING, string: 'https://example.com' }),
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.PROFILE

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ProfileNode',
						profileId: tesMatch({
							kind: 'ProfileIdNode',
							profileId: (tokens[3].data as StringTokenData).string,
						}, tokens[1], tokens[3]),
						title: 'Title',
						description: 'Description'
					}, tokens[0], tokens[3])
				}
			)
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
			]
			const buf = new BufferedIterator(
				tokens[Symbol.iterator]()
			)

			const rule = rules.PROFILE_DOCUMENT

			expect(
				rule.tryMatch(buf)
			).toStrictEqual(
				{
					kind: 'match',
					match: tesMatch({
						kind: 'ProfileDocumentNode',
						profile: tesMatch({
							kind: 'ProfileNode',
							profileId: tesMatch({
								kind: 'ProfileIdNode',
								profileId: (tokens[3].data as StringTokenData).string,
							}, tokens[1], tokens[3])
						}, tokens[1], tokens[3]),
						definitions: [
							tesMatch({
								kind: 'NamedModelDefinitionNode',
								modelName: tesMatch({
									kind: 'ModelTypeNode',
									name: (tokens[4].data as IdentifierTokenData).identifier
								}, tokens[5]),
								type: tesMatch({
									kind: 'ObjectTypeNode',
									fields: [
										tesMatch({
											kind: 'FieldDefinitionNode',
											fieldName: tesMatch({
												kind: 'FieldNameNode',
												fieldName: (tokens[7].data as IdentifierTokenData).identifier
											}, tokens[7]),
											type: undefined
										}, tokens[7])
									]
								}, tokens[6], tokens[8])
							}, tokens[4], tokens[8]),

							tesMatch({
								kind: 'UseCaseDefinitionNode',
								useCaseName: (tokens[10].data as IdentifierTokenData).identifier,
								safety: undefined,
								input: undefined,
								result: tesMatch({
									kind: 'ModelTypeNode',
									name: (tokens[14].data as IdentifierTokenData).identifier
								}, tokens[14]),
								asyncResult: undefined,
								errors: undefined
							}, tokens[9], tokens[15])
						]
					}, tokens[1], tokens[15])
				}
			)
		});
	});
});