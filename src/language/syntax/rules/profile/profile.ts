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
  ProfileHeaderNode,
  Type,
  UnionDefinitionNode,
  UseCaseDefinitionNode,
  UseCaseSlotDefinitionNode,
} from '@superfaceai/ast';

import {
  parseDocumentId,
  parseVersion,
} from '../../../../common/document/parser';
import { IdentifierTokenData, LexerTokenKind } from '../../../lexer/token';
import {
  LexerTokenMatch,
  SyntaxRule,
  SyntaxRuleMutable,
  SyntaxRuleSeparator,
} from '../../rule';
import { documentedNode, SrcNode, SyntaxRuleSrc } from '../common';

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
    .andFollowedBy(
      SyntaxRule.operator(',')
        .or(SyntaxRule.lookahead(SyntaxRule.separator('}')))
        .or(SyntaxRule.lookahead(SyntaxRule.newline()))
    )
    .map(
      ([name, maybeAssignment, _maybeComma]): SrcNode<EnumValueNode> => {
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
            end: (maybeAssignment?.[1] ?? name).span.end,
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

const NON_UNION_TYPE: SyntaxRule<
  SrcNode<Exclude<Type, UnionDefinitionNode>>
> = BASIC_TYPE.or(LIST_DEFINITION)
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
  SyntaxRule.identifier()
    .followedBy(SyntaxRule.optional(SyntaxRule.operator('!')))
    .andFollowedBy(SyntaxRule.optional(SyntaxRule.sameLine(TYPE)))
    .andFollowedBy(
      SyntaxRule.operator(',')
        .or(SyntaxRule.lookahead(SyntaxRule.separator('}')))
        .or(SyntaxRule.lookahead(SyntaxRule.newline()))
    )
    .map(
      ([
        name,
        maybeRequired,
        maybeType,
        _maybeEnd,
      ]): SrcNode<FieldDefinitionNode> => {
        return {
          kind: 'FieldDefinition',
          fieldName: name.data.identifier,
          required: maybeRequired !== undefined,
          type: maybeType,
          location: name.location,
          span: {
            start: name.span.start,
            end: (maybeType ?? maybeRequired ?? name).span.end,
          },
        };
      }
    )
);

FIELD_DEFINITION_MUT.rule = FIELD_DEFINITION;

/** * Construct of form: `field ident type` or `field ident { fields... }` */
export const NAMED_FIELD_DEFINITION: SyntaxRuleSrc<NamedFieldDefinitionNode> = documentedNode(
  SyntaxRule.identifier('field')
    .followedBy(SyntaxRule.identifier())
    .andFollowedBy(SyntaxRule.optional(SyntaxRule.sameLine(TYPE)))
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
    .andFollowedBy(SyntaxRule.optional(SyntaxRule.sameLine(TYPE)))
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

function USECASE_SLOT_DEFINITION_FACTORY<T extends Type>(
  name: string,
  rule: SyntaxRuleSrc<T>
): SyntaxRule<UseCaseSlotDefinitionNode<T>> {
  return documentedNode(
    SyntaxRule.identifier(name)
      .followedBy(SyntaxRule.sameLine(rule))
      .map(
        ([name, maybeType]): SrcNode<UseCaseSlotDefinitionNode<T>> => {
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
}

const USECASE_SAFETY: SyntaxRule<
  LexerTokenMatch<IdentifierTokenData>
> = SyntaxRule.identifier('safe')
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
    .andFollowedBy(
      SyntaxRule.optional(USECASE_SLOT_DEFINITION_FACTORY('result', TYPE))
    )
    .andFollowedBy(
      SyntaxRule.optional(
        USECASE_SLOT_DEFINITION_FACTORY(
          'async',
          SyntaxRule.identifier('result')
            .followedBy(SyntaxRule.sameLine(TYPE))
            .map(([_name, type]) => type)
        )
      )
    )
    .andFollowedBy(
      SyntaxRule.optional(USECASE_SLOT_DEFINITION_FACTORY('error', TYPE))
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([
        key,
        name,
        maybeSafety,
        _sepStart,
        maybeInput,
        maybeResult,
        maybeAsyncResult,
        maybeError,
        sepEnd,
      ]): SrcNode<UseCaseDefinitionNode> => {
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
          asyncResult: maybeAsyncResult,
          error: maybeError,
          location: key.location,
          span: { start: key.span.start, end: sepEnd.span.end },
        };
      }
    )
);

// DOCUMENT //
const PROFILE_NAME = SyntaxRule.identifier('name')
  .followedBy(SyntaxRuleSeparator.operator('='))
  .andFollowedBy(
    SyntaxRule.string().andThen<
      SrcNode<{ scope?: string, name: string }>
    >(name => {
      const parseNameResult = parseDocumentId(name.data.string);
      // profiles can't have version specified in the name
      if (
        parseNameResult.kind !== 'parsed' ||
        parseNameResult.value.middle.length !== 1 ||
        parseNameResult.value.version !== undefined
      ) {
        return {
          kind: 'nomatch',
        };
      }
      const parsedName = parseNameResult.value;

      return {
        kind: 'match',
        value: {
          scope: parsedName.scope,
          name: parsedName.middle[0],
          location: name.location,
          span: name.span,
        },
      };
    }, 'profile name in format `[<scope>/]<name>` with lowercase identifier')
  )
  .map(([keyword, _op, name]) => {
    return {
      scope: name.scope,
      name: name.name,
      location: keyword.location,
      span: {
        start: keyword.span.start,
        end: name.span.end,
      },
    };
  });
const PROFILE_VERSION = SyntaxRule.identifier('version')
  .followedBy(SyntaxRuleSeparator.operator('='))
  .andFollowedBy(
    SyntaxRule.string().andThen<
      SrcNode<{ major: number, minor: number, patch: number, label?: string }>
    >(version => {
      const parseVersionResult = parseVersion(version.data.string);
      if (parseVersionResult.kind !== 'parsed') {
        return { kind: 'nomatch' };
      }
      const parsedVersion = parseVersionResult.value;

      return {
        kind: 'match',
        value: {
          major: parsedVersion.major,
          minor: parsedVersion.minor ?? 0,
          patch: parsedVersion.patch ?? 0,
          label: parsedVersion.label,
          location: version.location,
          span: version.span,
        },
      };
    }, 'semver version')
  )
  .map(([keyword, _op, version]) => {
    return {
      version: {
        major: version.major,
        minor: version.minor,
        patch: version.patch,
      },
      location: keyword.location,
      span: {
        start: keyword.span.start,
        end: version.span.end,
      },
    };
  });
export const PROFILE_HEADER: SyntaxRuleSrc<ProfileHeaderNode> = documentedNode(
  PROFILE_NAME.followedBy(PROFILE_VERSION).map(
    ([name, version]): SrcNode<ProfileHeaderNode> => {
      return {
        kind: 'ProfileHeader',
        scope: name.scope,
        name: name.name,
        version: version.version,

        location: name.location,
        span: {
          start: name.span.start,
          end: (version ?? name).span.end,
        },
      };
    }
  )
);

export const PROFILE_DOCUMENT_DEFINITION: SyntaxRuleSrc<DocumentDefinition> = USECASE_DEFINITION.or(
  NAMED_FIELD_DEFINITION
).or(NAMED_MODEL_DEFINITION);
export const PROFILE_DOCUMENT: SyntaxRuleSrc<ProfileDocumentNode> = SyntaxRule.separator(
  'SOF'
)
  .followedBy(PROFILE_HEADER)
  .andFollowedBy(
    SyntaxRule.optional(SyntaxRule.repeat(PROFILE_DOCUMENT_DEFINITION))
  )
  .andFollowedBy(SyntaxRule.separator('EOF'))
  .map(
    ([_SOF, header, definitions, _EOF]): SrcNode<ProfileDocumentNode> => {
      return {
        kind: 'ProfileDocument',
        header,
        definitions: definitions ?? [],
        location: header.location,
        span: {
          start: header.span.start,
          end: (definitions?.[definitions.length - 1] ?? header).span.end,
        },
      };
    }
  );
