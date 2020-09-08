import {
  DocumentDefinition,
  EnumDefinitionNode,
  EnumValueNode,
  FieldDefinitionNode,
  ListDefinitionNode,
  ModelTypeNameNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  ObjectDefinitionNode,
  PrimitiveTypeNameNode,
  ProfileDocumentNode,
  ProfileIdNode,
  ProfileNode,
  Type,
  UnionDefinitionNode,
  UseCaseDefinitionNode,
  UseCaseSlotDefinitionNode,
} from '@superindustries/language';

import { IdentifierTokenData, LexerTokenKind } from '../../lexer/token';
import {
  LexerTokenMatch,
  SyntaxRule,
  SyntaxRuleMutable,
  SyntaxRuleSeparator,
} from '../rule';
import { documentedNode, SrcNode, SyntaxRuleSrc } from './common';

// MUTABLE RULES //

// These rules need to use mutability to achieve recursion and they make use of the `SyntaxRuleMutable` rule
const TYPE_MUT = new SyntaxRuleMutable<SrcNode<Type>>();
const FIELD_DEFINITION_MUT = new SyntaxRuleMutable<
  SrcNode<FieldDefinitionNode>
>();

// TYPES //

/** From keywords: `boolean`, `number` and `string` */
export const PRIMITIVE_TYPE_NAME: SyntaxRuleSrc<PrimitiveTypeNameNode> = SyntaxRule.identifier(
  'boolean'
)
  .or(SyntaxRule.identifier('number'))
  .or(SyntaxRule.identifier('string'))
  .map(
    (keywordMatch): SrcNode<PrimitiveTypeNameNode> => {
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

export const ENUM_VALUE: SyntaxRuleSrc<EnumValueNode> = documentedNode(
  SyntaxRule.identifier()
    .followedBy(
      SyntaxRule.optional(
        SyntaxRule.operator('=').followedBy(
          SyntaxRule.literal().or(SyntaxRule.string())
        )
      )
    )
    .map(
      (matches): SrcNode<EnumValueNode> => {
        const [name, maybeAssignment] = matches;

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
          span: {
            start: name.span.start,
            end: maybeAssignment?.[1].span.end ?? name.span.end,
          },
        };
      }
    )
);
/** Construct of form: `enum { values... }` */
export const ENUM_DEFINITION: SyntaxRuleSrc<EnumDefinitionNode> = SyntaxRule.identifier(
  'enum'
)
  .followedBy(SyntaxRule.separator('{'))
  .andFollowedBy(SyntaxRule.repeat(ENUM_VALUE))
  .andFollowedBy(SyntaxRule.separator('}'))
  .map(
    (matches): SrcNode<EnumDefinitionNode> => {
      const [keyword /* sepStart */, , values, sepEnd] = matches;

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
  .andFollowedBy(SyntaxRule.separator('}'))
  .map(
    (matches): SrcNode<ObjectDefinitionNode> => {
      const [sepStart, fields, sepEnd] = matches;

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
  .andFollowedBy(SyntaxRule.separator(']'))
  .map(
    (matches): SrcNode<ListDefinitionNode> => {
      const [sepStart, type, sepEnd] = matches;

      return {
        kind: 'ListDefinition',
        elementType: type,
        location: sepStart.location,
        span: { start: sepStart.span.start, end: sepEnd.span.end },
      };
    }
  );

const NON_UNION_TYPE: SyntaxRule<SrcNode<
  Exclude<Type, UnionDefinitionNode>
>> = BASIC_TYPE.or(LIST_DEFINITION)
  .followedBy(SyntaxRule.optional(SyntaxRule.operator('!')))
  .map(
    (matches): SrcNode<SrcNode<Exclude<Type, UnionDefinitionNode>>> => {
      const [type, maybeOp] = matches;

      if (maybeOp !== undefined) {
        return {
          kind: 'NonNullDefinition',
          type: type,
          location: type.location,
          span: { start: type.span.start, end: maybeOp.span.end },
        };
      }

      return type;
    }
  );

export const TYPE: SyntaxRuleSrc<Type> = NON_UNION_TYPE.followedBy(
  SyntaxRule.optional(
    SyntaxRule.repeat(SyntaxRule.operator('|').followedBy(NON_UNION_TYPE))
  )
).map(
  (matches): SrcNode<Type> => {
    const [firstType, maybeRestPairs] = matches;

    // Handle unions
    if (maybeRestPairs !== undefined) {
      const types = [firstType];
      maybeRestPairs.forEach(([_op, type]) => types.push(type));

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

    return firstType;
  }
);
TYPE_MUT.rule = TYPE;

// FIELDS //

export const FIELD_DEFINITION: SyntaxRuleSrc<FieldDefinitionNode> = documentedNode(
  SyntaxRule.identifier().followedBy(
    SyntaxRule.optional(SyntaxRule.operator('!'))
  ).andFollowedBy(
    SyntaxRule.optional(
      SyntaxRule.lookahead(
          SyntaxRule.newline(),
          true
      ).followedBy(TYPE)
    )
  ).andFollowedBy(
    SyntaxRule.optional(SyntaxRule.operator(','))
  ).map(
    (matches): SrcNode<FieldDefinitionNode> => {
      const [name, maybeRequired, maybeTypeWithLookahead, maybeComma] = matches;

      const maybeType = maybeTypeWithLookahead?.[1]

      return {
        kind: 'FieldDefinition',
        fieldName: name.data.identifier,
        required: maybeRequired !== undefined,
        type: maybeType,
        location: name.location,
        span: {
          start: name.span.start,
          end: (maybeComma ?? maybeType ?? maybeRequired ?? name).span.end
        }
      }
    }
  )
)

FIELD_DEFINITION_MUT.rule = FIELD_DEFINITION;

/** * Construct of form: `field ident type` or `field ident { fields... }` */
export const NAMED_FIELD_DEFINITION: SyntaxRuleSrc<NamedFieldDefinitionNode> = documentedNode(
  SyntaxRule.identifier('field')
    .followedBy(SyntaxRule.identifier())
    .andFollowedBy(SyntaxRule.optional(TYPE))
    .map(
      (matches): SrcNode<NamedFieldDefinitionNode> => {
        const [keyword, fieldName, type] = matches;

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

/** Construct of form: `model ident type` or `model ident { fields... }` */
export const NAMED_MODEL_DEFINITION: SyntaxRuleSrc<NamedModelDefinitionNode> = documentedNode(
  SyntaxRule.identifier('model')
    .followedBy(SyntaxRule.identifier())
    .andFollowedBy(SyntaxRule.optional(TYPE))
    .map(
      (matches): SrcNode<NamedModelDefinitionNode> => {
        const [keyword, modelName, type] = matches;

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

const USECASE_SLOT_DEFINITION_FACTORY: <T extends Type>(
  slotName: string,
  typeRule: SyntaxRuleSrc<T>
) => SyntaxRuleSrc<UseCaseSlotDefinitionNode<T>> = <T extends Type>(
  slotName: string,
  typeRule: SyntaxRuleSrc<T>
) =>
  documentedNode<
    SrcNode<UseCaseSlotDefinitionNode<T>>,
    SyntaxRule<SrcNode<UseCaseSlotDefinitionNode<T>>>
  >(
    SyntaxRule.identifier(slotName)
      .followedBy(SyntaxRule.optional(typeRule))
      .map(
        (matches): SrcNode<UseCaseSlotDefinitionNode<T>> => {
          const [name, maybeType] = matches;

          return {
            kind: 'UseCaseSlotDefinition',
            type: maybeType,
            location: name.location,
            span: {
              start: name.span.start,
              end: (maybeType ?? name).span.end,
            },
          };
        }
      )
  );

const USECASE_SAFETY: SyntaxRule<LexerTokenMatch<
  IdentifierTokenData
>> = SyntaxRule.identifier('safe')
  .or(SyntaxRule.identifier('unsafe'))
  .or(SyntaxRule.identifier('idempotent'));

/**
* Construct of form:
```
usecase ident safety {
  input { fields... }
  result type
  error type
}
```
*/
export const USECASE_DEFINITION: SyntaxRuleSrc<UseCaseDefinitionNode> = documentedNode(
  SyntaxRule.identifier('usecase')
    .followedBy(SyntaxRule.identifier(undefined))
    .andFollowedBy(SyntaxRule.optional(USECASE_SAFETY))
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(
      SyntaxRule.optional(
        USECASE_SLOT_DEFINITION_FACTORY('input', OBJECT_DEFINITION)
      )
    )
    .andFollowedBy(SyntaxRule.optional(USECASE_SLOT_DEFINITION_FACTORY('result', TYPE)))
    .andFollowedBy(
      SyntaxRule.optional(
        SyntaxRule.identifier('async').followedBy(
          USECASE_SLOT_DEFINITION_FACTORY('result', TYPE)
        )
      )
    )
    .andFollowedBy(SyntaxRule.optional(USECASE_SLOT_DEFINITION_FACTORY('error', TYPE)))
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      (matches): SrcNode<UseCaseDefinitionNode> => {
        const [
          usecaseKey,
          name,
          maybeSafety,
          ,
          /* sepStart */ maybeInput,
          maybeResult,
          maybeAsyncResult,
          maybeError,
          sepEnd,
        ] = matches;

        let safety: UseCaseDefinitionNode['safety'] = undefined;
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
          input: maybeInput,
          result: maybeResult,
          asyncResult: maybeAsyncResult?.[1],
          error: maybeError,
          location: usecaseKey.location,
          span: { start: usecaseKey.span.start, end: sepEnd.span.end },
        };
      }
    )
);

// DOCUMENT //

/** `profile = string` */
export const PROFILE_ID: SyntaxRuleSrc<ProfileIdNode> = SyntaxRule.identifier(
  'profile'
)
  .followedBy(SyntaxRuleSeparator.operator('='))
  .andFollowedBy(SyntaxRule.string())
  .map(
    (matches): SrcNode<ProfileIdNode> => {
      const [keyword /* op */, , profileId] = matches;

      return {
        kind: 'ProfileId',
        profileId: profileId.data.string,
        location: keyword.location,
        span: { start: keyword.span.start, end: profileId.span.end },
      };
    }
  );

export const PROFILE: SyntaxRuleSrc<ProfileNode> = documentedNode(
  PROFILE_ID.map(
    (profileId): SrcNode<ProfileNode> => {
      return {
        kind: 'Profile',
        profileId,
        location: profileId.location,
        span: {
          start: profileId.span.start,
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
  .andFollowedBy(SyntaxRule.optional(SyntaxRule.repeat(DOCUMENT_DEFINITION)))
  .andFollowedBy(SyntaxRule.separator('EOF'))
  .map(
    (matches): SrcNode<ProfileDocumentNode> => {
      const [, /* SOF */ profile, definitions /* EOF */] = matches;

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
