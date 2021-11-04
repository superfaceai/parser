import {
  ComlinkLiteralNode,
  ComlinkObjectLiteralNode,
  DocumentDefinition,
  DocumentedNode,
  EnumDefinitionNode,
  EnumValueNode,
  FieldDefinitionNode,
  ListDefinitionNode,
  ModelTypeNameNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  ObjectDefinitionNode,
  PrimitiveTypeNameNode,
  ProfileASTNode,
  ProfileDocumentNode,
  ProfileHeaderNode,
  Type,
  UnionDefinitionNode,
  UseCaseDefinitionNode,
  UseCaseExampleNode,
  UseCaseSlotDefinitionNode,
} from '@superfaceai/ast';

import { parseDocumentId } from '../../../../common/document/parser';
import { VersionRange } from '../../../../common/document/version';
import { PARSED_AST_VERSION, PARSED_VERSION } from '../../../../metadata';
import { IdentifierTokenData, LexerTokenKind } from '../../../lexer/token';
import {
  LexerTokenMatch,
  SyntaxRule,
  SyntaxRuleFollowedBy,
  SyntaxRuleMutable,
  SyntaxRuleSeparator,
} from '../../rule';
import {
  computeLocationSpan,
  documentedNode,
  expectTerminated,
  HasLocation,
  SyntaxRuleSourceChecksum,
  WithLocation,
} from '../common';
import { COMLINK_LITERAL, COMLINK_OBJECT_LITERAL } from './literal';

// MUTABLE RULES //

// These rules need to use mutability to achieve recursion and they make use of the `SyntaxRuleMutable` rule
const TYPE_MUT = new SyntaxRuleMutable<WithLocation<Type>>();
const FIELD_DEFINITION_MUT = new SyntaxRuleMutable<
  WithLocation<FieldDefinitionNode>
>();

// TYPES //

/** From keywords: `boolean`, `number` and `string` */
export const PRIMITIVE_TYPE_NAME: SyntaxRule<
  WithLocation<PrimitiveTypeNameNode>
> = SyntaxRule.identifier('boolean')
  .or(SyntaxRule.identifier('number'))
  .or(SyntaxRule.identifier('string'))
  .map((keywordMatch): WithLocation<PrimitiveTypeNameNode> => {
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
      location: keywordMatch.location,
    };
  });

export const ENUM_VALUE: SyntaxRule<WithLocation<EnumValueNode>> =
  documentedNode(
    expectTerminated(
      SyntaxRule.identifier().followedBy(
        SyntaxRule.optional(
          SyntaxRule.operator('=').followedBy(
            SyntaxRule.literal().or(SyntaxRule.string())
          )
        )
      ),
      ',',
      '}',
      '\n'
    ).map(([name, maybeAssignment]): WithLocation<EnumValueNode> => {
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
            throw new Error(
              'Unexpected token kind. This is an error in the syntax rule definition'
            );
        }
      }

      return {
        kind: 'EnumValue',
        value: enumValue,
        location: computeLocationSpan(name, ...(maybeAssignment ?? [])),
      };
    })
  );
/** Construct of form: `enum { values... }` */
export const ENUM_DEFINITION: SyntaxRule<WithLocation<EnumDefinitionNode>> =
  SyntaxRule.identifier('enum')
    .followedBy(SyntaxRule.separator('{'))
    .andFollowedBy(SyntaxRule.repeat(ENUM_VALUE))
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([
        keyword,
        _sepStart,
        values,
        sepEnd,
      ]): WithLocation<EnumDefinitionNode> => {
        return {
          kind: 'EnumDefinition',
          values,
          location: computeLocationSpan(keyword, sepEnd),
        };
      }
    );

/** Name of a model type parsed from identifiers. */
export const MODEL_TYPE_NAME: SyntaxRule<WithLocation<ModelTypeNameNode>> =
  SyntaxRule.identifier().map((name): WithLocation<ModelTypeNameNode> => {
    return {
      kind: 'ModelTypeName',
      name: name.data.identifier,
      location: computeLocationSpan(name),
    };
  });

/** Construct of form: `{ fields... }` */
export const OBJECT_DEFINITION: SyntaxRule<WithLocation<ObjectDefinitionNode>> =
  SyntaxRule.separator('{')
    .followedBy(SyntaxRule.optional(SyntaxRule.repeat(FIELD_DEFINITION_MUT)))
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([sepStart, maybeFields, sepEnd]): WithLocation<ObjectDefinitionNode> => {
        return {
          kind: 'ObjectDefinition',
          fields: maybeFields ?? [],
          location: computeLocationSpan(sepStart, sepEnd),
        };
      }
    );

// Helper rule to ensure correct precedence
//
// MODEL must go after both PRIMITIVE and ENUM
const BASIC_TYPE: SyntaxRule<
  | WithLocation<PrimitiveTypeNameNode>
  | WithLocation<EnumDefinitionNode>
  | WithLocation<ModelTypeNameNode>
  | WithLocation<ObjectDefinitionNode>
> = PRIMITIVE_TYPE_NAME.or(ENUM_DEFINITION)
  .or(MODEL_TYPE_NAME)
  .or(OBJECT_DEFINITION);

/** Array type: `[type]` */
export const LIST_DEFINITION: SyntaxRule<WithLocation<ListDefinitionNode>> =
  SyntaxRule.separator('[')
    .followedBy(TYPE_MUT)
    .andFollowedBy(SyntaxRule.separator(']'))
    .map(([sepStart, type, sepEnd]): WithLocation<ListDefinitionNode> => {
      return {
        kind: 'ListDefinition',
        elementType: type,
        location: computeLocationSpan(sepStart, sepEnd),
      };
    });

const NON_UNION_TYPE: SyntaxRule<
  WithLocation<Exclude<Type, UnionDefinitionNode>>
> = BASIC_TYPE.or(LIST_DEFINITION)
  .followedBy(SyntaxRule.optional(SyntaxRule.operator('!')))
  .map(
    ([type, maybeOp]): WithLocation<
      WithLocation<Exclude<Type, UnionDefinitionNode>>
    > => {
      if (maybeOp !== undefined) {
        return {
          kind: 'NonNullDefinition',
          type: type,
          location: computeLocationSpan(type, maybeOp),
        };
      }

      return type;
    }
  );

export const TYPE: SyntaxRule<WithLocation<Type>> = NON_UNION_TYPE.followedBy(
  SyntaxRule.optional(
    SyntaxRule.repeat(SyntaxRule.operator('|').followedBy(NON_UNION_TYPE))
  )
).map(([firstType, maybeRestPairs]): WithLocation<Type> => {
  // Handle unions
  if (maybeRestPairs !== undefined) {
    const types = [firstType, ...maybeRestPairs.map(([_op, type]) => type)];

    return {
      kind: 'UnionDefinition',
      types,
      location: computeLocationSpan(firstType, ...types),
    };
  }

  return firstType;
});
TYPE_MUT.rule = TYPE;

// FIELDS //

export const FIELD_DEFINITION: SyntaxRule<WithLocation<FieldDefinitionNode>> =
  documentedNode(
    expectTerminated(
      SyntaxRule.identifier()
        .followedBy(SyntaxRule.optional(SyntaxRule.operator('!')))
        .andFollowedBy(SyntaxRule.optional(SyntaxRule.sameLine(TYPE))),
      ',',
      '}',
      '\n'
    ).map(
      ([name, maybeRequired, maybeType]): WithLocation<FieldDefinitionNode> => {
        return {
          kind: 'FieldDefinition',
          fieldName: name.data.identifier,
          required: maybeRequired !== undefined,
          type: maybeType,
          location: computeLocationSpan(name, maybeRequired, maybeType),
        };
      }
    )
  );

FIELD_DEFINITION_MUT.rule = FIELD_DEFINITION;

/** * Construct of form: `field ident type` or `field ident { fields... }` */
export const NAMED_FIELD_DEFINITION: SyntaxRule<
  WithLocation<NamedFieldDefinitionNode>
> = documentedNode(
  SyntaxRule.identifier('field')
    .followedBy(SyntaxRule.identifier())
    .andFollowedBy(SyntaxRule.optional(SyntaxRule.sameLine(TYPE)))
    .map(
      ([
        keyword,
        fieldName,
        maybeType,
      ]): WithLocation<NamedFieldDefinitionNode> => {
        return {
          kind: 'NamedFieldDefinition',
          fieldName: fieldName.data.identifier,
          type: maybeType,
          location: computeLocationSpan(keyword, fieldName, maybeType),
        };
      }
    )
);

// MODEL //

/** Construct of form: `model ident type` or `model ident { fields... }` */
export const NAMED_MODEL_DEFINITION: SyntaxRule<
  WithLocation<NamedModelDefinitionNode>
> = documentedNode(
  SyntaxRule.identifier('model')
    .followedBy(SyntaxRule.identifier())
    .andFollowedBy(SyntaxRule.optional(SyntaxRule.sameLine(TYPE)))
    .map(
      ([
        keyword,
        modelName,
        maybeType,
      ]): WithLocation<NamedModelDefinitionNode> => {
        return {
          kind: 'NamedModelDefinition',
          modelName: modelName.data.identifier,
          type: maybeType,
          location: computeLocationSpan(keyword, modelName, maybeType),
        };
      }
    )
);

// USECASE //

type SlotType<T> = { value: T } & HasLocation & WithLocation<DocumentedNode>;
function SLOT_FACTORY<T extends HasLocation>(
  names: [string, ...string[]],
  rule: SyntaxRule<T>
): SyntaxRule<SlotType<T>> {
  let namesRule: SyntaxRule<
    [
      LexerTokenMatch<IdentifierTokenData>,
      ...LexerTokenMatch<IdentifierTokenData>[]
    ]
  > = SyntaxRule.identifier(names[0]).map(v => [v]);
  for (const name of names.slice(1)) {
    namesRule = new SyntaxRuleFollowedBy(
      namesRule,
      SyntaxRule.sameLine(SyntaxRule.identifier(name))
    );
  }

  const slotrule = namesRule
    .followedBy(SyntaxRule.sameLine(rule))
    .map(([names, value]): SlotType<T> => {
      return {
        value,
        location: computeLocationSpan(...names, value as HasLocation),
      };
    });

  return documentedNode<SlotType<T>>(slotrule);
}

function USECASE_SLOT_DEFINITION_FACTORY<
  T extends ProfileASTNode & DocumentedNode
>(
  names: [string, ...string[]],
  rule: SyntaxRule<WithLocation<T>>
): SyntaxRule<WithLocation<UseCaseSlotDefinitionNode<T>>> {
  return SLOT_FACTORY(names, rule).map(
    (slot): WithLocation<UseCaseSlotDefinitionNode<T>> => {
      return {
        kind: 'UseCaseSlotDefinition',
        value: slot.value,
        location: slot.location,
        documentation: slot.documentation,
      };
    }
  );
}

const USECASE_SAFETY: SyntaxRule<LexerTokenMatch<IdentifierTokenData>> =
  SyntaxRule.identifier('safe')
    .or(SyntaxRule.identifier('unsafe'))
    .or(SyntaxRule.identifier('idempotent'));

const USECASE_EXAMPLE: SyntaxRule<WithLocation<UseCaseExampleNode>> =
  SyntaxRule.optional(SyntaxRule.identifier())
    .followedBy(SyntaxRule.separator('{'))
    .andFollowedBy(
      SyntaxRule.optional(
        USECASE_SLOT_DEFINITION_FACTORY<ComlinkObjectLiteralNode>(
          ['input'],
          COMLINK_OBJECT_LITERAL
        )
      )
    )
    .andFollowedBy(
      SyntaxRule.optional(
        USECASE_SLOT_DEFINITION_FACTORY<ComlinkLiteralNode>(
          ['result'],
          COMLINK_LITERAL
        )
      )
    )
    .andFollowedBy(
      SyntaxRule.optional(
        USECASE_SLOT_DEFINITION_FACTORY<ComlinkLiteralNode>(
          ['async', 'result'],
          COMLINK_LITERAL
        )
      )
    )
    .andFollowedBy(
      SyntaxRule.optional(
        USECASE_SLOT_DEFINITION_FACTORY<ComlinkLiteralNode>(
          ['error'],
          COMLINK_LITERAL
        )
      )
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .andThen<WithLocation<UseCaseExampleNode>>(
      ([
        maybeName,
        sepStart,
        maybeInput,
        maybeResult,
        maybeAsyncResult,
        maybeError,
        sepEnd,
      ]) => {
        if (
          maybeError !== undefined &&
          (maybeResult !== undefined || maybeAsyncResult !== undefined)
        ) {
          return { kind: 'nomatch' };
        }

        const value: WithLocation<UseCaseExampleNode> = {
          kind: 'UseCaseExample',
          exampleName: maybeName?.data.identifier,
          input: maybeInput,
          result: maybeResult,
          asyncResult: maybeAsyncResult,
          error: maybeError,
          location: computeLocationSpan(maybeName, sepStart, sepEnd),
        };

        return { kind: 'match', value };
      }
    );

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
export const USECASE_DEFINITION: SyntaxRule<
  WithLocation<UseCaseDefinitionNode>
> = documentedNode(
  SyntaxRule.identifier('usecase')
    .followedBy(SyntaxRule.identifier(undefined))
    .andFollowedBy(SyntaxRule.optional(USECASE_SAFETY))
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(
      SyntaxRule.optional(
        USECASE_SLOT_DEFINITION_FACTORY<ObjectDefinitionNode>(
          ['input'],
          OBJECT_DEFINITION
        )
      )
    )
    .andFollowedBy(
      SyntaxRule.optional(
        USECASE_SLOT_DEFINITION_FACTORY<Type>(['result'], TYPE)
      )
    )
    .andFollowedBy(
      SyntaxRule.optional(
        USECASE_SLOT_DEFINITION_FACTORY<Type>(['async', 'result'], TYPE)
      )
    )
    .andFollowedBy(
      SyntaxRule.optional(
        USECASE_SLOT_DEFINITION_FACTORY<Type>(['error'], TYPE)
      )
    )
    .andFollowedBy(
      SyntaxRule.optional(
        SyntaxRule.repeat(
          USECASE_SLOT_DEFINITION_FACTORY<UseCaseExampleNode>(
            ['example'],
            USECASE_EXAMPLE
          )
        )
      )
    )
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      ([
        keyword,
        name,
        maybeSafety,
        _sepStart,
        maybeInput,
        maybeResult,
        maybeAsyncResult,
        maybeError,
        maybeExamples,
        sepEnd,
      ]): WithLocation<UseCaseDefinitionNode> => {
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
          examples: maybeExamples,
          location: computeLocationSpan(keyword, sepEnd),
        };
      }
    )
);

// DOCUMENT //
const PROFILE_NAME = SyntaxRule.identifier('name')
  .followedBy(SyntaxRuleSeparator.operator('='))
  .andFollowedBy(
    SyntaxRule.string().andThen<{ scope?: string; name: string } & HasLocation>(
      name => {
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
          },
        };
      },
      'profile name in format `[<scope>/]<name>` with lowercase identifier'
    )
  )
  .map(([keyword, op, name]) => {
    return {
      scope: name.scope,
      name: name.name,
      location: computeLocationSpan(keyword, op, name),
    };
  });
const PROFILE_VERSION = SyntaxRule.identifier('version')
  .followedBy(SyntaxRuleSeparator.operator('='))
  .andFollowedBy(
    SyntaxRule.string().andThen<
      {
        major: number;
        minor: number;
        patch: number;
        label?: string;
      } & HasLocation
    >(version => {
      try {
        const parsedVersion = VersionRange.fromString(version.data.string);

        return {
          kind: 'match',
          value: {
            major: parsedVersion.major,
            minor: parsedVersion.minor ?? 0,
            patch: parsedVersion.patch ?? 0,
            label: parsedVersion.label,
            location: version.location,
          },
        };
      } catch (error) {
        return { kind: 'nomatch' };
      }
    }, 'semver version')
  )
  .map(([keyword, op, version]) => {
    return {
      version: {
        major: version.major,
        minor: version.minor,
        patch: version.patch,
      },
      location: computeLocationSpan(keyword, op, version),
    };
  });
export const PROFILE_HEADER: SyntaxRule<WithLocation<ProfileHeaderNode>> =
  documentedNode(
    PROFILE_NAME.followedBy(PROFILE_VERSION).map(
      ([name, version]): WithLocation<ProfileHeaderNode> => {
        return {
          kind: 'ProfileHeader',
          scope: name.scope,
          name: name.name,
          version: version.version,
          location: computeLocationSpan(name, version),
        };
      }
    )
  );

export const PROFILE_DOCUMENT_DEFINITION: SyntaxRule<
  WithLocation<DocumentDefinition>
> = USECASE_DEFINITION.or(NAMED_FIELD_DEFINITION).or(NAMED_MODEL_DEFINITION);

export const PROFILE_DOCUMENT: SyntaxRule<WithLocation<ProfileDocumentNode>> =
  SyntaxRule.separator('SOF')
    .followedBy(PROFILE_HEADER)
    .andFollowedBy(
      SyntaxRule.optional(SyntaxRule.repeat(PROFILE_DOCUMENT_DEFINITION))
    )
    .andFollowedBy(SyntaxRule.separator('EOF'))
    .andFollowedBy(new SyntaxRuleSourceChecksum())
    .map(
      ([
        _SOF,
        header,
        maybeDefinitions,
        _EOF,
        sourceChecksum,
      ]): WithLocation<ProfileDocumentNode> => {
        const definitions = maybeDefinitions ?? [];

        return {
          kind: 'ProfileDocument',
          header,
          definitions,
          location: computeLocationSpan(header, ...definitions),
          astMetadata: {
            astVersion: PARSED_AST_VERSION,
            parserVersion: PARSED_VERSION,
            sourceChecksum,
          },
        };
      }
    );
