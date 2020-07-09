import { SyntaxRule, SyntaxRuleMutable, LexerTokenMatch, SyntaxRuleSeparator } from './rule';

import {
	ScalarTypeNode,
	ModelTypeNode,
	ObjectTypeNode,
	EnumTypeNode,
	ListTypeNode,
	NonNullTypeNode,
	UnionTypeNode,
	Type,
	FieldDefinitionNode,
	FieldNameNode,
	ReusableFieldDefinitionNode,
	NamedModelDefinitionNode,
	ProfileUseCaseDefinitionNode,
	ProfileProfileIdNode,
	ProfileNode,
	ProfileDocumentNode,
	DocumentDefinition
} from '@superindustries/language';
import { LexerTokenKind, SeparatorTokenData, OperatorTokenData, IdentifierTokenData, DecoratorTokenData, StringTokenData, LiteralTokenData } from '../../lexer/token';
import { extractDocumentation } from '../util';

// MUTABLE RULES //

// These rules need to use mutability to achieve recursion and they make use of the `SyntaxRuleMutable` rule
const TYPE_MUT = new SyntaxRuleMutable<Type>();
const FIELD_DEFINITION_MUT = new SyntaxRuleMutable<FieldDefinitionNode>();

// TYPES //

/** From keywords: `Boolean`, `Number` and `String` */
export const SCALAR_TYPE: SyntaxRule<ScalarTypeNode> = SyntaxRule.identifier('Boolean').or(
	SyntaxRule.identifier('Number')
).or(
	SyntaxRule.identifier('String')
).map(
	(keywordMatch): ScalarTypeNode => {
		let name: ScalarTypeNode['name']
		
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
			kind: 'ScalarTypeNode',
			name,
			span: keywordMatch.span,
			location: keywordMatch.location
		}
	}
);

/** Construct of form: `enum { values... }` */
export const ENUM_TYPE: SyntaxRule<EnumTypeNode> = SyntaxRule.identifier('Enum').followedBy(
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
	(matches): EnumTypeNode => {
		const [keyword, /* sepStart */, values, sepEnd] = (
			matches as [
				LexerTokenMatch<IdentifierTokenData>,
				LexerTokenMatch<SeparatorTokenData>,
				(LexerTokenMatch<StringTokenData> | LexerTokenMatch<LiteralTokenData> | LexerTokenMatch<IdentifierTokenData>)[],
				LexerTokenMatch<SeparatorTokenData>
			]
		); // TODO: Won't need `as` cast in Typescript 4

		let enumValues: (string | number | boolean)[] = []
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
			kind: 'EnumTypeNode',
			enumValues,
			location: keyword.location,
			span: { start: keyword.span.start, end: sepEnd.span.end }
		}
	}
)

/** Name of a model type parsed from identifiers. */
export const MODEL_TYPE: SyntaxRule<ModelTypeNode> = SyntaxRule.identifier().map(
	(name): ModelTypeNode => {
		return {
			kind: 'ModelTypeNode',
			name: name.data.identifier,
			location: name.location,
			span: name.span
		}
	}
)

/** Construct of form: `{ fields... }` */
export const OBJECT_TYPE: SyntaxRule<ObjectTypeNode> = SyntaxRule.separator('{').followedBy(
	SyntaxRule.optional(
		SyntaxRule.repeat(
			FIELD_DEFINITION_MUT
		)
	)
).andBy(
	SyntaxRule.separator('}')
).map(
	(matches): ObjectTypeNode => {
		const [sepStart, fields, sepEnd] = (
			matches as [LexerTokenMatch<SeparatorTokenData>, (FieldDefinitionNode[] | undefined), LexerTokenMatch<SeparatorTokenData>]
		) // TODO: Won't need `as` cast in Typescript 4

		return {
			kind: 'ObjectTypeNode',
			fields: fields ?? [],
			location: sepStart.location,
			span: { start: sepStart.span.start, end: sepEnd.span.end }
		}
	}
)

// Helper rule to ensure correct precedence
//
// MODEL_TYPE must go after both SCALAR and ENUM
const BASIC_TYPE: SyntaxRule<ScalarTypeNode | EnumTypeNode | ModelTypeNode | ObjectTypeNode> = SCALAR_TYPE.or(ENUM_TYPE).or(MODEL_TYPE).or(OBJECT_TYPE);

/** Array type: `[type]` */
export const LIST_TYPE: SyntaxRule<ListTypeNode> = SyntaxRule.separator('[').followedBy(
	TYPE_MUT
).andBy(
	SyntaxRule.separator(']')
).map(
	(matches): ListTypeNode => {
		const [sepStart, type, sepEnd] = (
			matches as [
				LexerTokenMatch<SeparatorTokenData>,
				Type,
				LexerTokenMatch<SeparatorTokenData>
			]
		); // TODO: Won't need `as` cast in Typescript 4

		return {
			kind: 'ListTypeNode',
			type: type,
			location: sepStart.location,
			span: { start: sepStart.span.start, end: sepEnd.span.end }
		}
	}
)

/** Non-null assertion operator: `type!` */
export const NON_NULL_TYPE: SyntaxRule<NonNullTypeNode> = BASIC_TYPE.or(LIST_TYPE).followedBy(
	SyntaxRule.operator('!')
).map(
	(matches): NonNullTypeNode => {
		const [type, op] = (matches as [ScalarTypeNode | ModelTypeNode | ObjectTypeNode | ListTypeNode, LexerTokenMatch<OperatorTokenData>]);

		return {
			kind: 'NonNullTypeNode',
			type: type,
			location: type.location,
			span: { start: type.span!.start, end: op.span.end }
		}
	}
)

// NON_NULL_TYPE needs to go first because of postfix operator, model type needs to go after scalar and
const NON_UNION_TYPE: SyntaxRule<Exclude<Type, UnionTypeNode>> = NON_NULL_TYPE.or(BASIC_TYPE).or(LIST_TYPE);
export const UNION_TYPE: SyntaxRule<UnionTypeNode> = NON_UNION_TYPE.followedBy(
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
	(matches): UnionTypeNode => {
		const [firstType, /* firstOp */, secondType, restPairs] = (
			matches as [
				Exclude<Type, UnionTypeNode>,
				LexerTokenMatch<OperatorTokenData>,
				Exclude<Type, UnionTypeNode>,
				[
					LexerTokenMatch<OperatorTokenData>,
					Exclude<Type, UnionTypeNode>
				][] | undefined
			]
		) // TODO: Won't need `as` cast in Typescript 4

		let types = [firstType, secondType]
		restPairs?.forEach(([_op, type]) => types.push(type))

		return {
			kind: 'UnionTypeNode',
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
const TYPE_ASSIGNMENT: SyntaxRule<Type> = OBJECT_TYPE.or(
	SyntaxRule.operator(':').followedBy(TYPE)
).map(
	(match): Type => {
		const matchTyped = match as (ObjectTypeNode | [LexerTokenMatch<OperatorTokenData>, Type]) // TODO: Won't need `as` cast in Typescript 4

		if (Array.isArray(matchTyped)) {
			return matchTyped[1]
		} else {
			return matchTyped
		}
	}
)

// FIELDS //

/** Name of a field inside `FieldDefinitionNode`. */
export const FIELD_NAME: SyntaxRule<FieldNameNode> = SyntaxRule.identifier().map(
	(match): FieldNameNode => {
		return {
			kind: 'FieldNameNode',
			fieldName: match.data.identifier,
			location: match.location,
			span: match.span
		}
	}
)
/** Construct of form: `ident: type`, `ident { fields... }` or `ident` */
export const FIELD_DEFINITION: SyntaxRule<FieldDefinitionNode> = FIELD_NAME.followedBy(
	SyntaxRule.optional(
		TYPE_ASSIGNMENT
	)
).map(
	(matches): FieldDefinitionNode => {
		const [fieldName, maybeType] = (
			matches as [
				FieldNameNode,
				Type | undefined
			]
		); // TODO: Won't need `as` cast in Typescript 4

		return {
			kind: 'FieldDefinitionNode',
			fieldName,
			type: maybeType,
			location: fieldName.location,
			span: { start: fieldName.span!.start, end: maybeType?.span!.end ?? fieldName.span!.end }
		}
	}
)
FIELD_DEFINITION_MUT.rule = FIELD_DEFINITION;

/** * Construct of form: `field ident: type` or `field ident { fields... }` */
export const REUSABLE_FIELD_DEFINITION: SyntaxRule<ReusableFieldDefinitionNode> = SyntaxRule.identifier('field').followedBy(
	FIELD_NAME
).andBy(TYPE_ASSIGNMENT).map(
	(matches): ReusableFieldDefinitionNode => {
		const [keyword, fieldName, type] = (
			matches as [
				LexerTokenMatch<IdentifierTokenData>,
				FieldNameNode,
				Type
			]
		) // TODO: Won't need `as` cast in Typescript 4

		return {
			kind: 'ReusableFieldDefinitionNode',
			fieldName,
			type,
			location: keyword.location,
			span: { start: keyword.span.start, end: type.span!.end }
		}
	}
)

// MODEL //

/** Construct of form: `model ident: type` or `model ident { fields... }` */
export const NAMED_MODEL_DEFINITION: SyntaxRule<NamedModelDefinitionNode> = SyntaxRule.identifier('model').followedBy(
	MODEL_TYPE
).andBy(
	TYPE_ASSIGNMENT
).map(
	(matches): NamedModelDefinitionNode => {
		const [keyword, modelName, type] = (
			matches as [
				LexerTokenMatch<IdentifierTokenData>,
				ModelTypeNode,
				Type
			]
		) // TODO: Won't need `as` cast in Typescript 4

		return {
			kind: 'NamedModelDefinitionNode',
			modelName,
			type,
			location: keyword.location,
			span: { start: keyword.span.start, end: type.span!.end }
		}
	}
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
export const USECASE_DEFINITION: SyntaxRule<ProfileUseCaseDefinitionNode> = SyntaxRule.identifier('usecase').followedBy(
	SyntaxRule.identifier()
).andBy(
	SyntaxRule.decorator()
).andBy(
	SyntaxRule.separator('{')
).andBy(
	SyntaxRule.optional(
		SyntaxRule.identifier('input').followedBy(TYPE_ASSIGNMENT)
	)
).andBy(
	SyntaxRule.identifier('result').followedBy(TYPE_ASSIGNMENT)
).andBy(
	SyntaxRule.identifier('async').followedBy(
		SyntaxRule.identifier('result')
	).andBy(
		TYPE_ASSIGNMENT
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
	(matches): ProfileUseCaseDefinitionNode => {
		const [
			usecaseKey,
			name,
			safety,
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
				LexerTokenMatch<DecoratorTokenData>,
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
			kind: 'UseCaseDefinitionNode',
			useCaseName: name.data.identifier,
			safety: safety.data.decorator,
			input,
			result: resultType,
			asyncResult,
			errors,
			location: usecaseKey.location,
			span: { start: usecaseKey.span.start, end: sepEnd.span.end }
		}
	}
)

// DOCUMENT //

/** `profile: string` */
export const PROFILE_ID: SyntaxRule<ProfileProfileIdNode> = SyntaxRule.identifier('profile').followedBy(
	SyntaxRuleSeparator.operator(':')
).andBy(
	SyntaxRule.string()
).map(
	(matches): ProfileProfileIdNode => {
		const [keyword, /* op */, profileId] = (
			matches as [
				LexerTokenMatch<IdentifierTokenData>,
				LexerTokenMatch<OperatorTokenData>,
				LexerTokenMatch<StringTokenData>
			]
		) // TODO: Won't need `as` cast in Typescript 4

		return {
			kind: 'ProfileIdNode',
			profileId: profileId.data.string,
			location: keyword.location,
			span: { start: keyword.span.start, end: profileId.span.end }
		}
	}
)

export const PROFILE: SyntaxRule<ProfileNode> = SyntaxRule.optional(SyntaxRule.string()).followedBy(PROFILE_ID).map(
	(matches): ProfileNode => {
		const [maybeDoc, profileId] = (
			matches as [
				LexerTokenMatch<StringTokenData> | undefined,
				ProfileProfileIdNode
			]
		) // TODO: Won't need `as` cast in Typescript 4

		return {
			kind: 'ProfileNode',
			profileId,
			location: maybeDoc?.location ?? profileId.location,
			span: { start: maybeDoc?.span.start ?? profileId.span!.start, end: profileId.span!.end },
			...extractDocumentation(maybeDoc?.data.string)
		}
	}
)

export const DOCUMENT_DEFINITION: SyntaxRule<DocumentDefinition> = USECASE_DEFINITION.or(REUSABLE_FIELD_DEFINITION).or(NAMED_MODEL_DEFINITION);
export const PROFILE_DOCUMENT: SyntaxRule<ProfileDocumentNode> = PROFILE.followedBy(
	SyntaxRule.optional(
		SyntaxRule.repeat(
			DOCUMENT_DEFINITION
		)
	)
).map(
	(matches): ProfileDocumentNode => {
		const [profile, definitions] = (
			matches as [
				ProfileNode,
				DocumentDefinition[] | undefined
			]
		) // TODO: Won't need `as` cast in Typescript 4

		return {
			kind: 'ProfileDocumentNode',
			profile,
			definitions: definitions ?? []
		}
	}
)