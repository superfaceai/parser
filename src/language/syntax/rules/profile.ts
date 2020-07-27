import {
  DocumentDefinition,
  DocumentedNode,
  EnumDefinitionNode,
  EnumValueNode,
  FieldDefinitionNode,
  ListDefinitionNode,
  ModelTypeNameNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  NonNullDefinitionNode,
  ObjectDefinitionNode,
  PrimitiveTypeNameNode,
  ProfileASTNodeBase,
  ProfileDocumentNode,
  ProfileIdNode,
  ProfileNode,
  Type,
  UnionDefinitionNode,
  UseCaseDefinitionNode,
} from '@superindustries/language';

import {
  IdentifierTokenData,
  LexerTokenKind,
  OperatorTokenData,
  SeparatorTokenData,
  StringTokenData,
  LiteralTokenData,
} from '../../lexer/token';
import { extractDocumentation } from '../util';
import {
  LexerTokenMatch,
  SyntaxRule,
  SyntaxRuleMutable,
  SyntaxRuleSeparator,
} from './rule';

// HELPER RULES //

// Node that has `span` and `location` non-optional.
type SrcNode<N extends ProfileASTNodeBase> = N & {
  span: NonNullable<N['span']>;
  location: NonNullable<N['location']>;
};
type SyntaxRuleSrc<N extends ProfileASTNodeBase> = SyntaxRule<SrcNode<N>>;

function documentedNode<
  N extends SrcNode<DocumentedNode & ProfileASTNodeBase>,
  R extends SyntaxRule<N>
>(rule: R): SyntaxRule<N> {
  return SyntaxRule.optional(SyntaxRule.string())
    .followedBy(rule)
    .map(
      (matches): N => {
        const [maybeDoc, result] = matches as [
          LexerTokenMatch<StringTokenData>,
          N
        ]; // TODO: Won't need `as` cast in Typescript 4
        if (maybeDoc !== undefined) {
          const doc = extractDocumentation(maybeDoc.data.string);
          result.title = doc.title;
          result.description = doc.description;
          result.location = maybeDoc.location;
          result.span.start = maybeDoc.span.start;
        }

        return result;
      }
    );
}

// MUTABLE RULES //

// These rules need to use mutability to achieve recursion and they make use of the `SyntaxRuleMutable` rule
const TYPE_MUT = new SyntaxRuleMutable<SrcNode<Type>>();
const FIELD_DEFINITION_MUT = new SyntaxRuleMutable<
  SrcNode<FieldDefinitionNode>
>();

// TYPES //

/** From keywords: `Boolean`, `Number` and `String` */
export const PRIMITIVE_TYPE_NAME: SyntaxRuleSrc<PrimitiveTypeNameNode> = SyntaxRule.identifier(
  'boolean'
)
  .or(SyntaxRule.identifier('number'))
  .or(SyntaxRule.identifier('string'))
  .map((keywordMatch): SrcNode<PrimitiveTypeNameNode> => {
    let name: PrimitiveTypeNameNode['name'];

    switch (keywordMatch.data.identifier) {
      case 'number':
        name = 'number';
        break;
      case 'string':
        name = 'string';
        break;
      case 'boolean':
        name = 'boolean';
        break;

      default:
        throw 'Unexpected soft keyword. This is an error in the syntax rule definition';
    }

      return {
        kind: 'PrimitiveTypeName',
        name,
        span: keywordMatch.span,
        location: keywordMatch.location,
      };
    }
  );

export const ENUM_VALUE: SyntaxRuleSrc<EnumValueNode> = documentedNode(SyntaxRule.identifier()
  .followedBy(
    SyntaxRule.optional(
      SyntaxRule.operator('=').followedBy(SyntaxRule.literal().or(SyntaxRule.string()))
    )
  )
  .map(
    (matches): SrcNode<EnumValueNode> => {
      const [
        name,
        maybeAssignment
      ] = (matches as [
        LexerTokenMatch<IdentifierTokenData>,
        [LexerTokenMatch<OperatorTokenData>, LexerTokenMatch<LiteralTokenData> | LexerTokenMatch<StringTokenData>] | undefined
      ]);

      let enumValue: string | number | boolean;
      if (maybeAssignment === undefined) {
        enumValue = name.data.identifier;
      } else {
        const match = maybeAssignment[1];

        switch (match.data.kind) {
          case LexerTokenKind.LITERAL:
            enumValue = match.data.literal;
            break;
          
          case LexerTokenKind.STRING:
            enumValue = match.data.string;
            break;

          default:
            throw 'Unexpected token kind. This is an error in the syntax rule definition';
        }
      }

      return {
        kind: 'EnumValue',
        value: enumValue,
        location: name.location,
        span: { start: name.span.start, end: maybeAssignment?.[1].span.end ?? name.span.end }
      };
    }
  )
);
/** Construct of form: `enum { values... }` */
export const ENUM_DEFINITION: SyntaxRuleSrc<EnumDefinitionNode> = SyntaxRule.identifier(
  'enum'
)
  .followedBy(SyntaxRule.separator('{'))
  .andBy(SyntaxRule.repeat(ENUM_VALUE))
  .andBy(SyntaxRule.separator('}'))
  .map(
    (matches): SrcNode<EnumDefinitionNode> => {
      const [keyword /* sepStart */, , values, sepEnd] = matches as [
        LexerTokenMatch<IdentifierTokenData>,
        LexerTokenMatch<SeparatorTokenData>,
        SrcNode<EnumValueNode>[],
        LexerTokenMatch<SeparatorTokenData>
      ]; // TODO: Won't need `as` cast in Typescript 4

      return {
        kind: 'EnumDefinition',
        values,
        location: keyword.location,
        span: { start: keyword.span.start, end: sepEnd.span.end },
      };
    }
  );

/** Name of a model type parsed from identifiers. */
export const MODEL_TYPE_NAME: SyntaxRuleSrc<ModelTypeNameNode> = SyntaxRule.identifier().map(
  (name): SrcNode<ModelTypeNameNode> => {
    return {
      kind: 'ModelTypeName',
      name: name.data.identifier,
      location: name.location,
      span: name.span,
    };
  }
);

/** Construct of form: `{ fields... }` */
export const OBJECT_DEFINITION: SyntaxRuleSrc<ObjectDefinitionNode> = SyntaxRule.separator(
  '{'
)
  .followedBy(SyntaxRule.optional(SyntaxRule.repeat(FIELD_DEFINITION_MUT)))
  .andBy(SyntaxRule.separator('}'))
  .map(
    (matches): SrcNode<ObjectDefinitionNode> => {
      const [sepStart, fields, sepEnd] = matches as [
        LexerTokenMatch<SeparatorTokenData>,
        SrcNode<FieldDefinitionNode>[] | undefined,
        LexerTokenMatch<SeparatorTokenData>
      ]; // TODO: Won't need `as` cast in Typescript 4

      return {
        kind: 'ObjectDefinition',
        fields: fields ?? [],
        location: sepStart.location,
        span: { start: sepStart.span.start, end: sepEnd.span.end },
      };
    }
  );

// Helper rule to ensure correct precedence
//
// MODEL must go after both PRIMITIVE and ENUM
const BASIC_TYPE: SyntaxRule<
  | SrcNode<PrimitiveTypeNameNode>
  | SrcNode<EnumDefinitionNode>
  | SrcNode<ModelTypeNameNode>
  | SrcNode<ObjectDefinitionNode>
> = PRIMITIVE_TYPE_NAME.or(ENUM_DEFINITION)
  .or(MODEL_TYPE_NAME)
  .or(OBJECT_DEFINITION);

/** Array type: `[type]` */
export const LIST_DEFINITION: SyntaxRuleSrc<ListDefinitionNode> = SyntaxRule.separator(
  '['
)
  .followedBy(TYPE_MUT)
  .andBy(SyntaxRule.separator(']'))
  .map(
    (matches): SrcNode<ListDefinitionNode> => {
      const [sepStart, type, sepEnd] = matches as [
        LexerTokenMatch<SeparatorTokenData>,
        SrcNode<Type>,
        LexerTokenMatch<SeparatorTokenData>
      ]; // TODO: Won't need `as` cast in Typescript 4

      return {
        kind: 'ListDefinition',
        elementType: type,
        location: sepStart.location,
        span: { start: sepStart.span.start, end: sepEnd.span.end },
      };
    }
  );

/** Non-null assertion operator: `type!` */
export const NON_NULL_DEFINITION: SyntaxRuleSrc<NonNullDefinitionNode> = BASIC_TYPE.or(
  LIST_DEFINITION
)
  .followedBy(SyntaxRule.operator('!'))
  .map(
    (matches): SrcNode<NonNullDefinitionNode> => {
      const [type, op] = matches as [
        (
          | SrcNode<PrimitiveTypeNameNode>
          | SrcNode<ModelTypeNameNode>
          | SrcNode<ObjectDefinitionNode>
          | SrcNode<ListDefinitionNode>
        ),
        LexerTokenMatch<OperatorTokenData>
      ];

      return {
        kind: 'NonNullDefinition',
        type: type,
        location: type.location,
        span: { start: type.span.start, end: op.span.end },
      };
    }
  );

// NON_NULL_TYPE needs to go first because of postfix operator, model type needs to go after scalar and
const NON_UNION_TYPE: SyntaxRule<SrcNode<
  Exclude<Type, UnionDefinitionNode>
>> = NON_NULL_DEFINITION.or(BASIC_TYPE).or(LIST_DEFINITION);
export const UNION_DEFINITION: SyntaxRuleSrc<UnionDefinitionNode> = NON_UNION_TYPE.followedBy(
  SyntaxRule.operator('|')
)
  .andBy(NON_UNION_TYPE)
  .andBy(
    SyntaxRule.optional(
      SyntaxRule.repeat(SyntaxRule.operator('|').followedBy(NON_UNION_TYPE))
    )
  )
  .map(
    (matches): SrcNode<UnionDefinitionNode> => {
      const [firstType /* firstOp */, , secondType, restPairs] = matches as [
        SrcNode<Exclude<Type, UnionDefinitionNode>>,
        LexerTokenMatch<OperatorTokenData>,
        SrcNode<Exclude<Type, UnionDefinitionNode>>,
        (
          | [
              LexerTokenMatch<OperatorTokenData>,
              SrcNode<Exclude<Type, UnionDefinitionNode>>
            ][]
          | undefined
        )
      ]; // TODO: Won't need `as` cast in Typescript 4

      const types = [firstType, secondType];
      restPairs?.forEach(([_op, type]) => types.push(type));

      return {
        kind: 'UnionDefinition',
        types,
        location: firstType.location,
        span: {
          start: firstType.span.start,
          end: types[types.length - 1].span.end,
        },
      };
    }
  );

// UNION_DEFINITION rule needs to go first because of postfix operator.
export const TYPE: SyntaxRuleSrc<Type> = UNION_DEFINITION.or(NON_UNION_TYPE);
TYPE_MUT.rule = TYPE;

// FIELDS //

/** Construct of form: `ident: type`, `ident { fields... }` or `ident` */
export const FIELD_DEFINITION: SyntaxRuleSrc<FieldDefinitionNode> = documentedNode(
  SyntaxRule.identifier()
    .followedBy(SyntaxRule.optional(TYPE))
    .map(
      (matches): SrcNode<FieldDefinitionNode> => {
        const [fieldName, maybeType] = matches as [
          LexerTokenMatch<IdentifierTokenData>,
          SrcNode<Type> | undefined
        ]; // TODO: Won't need `as` cast in Typescript 4

        return {
          kind: 'FieldDefinition',
          fieldName: fieldName.data.identifier,
          type: maybeType,
          location: fieldName.location,
          span: {
            start: fieldName.span.start,
            end: maybeType?.span.end ?? fieldName.span.end,
          },
        };
      }
    )
);
FIELD_DEFINITION_MUT.rule = FIELD_DEFINITION;

/** * Construct of form: `field ident: type` or `field ident { fields... }` */
export const NAMED_FIELD_DEFINITION: SyntaxRuleSrc<NamedFieldDefinitionNode> = documentedNode(
  SyntaxRule.identifier('field')
    .followedBy(SyntaxRule.identifier())
    .andBy(SyntaxRule.optional(TYPE))
    .map((matches): SrcNode<NamedFieldDefinitionNode> => {
      const [keyword, fieldName, type] = matches as [
        LexerTokenMatch<IdentifierTokenData>,
        LexerTokenMatch<IdentifierTokenData>,
        SrcNode<Type> | undefined
      ]; // TODO: Won't need `as` cast in Typescript 4

        return {
          kind: 'NamedFieldDefinition',
          fieldName: fieldName.data.identifier,
          type,
          location: keyword.location,
          span: {
            start: keyword.span.start,
            end: (type ?? fieldName).span.end,
          },
        };
      }
    )
);

// MODEL //

/** Construct of form: `model ident: type` or `model ident { fields... }` */
export const NAMED_MODEL_DEFINITION: SyntaxRuleSrc<NamedModelDefinitionNode> = documentedNode(
  SyntaxRule.identifier('model')
    .followedBy(SyntaxRule.identifier())
    .andBy(SyntaxRule.optional(TYPE))
    .map((matches): SrcNode<NamedModelDefinitionNode> => {
      const [keyword, modelName, type] = matches as [
        LexerTokenMatch<IdentifierTokenData>,
        LexerTokenMatch<IdentifierTokenData>,
        SrcNode<Type> | undefined
      ]; // TODO: Won't need `as` cast in Typescript 4

        return {
          kind: 'NamedModelDefinition',
          modelName: modelName.data.identifier,
          type,
          location: keyword.location,
          span: {
            start: keyword.span.start,
            end: (type ?? modelName).span.end,
          },
        };
      }
    )
);

// USECASE //

const USECASE_SAFETY: SyntaxRule<LexerTokenMatch<IdentifierTokenData>> = SyntaxRule.identifier('safe').or(SyntaxRule.identifier('unsafe')).or(SyntaxRule.identifier('idempotent'));

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
export const USECASE_DEFINITION: SyntaxRuleSrc<UseCaseDefinitionNode> = documentedNode(
  SyntaxRule.identifier('usecase')
    .followedBy(SyntaxRule.identifier(undefined))
    .andBy(SyntaxRule.optional(USECASE_SAFETY))
    .andBy(SyntaxRule.separator('{'))
    .andBy(
      SyntaxRule.optional(
        SyntaxRule.identifier('input')
          .followedBy(SyntaxRule.optional(SyntaxRule.operator(':')))
          .andBy(OBJECT_DEFINITION)
      )
    )
    .andBy(
      SyntaxRule.identifier('result').followedBy(TYPE)
    )
    .andBy(
      SyntaxRule.optional(
        SyntaxRule.identifier('async')
          .followedBy(SyntaxRule.identifier('result'))
          .andBy(TYPE)
      )
    )
    .andBy(
      SyntaxRule.optional(
        SyntaxRule.identifier('error').followedBy(
          TYPE
        )
      )
    )
    .andBy(SyntaxRule.separator('}'))
    .map((matches): SrcNode<UseCaseDefinitionNode> => {
      const [
        usecaseKey,
        name,
        maybeSafety,
        ,
        /* sepStart */ maybeInput,
        [, /* _resultKey */ resultType],
        maybeAsyncResult,
        maybeError,
        sepEnd,
      ] = matches as [
        LexerTokenMatch<IdentifierTokenData>,
        LexerTokenMatch<IdentifierTokenData>,
        LexerTokenMatch<IdentifierTokenData> | undefined,
        LexerTokenMatch<SeparatorTokenData>,
        (
          | [
              LexerTokenMatch<IdentifierTokenData>,
              LexerTokenMatch<OperatorTokenData> | undefined,
              SrcNode<ObjectDefinitionNode>
            ]
          | undefined
        ), // input
        [LexerTokenMatch<IdentifierTokenData>, SrcNode<Type>], // result
        (
          | [
              LexerTokenMatch<IdentifierTokenData>,
              LexerTokenMatch<IdentifierTokenData>,
              SrcNode<Type>
            ]
          | undefined
        ), // async result
        [LexerTokenMatch<IdentifierTokenData>, SrcNode<Type>] | undefined, // error
        LexerTokenMatch<SeparatorTokenData>
      ]; // TODO: Won't need `as` cast in Typescript 4

        const input: SrcNode<ObjectDefinitionNode> | undefined =
          maybeInput?.[2];
        const asyncResult: SrcNode<Type> | undefined = maybeAsyncResult?.[2];
        const error: SrcNode<Type> | undefined = maybeError?.[1];

      let safety: UseCaseDefinitionNode['safety'] = undefined
      switch (maybeSafety?.data.identifier) {
        case undefined:
          break;

        case 'safe':
          safety = 'safe';
          break;

        case 'unsafe':
          safety = 'unsafe';
          break;
        
        case 'idempotent':
          safety = 'idempotent';
          break;

        default:
          throw 'Unexpected soft keyword. This is an error in the syntax rule definition';
      }

      return {
        kind: 'UseCaseDefinition',
        useCaseName: name.data.identifier,
        safety,
        input,
        result: resultType,
        asyncResult,
        error,
        location: usecaseKey.location,
        span: { start: usecaseKey.span.start, end: sepEnd.span.end },
      };
    })
);

// DOCUMENT //

/** `profile: string` */
export const PROFILE_ID: SyntaxRuleSrc<ProfileIdNode> = SyntaxRule.identifier(
  'profile'
)
  .followedBy(SyntaxRuleSeparator.operator('='))
  .andBy(SyntaxRule.string())
  .map(
    (matches): SrcNode<ProfileIdNode> => {
      const [keyword /* op */, , profileId] = matches as [
        LexerTokenMatch<IdentifierTokenData>,
        LexerTokenMatch<OperatorTokenData>,
        LexerTokenMatch<StringTokenData>
      ]; // TODO: Won't need `as` cast in Typescript 4

      return {
        kind: 'ProfileId',
        profileId: profileId.data.string,
        location: keyword.location,
        span: { start: keyword.span.start, end: profileId.span.end },
      };
    }
  );

export const PROFILE: SyntaxRuleSrc<ProfileNode> = documentedNode(
  SyntaxRule.optional(SyntaxRule.string())
    .followedBy(PROFILE_ID)
    .map(
      (matches): SrcNode<ProfileNode> => {
        const [maybeDoc, profileId] = matches as [
          LexerTokenMatch<StringTokenData> | undefined,
          SrcNode<ProfileIdNode>
        ]; // TODO: Won't need `as` cast in Typescript 4

        return {
          kind: 'Profile',
          profileId,
          location: maybeDoc?.location ?? profileId.location,
          span: {
            start: maybeDoc?.span.start ?? profileId.span.start,
            end: profileId.span.end,
          },
        };
      }
    )
);

export const DOCUMENT_DEFINITION: SyntaxRuleSrc<DocumentDefinition> = USECASE_DEFINITION.or(
  NAMED_FIELD_DEFINITION
).or(NAMED_MODEL_DEFINITION);
export const PROFILE_DOCUMENT: SyntaxRuleSrc<ProfileDocumentNode> = SyntaxRule.separator(
  'SOF'
)
  .followedBy(PROFILE)
  .andBy(SyntaxRule.optional(SyntaxRule.repeat(DOCUMENT_DEFINITION)))
  .andBy(SyntaxRule.separator('EOF'))
  .map(
    (matches): SrcNode<ProfileDocumentNode> => {
      const [, /* SOF */ profile, definitions /* EOF */] = matches as [
        LexerTokenMatch<SeparatorTokenData>,
        SrcNode<ProfileNode>,
        SrcNode<DocumentDefinition>[] | undefined,
        LexerTokenMatch<SeparatorTokenData>
      ]; // TODO: Won't need `as` cast in Typescript 4

      let spanEnd = profile.span.end;
      if (definitions !== undefined) {
        spanEnd = definitions[definitions.length - 1].span.end;
      }

      return {
        kind: 'ProfileDocument',
        profile,
        definitions: definitions ?? [],
        location: profile.location,
        span: { start: profile.span.start, end: spanEnd },
      };
    }
  );
