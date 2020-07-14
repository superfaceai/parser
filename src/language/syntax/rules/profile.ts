import {
	DocumentDefinition,
	DocumentedNode,
	EnumDefinitionNode,
	FieldDefinitionNode,
	ListDefinitionNode,
	ModelReferenceNode,
	NamedFieldDefinitionNode,
	NamedModelDefinitionNode,
	NonNullDefinitionNode,
	ObjectDefinitionNode,
	PrimitiveTypeNode,
	ProfileASTNodeBase,
	ProfileDocumentNode,
	ProfileIdNode,
	ProfileNode,
	Type,
	UnionDefinitionNode,
	UseCaseDefinitionNode} from '@superindustries/language';

import { DecoratorTokenData, IdentifierTokenData, LexerTokenKind, LiteralTokenData,OperatorTokenData, SeparatorTokenData, StringTokenData } from '../../lexer/token';
import { extractDocumentation } from '../util';
import { LexerTokenMatch, SyntaxRule, SyntaxRuleMutable, SyntaxRuleSeparator } from './rule';

// HELPER RULES //

function documentedNode<N extends (DocumentedNode & ProfileASTNodeBase), R extends SyntaxRule<N>>(rule: R): SyntaxRule<N> {
	return SyntaxRule.optional(
		SyntaxRule.string()
	).followedBy(
		rule
	).map(
		(matches): N => {
			const [maybeDoc, result] = (
				matches as [
					LexerTokenMatch<StringTokenData>,
					N
				]
			); // TODO: Won't need `as` cast in Typescript 4
			if (maybeDoc !== undefined) {
				const doc = extractDocumentation(maybeDoc.data.string);
				result.title = doc.title;
				result.description = doc.description
				result.location = maybeDoc.location
				result.span!.start = maybeDoc.span.start
			}

			return result;
		}
	)
}

// MUTABLE RULES //

// These rules need to use mutability to achieve recursion and they make use of the `SyntaxRuleMutable` rule
const TYPE_MUT = new SyntaxRuleMutable<Type>();
const FIELD_DEFINITION_MUT = new SyntaxRuleMutable<FieldDefinitionNode>();

// TYPES //

/** From keywords: `Boolean`, `Number` and `String` */
export const PRIMITIVE_TYPE: SyntaxRule<PrimitiveTypeNode> = SyntaxRule.identifier('Boolean').or(
	SyntaxRule.identifier('Number')
).or(
	SyntaxRule.identifier('String')
).map(
	(keywordMatch): PrimitiveTypeNode => {
		let name: PrimitiveTypeNode['name']
		
		switch (keywordMatch.data.identifier) {
			case 'Number':
				name = 'number'
				break
			case 'String':
				name = 'string'
				break
			case 'Boolean':
				name = 'boolean'
				break
			
			default:
				throw 'Unexpected soft keyword. This is an error in the syntax rule definition';
		}

		return {
			kind: 'PrimitiveType',
			name,
			span: keywordMatch.span,
			location: keywordMatch.location
		}
	}
);

/** Construct of form: `enum { values... }` */
export const ENUM_DEFINITION: SyntaxRule<EnumDefinitionNode> = SyntaxRule.identifier('Enum').followedBy(
	SyntaxRule.separator('{')
).andBy(
	SyntaxRule.repeat(
		SyntaxRule.string().or(
			SyntaxRule.literal()
		).or(
			SyntaxRule.identifier()
		)
	)
).andBy(
	SyntaxRule.separator('}')
).map(
	(matches): EnumDefinitionNode => {
		const [keyword, /* sepStart */, values, sepEnd] = (
			matches as [
				LexerTokenMatch<IdentifierTokenData>,
				LexerTokenMatch<SeparatorTokenData>,
				(LexerTokenMatch<StringTokenData> | LexerTokenMatch<LiteralTokenData> | LexerTokenMatch<IdentifierTokenData>)[],
				LexerTokenMatch<SeparatorTokenData>
			]
		); // TODO: Won't need `as` cast in Typescript 4

		const enumValues: (string | number | boolean)[] = []
		values.forEach(v => {
			switch (v.data.kind) {
				case LexerTokenKind.IDENTIFIER:
					enumValues.push(v.data.identifier)
					break;
				
				case LexerTokenKind.LITERAL:
					enumValues.push(v.data.literal)
					break;
				
				case LexerTokenKind.STRING:
					enumValues.push(v.data.string);
					break;
				
				default:
					throw 'Unexpected token kind. This is an error in the syntax rule definition';
			}
		})

		return {
			kind: 'EnumDefinition',
			values: enumValues,
			location: keyword.location,
			span: { start: keyword.span.start, end: sepEnd.span.end }
		}
	}
)

/** Name of a model type parsed from identifiers. */
export const MODEL_REFERENCE: SyntaxRule<ModelReferenceNode> = SyntaxRule.identifier().map(
	(name): ModelReferenceNode => {
		return {
			kind: 'ModelReference',
			name: name.data.identifier,
			location: name.location,
			span: name.span
		}
	}
)

/** Construct of form: `{ fields... }` */
export const OBJECT_DEFINITION: SyntaxRule<ObjectDefinitionNode> = SyntaxRule.separator('{').followedBy(
	SyntaxRule.optional(
		SyntaxRule.repeat(
			FIELD_DEFINITION_MUT
		)
	)
).andBy(
	SyntaxRule.separator('}')
).map(
	(matches): ObjectDefinitionNode => {
		const [sepStart, fields, sepEnd] = (
			matches as [LexerTokenMatch<SeparatorTokenData>, (FieldDefinitionNode[] | undefined), LexerTokenMatch<SeparatorTokenData>]
		) // TODO: Won't need `as` cast in Typescript 4

		return {
			kind: 'ObjectDefinition',
			fields: fields ?? [],
			location: sepStart.location,
			span: { start: sepStart.span.start, end: sepEnd.span.end }
		}
	}
)

// Helper rule to ensure correct precedence
//
// MODEL_REFERENCE must go after both SCALAR and ENUM
const BASIC_TYPE: SyntaxRule<PrimitiveTypeNode | EnumDefinitionNode | ModelReferenceNode | ObjectDefinitionNode> = PRIMITIVE_TYPE.or(ENUM_DEFINITION).or(MODEL_REFERENCE).or(OBJECT_DEFINITION);

/** Array type: `[type]` */
export const LIST_DEFINITION: SyntaxRule<ListDefinitionNode> = SyntaxRule.separator('[').followedBy(
	TYPE_MUT
).andBy(
	SyntaxRule.separator(']')
).map(
	(matches): ListDefinitionNode => {
		const [sepStart, type, sepEnd] = (
			matches as [
				LexerTokenMatch<SeparatorTokenData>,
				Type,
				LexerTokenMatch<SeparatorTokenData>
			]
		); // TODO: Won't need `as` cast in Typescript 4

		return {
			kind: 'ListDefinition',
			elementType: type,
			location: sepStart.location,
			span: { start: sepStart.span.start, end: sepEnd.span.end }
		}
	}
)

/** Non-null assertion operator: `type!` */
export const NON_NULL_DEFINITION: SyntaxRule<NonNullDefinitionNode> = BASIC_TYPE.or(LIST_DEFINITION).followedBy(
	SyntaxRule.operator('!')
).map(
	(matches): NonNullDefinitionNode => {
		const [type, op] = (matches as [PrimitiveTypeNode | ModelReferenceNode | ObjectDefinitionNode | ListDefinitionNode, LexerTokenMatch<OperatorTokenData>]);

		return {
			kind: 'NonNullDefinition',
			type: type,
			location: type.location,
			span: { start: type.span!.start, end: op.span.end }
		}
	}
)

// NON_NULL_TYPE needs to go first because of postfix operator, model type needs to go after scalar and
const NON_UNION_TYPE: SyntaxRule<Exclude<Type, UnionDefinitionNode>> = NON_NULL_DEFINITION.or(BASIC_TYPE).or(LIST_DEFINITION);
export const UNION_TYPE: SyntaxRule<UnionDefinitionNode> = NON_UNION_TYPE.followedBy(
	SyntaxRule.operator('|')
).andBy(
	NON_UNION_TYPE
).andBy(
	SyntaxRule.optional(
		SyntaxRule.repeat(
			SyntaxRule.operator('|').followedBy(NON_UNION_TYPE)
		)
	)
).map(
	(matches): UnionDefinitionNode => {
		const [firstType, /* firstOp */, secondType, restPairs] = (
			matches as [
				Exclude<Type, UnionDefinitionNode>,
				LexerTokenMatch<OperatorTokenData>,
				Exclude<Type, UnionDefinitionNode>,
				[
					LexerTokenMatch<OperatorTokenData>,
					Exclude<Type, UnionDefinitionNode>
				][] | undefined
			]
		) // TODO: Won't need `as` cast in Typescript 4

		const types = [firstType, secondType]
		restPairs?.forEach(([_op, type]) => types.push(type))

		return {
			kind: 'UnionDefinition',
			types,
			location: firstType.location,
			span: { start: firstType.span!.start, end: types[types.length - 1].span!.end }
		}
	}
)

// UNION_TYPE rule needs to go first because of postfix operator.
export const TYPE: SyntaxRule<Type> = UNION_TYPE.or(NON_UNION_TYPE);
TYPE_MUT.rule = TYPE;

/**
 * Parses either block type assignment `{ ...fields }` or `: type`
 */
const TYPE_ASSIGNMENT: SyntaxRule<Type> = OBJECT_DEFINITION.or(
	SyntaxRule.operator(':').followedBy(TYPE)
).map(
	(match): Type => {
		const matchTyped = match as (ObjectDefinitionNode | [LexerTokenMatch<OperatorTokenData>, Type]) // TODO: Won't need `as` cast in Typescript 4

		if (Array.isArray(matchTyped)) {
			return matchTyped[1]
		} else {
			return matchTyped
		}
	}
)

// FIELDS //

/** Construct of form: `ident: type`, `ident { fields... }` or `ident` */
export const FIELD_DEFINITION: SyntaxRule<FieldDefinitionNode> = documentedNode(
	SyntaxRule.identifier().followedBy(
		SyntaxRule.optional(
			TYPE_ASSIGNMENT
		)
	).map(
		(matches): FieldDefinitionNode => {
			const [fieldName, maybeType] = (
				matches as [
					LexerTokenMatch<IdentifierTokenData>,
					Type | undefined
				]
			); // TODO: Won't need `as` cast in Typescript 4

			return {
				kind: 'FieldDefinition',
				fieldName: fieldName.data.identifier,
				type: maybeType,
				location: fieldName.location,
				span: { start: fieldName.span.start, end: maybeType?.span!.end ?? fieldName.span.end }
			}
		}
	)
)
FIELD_DEFINITION_MUT.rule = FIELD_DEFINITION;

/** * Construct of form: `field ident: type` or `field ident { fields... }` */
export const NAMED_FIELD_DEFINITION: SyntaxRule<NamedFieldDefinitionNode> = documentedNode(
	SyntaxRule.identifier('field').followedBy(
		SyntaxRule.identifier()
	).andBy(
		SyntaxRule.optional(TYPE_ASSIGNMENT)
	).map(
		(matches): NamedFieldDefinitionNode => {
			const [keyword, fieldName, type] = (
				matches as [
					LexerTokenMatch<IdentifierTokenData>,
					LexerTokenMatch<IdentifierTokenData>,
					Type | undefined
				]
			) // TODO: Won't need `as` cast in Typescript 4

			return {
				kind: 'NamedFieldDefinition',
				fieldName: fieldName.data.identifier,
				type,
				location: keyword.location,
				span: { start: keyword.span.start, end: (type ?? fieldName).span!.end }
			}
		}
	)
)

// MODEL //

/** Construct of form: `model ident: type` or `model ident { fields... }` */
export const NAMED_MODEL_DEFINITION: SyntaxRule<NamedModelDefinitionNode> = documentedNode(
	SyntaxRule.identifier('model').followedBy(
		SyntaxRule.identifier()
	).andBy(
		SyntaxRule.optional(TYPE_ASSIGNMENT)
	).map(
		(matches): NamedModelDefinitionNode => {
			const [keyword, modelName, type] = (
				matches as [
					LexerTokenMatch<IdentifierTokenData>,
					LexerTokenMatch<IdentifierTokenData>,
					Type | undefined
				]
			) // TODO: Won't need `as` cast in Typescript 4

			return {
				kind: 'NamedModelDefinition',
				modelName: modelName.data.identifier,
				type,
				location: keyword.location,
				span: { start: keyword.span.start, end: (type ?? modelName).span!.end }
			}
		}
	)
)

// USECASE //

/**
* Construct of form:
```
usecase ident @deco {
  input: type
  result: type
  errors: [
    type
    type
    ...
  ]
}
```
*/
export const USECASE_DEFINITION: SyntaxRule<UseCaseDefinitionNode> = documentedNode(
	SyntaxRule.identifier('usecase').followedBy(
		SyntaxRule.identifier()
	).andBy(
		SyntaxRule.optional(SyntaxRule.decorator())
	).andBy(
		SyntaxRule.separator('{')
	).andBy(
		SyntaxRule.optional(
			SyntaxRule.identifier('input').followedBy(TYPE_ASSIGNMENT)
		)
	).andBy(
		SyntaxRule.identifier('result').followedBy(TYPE_ASSIGNMENT)
	).andBy(
		SyntaxRule.optional(
			SyntaxRule.identifier('async').followedBy(
				SyntaxRule.identifier('result')
			).andBy(
				TYPE_ASSIGNMENT
			)
		)
	).andBy(
		SyntaxRule.optional(
			SyntaxRule.identifier('errors').followedBy(
				SyntaxRule.operator(':')
			).andBy(
				SyntaxRule.separator('[')
			).andBy(
				SyntaxRule.repeat(TYPE)
			).andBy(
				SyntaxRule.separator(']')
			)
		)
	).andBy(
		SyntaxRule.separator('}')
	).map(
		(matches): UseCaseDefinitionNode => {
			const [
				usecaseKey,
				name,
				maybeSafety,
				/* sepStart */,
				maybeInput,
				[/* _resultKey */, resultType],
				maybeAsyncResult,
				maybeErrors,
				sepEnd
			] = (
				matches as [
					LexerTokenMatch<IdentifierTokenData>,
					LexerTokenMatch<IdentifierTokenData>,
					LexerTokenMatch<DecoratorTokenData> | undefined,
					LexerTokenMatch<SeparatorTokenData>,
					[LexerTokenMatch<IdentifierTokenData>, Type] | undefined,
					[LexerTokenMatch<IdentifierTokenData>, Type],
					[LexerTokenMatch<IdentifierTokenData>, LexerTokenMatch<IdentifierTokenData>, Type] | undefined,
					[LexerTokenMatch<IdentifierTokenData>, LexerTokenMatch<OperatorTokenData>, LexerTokenMatch<SeparatorTokenData>, Type[], LexerTokenMatch<SeparatorTokenData>] | undefined,
					LexerTokenMatch<SeparatorTokenData>
				]
			) // TODO: Won't need `as` cast in Typescript 4

			const input: Type | undefined = maybeInput?.[1]
			const asyncResult: Type | undefined = maybeAsyncResult?.[2]
			const errors: Type[] | undefined = maybeErrors?.[3]

			return {
				kind: 'UseCaseDefinition',
				useCaseName: name.data.identifier,
				safety: maybeSafety?.data.decorator,
				input,
				result: resultType,
				asyncResult,
				errors,
				location: usecaseKey.location,
				span: { start: usecaseKey.span.start, end: sepEnd.span.end }
			}
		}
	)
)

// DOCUMENT //

/** `profile: string` */
export const PROFILE_ID: SyntaxRule<ProfileIdNode> = SyntaxRule.identifier('profile').followedBy(
	SyntaxRuleSeparator.operator('=')
).andBy(
	SyntaxRule.string()
).map(
	(matches): ProfileIdNode => {
		const [keyword, /* op */, profileId] = (
			matches as [
				LexerTokenMatch<IdentifierTokenData>,
				LexerTokenMatch<OperatorTokenData>,
				LexerTokenMatch<StringTokenData>
			]
		) // TODO: Won't need `as` cast in Typescript 4

		return {
			kind: 'ProfileId',
			profileId: profileId.data.string,
			location: keyword.location,
			span: { start: keyword.span.start, end: profileId.span.end }
		}
	}
)

export const PROFILE: SyntaxRule<ProfileNode> = documentedNode(
	SyntaxRule.optional(SyntaxRule.string()).followedBy(PROFILE_ID).map(
		(matches): ProfileNode => {
			const [maybeDoc, profileId] = (
				matches as [
					LexerTokenMatch<StringTokenData> | undefined,
					ProfileIdNode
				]
			) // TODO: Won't need `as` cast in Typescript 4

			return {
				kind: 'Profile',
				profileId,
				location: maybeDoc?.location ?? profileId.location,
				span: { start: maybeDoc?.span.start ?? profileId.span!.start, end: profileId.span!.end }
			}
		}
	)
)

export const DOCUMENT_DEFINITION: SyntaxRule<DocumentDefinition> = USECASE_DEFINITION.or(NAMED_FIELD_DEFINITION).or(NAMED_MODEL_DEFINITION);
export const PROFILE_DOCUMENT: SyntaxRule<ProfileDocumentNode> = SyntaxRule.separator('SOF').followedBy(PROFILE).andBy(
	SyntaxRule.optional(
		SyntaxRule.repeat(
			DOCUMENT_DEFINITION
		)
	)
).map(
	(matches): ProfileDocumentNode => {
		const [/* SOF */, profile, definitions] = (
			matches as [
				LexerTokenMatch<SeparatorTokenData>,
				ProfileNode,
				DocumentDefinition[] | undefined
			]
		) // TODO: Won't need `as` cast in Typescript 4

		let spanEnd = profile.span!.end
		if (definitions !== undefined) {
			spanEnd = definitions[definitions.length - 1].span!.end
		}

		return {
			kind: 'ProfileDocument',
			profile,
			definitions: definitions ?? [],
			location: profile.location,
			span: { start: profile.span!.start, end: spanEnd }
		}
	}
)