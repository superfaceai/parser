import {
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
  ProfileASTNode,
  ProfileDocumentNode,
  ProfileIdNode,
  ProfileNode,
  UnionDefinitionNode,
  UseCaseDefinitionNode,
} from '@superindustries/language';
import { ProfileVisitor } from '@superindustries/superface';

function assertUnreachable(node: never): never;
function assertUnreachable(node: ProfileASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

type StructureKind =
  | 'PrimitiveStructure'
  | 'EnumStructure'
  | 'NonNullStructure'
  | 'ListStructure'
  | 'ObjectStructure'
  | 'ModelStructure'
  | 'UnionStructure';

/**
 * @interface Structure represents skeleton for other structures
 */
export interface Structure {
  kind: StructureKind;
  required?: boolean;
}

/**
 * @interface PrimitiveStructure represents structure of primitive type
 */
export interface PrimitiveStructure extends Structure {
  kind: 'PrimitiveStructure';
  required?: true;
}
/**
 * @interface EnumStructure represent structure of enum type
 */
export interface EnumStructure extends Structure {
  kind: 'EnumStructure';
  enums: { [enumValue: string]: string | number | boolean };
  required?: true;
}
/**
 * @interface NonNullStructure represent structure of type that is !required
 */
export interface NonNullStructure extends Structure {
  kind: 'NonNullStructure';
  required: true;
  value?: Exclude<StructureType, UnionStructure>;
}
/**
 * @interface ListStructure represent structure of []list type
 */
export interface ListStructure extends Structure {
  kind: 'ListStructure';
  value?: Exclude<StructureType, EnumStructure>;
  required?: true;
}
/**
 * @interface ObjectStructure represent structure of {}object type
 */
export interface ObjectStructure extends Structure {
  kind: 'ObjectStructure';
  fields?: { [P in string]?: StructureType };
  required?: true;
}
/**
 * @interface UnionStructure represent structure of |union type
 */
export interface UnionStructure extends Structure {
  kind: 'UnionStructure';
  types: { [P in number]?: Exclude<StructureType, UnionStructure> };
}

/**
 * @type StructureType - represents all structures
 */
export type StructureType =
  | PrimitiveStructure
  | EnumStructure
  | NonNullStructure
  | ListStructure
  | ObjectStructure
  | UnionStructure;

/**
 * @type UseCaseStructure - represents usecase structure
 */
type UseCaseStructure = (
  | {
      input: ObjectStructure;
      result?: StructureType;
    }
  | {
      result?: StructureType;
    }
) & {
  useCaseName: string;
  async?: StructureType;
  error?: StructureType;
};

/**
 * @interface ProfileOutput - represent profile output for next validation
 */
export interface ProfileOutput {
  profileId: string;
  usecase: UseCaseStructure;
}

export class ProfileValidator implements ProfileVisitor {
  private fields: Record<string, StructureType | undefined> = {};
  private models: Record<string, StructureType | undefined> = {};

  visit(
    node:
      | NamedModelDefinitionNode
      | NamedFieldDefinitionNode
      | ModelTypeNameNode
      | FieldDefinitionNode
  ): StructureType | undefined;
  visit(
    node:
      | PrimitiveTypeNameNode
      | EnumDefinitionNode
      | ListDefinitionNode
      | ObjectDefinitionNode
      | UnionDefinitionNode
      | NonNullDefinitionNode
  ): StructureType;
  visit(node: UseCaseDefinitionNode): UseCaseStructure;
  visit(node: ProfileDocumentNode): ProfileOutput;
  visit(node: ProfileNode | ProfileIdNode): string;
  visit(node: EnumValueNode): string | number | boolean;
  visit(
    node: ProfileASTNode
  ):
    | undefined
    | StructureType
    | UseCaseStructure
    | ProfileOutput
    | string
    | number
    | boolean;
  visit(
    node: ProfileASTNode
  ):
    | undefined
    | StructureType
    | UseCaseStructure
    | ProfileOutput
    | string
    | number
    | boolean {
    switch (node.kind) {
      case 'EnumDefinition':
        return this.visitEnumDefinitionNode(node);
      case 'EnumValue':
        return this.visitEnumValueNode(node);
      case 'FieldDefinition':
        return this.visitFieldDefinitionNode(node);
      case 'ListDefinition':
        return this.visitListDefinitionNode(node);
      case 'ModelTypeName':
        return this.visitModelTypeNameNode(node);
      case 'NamedFieldDefinition':
        return this.visitNamedFieldDefinitionNode(node);
      case 'NamedModelDefinition':
        return this.visitNamedModelDefinitionNode(node);
      case 'NonNullDefinition':
        return this.visitNonNullDefinitionNode(node);
      case 'ObjectDefinition':
        return this.visitObjectDefinitionNode(node);
      case 'PrimitiveTypeName':
        return this.visitPrimitiveTypeNameNode(node);
      case 'ProfileDocument':
        return this.visitProfileDocumentNode(node);
      case 'ProfileId':
        return this.visitProfileIdNode(node);
      case 'Profile':
        return this.visitProfileNode(node);
      case 'UnionDefinition':
        return this.visitUnionDefinitionNode(node);
      case 'UseCaseDefinition':
        return this.visitUseCaseDefinitionNode(node);

      default:
        assertUnreachable(node);
    }
  }

  visitEnumDefinitionNode(node: EnumDefinitionNode): StructureType {
    const enumeration: EnumStructure = {
      kind: 'EnumStructure',
      enums: {},
    };

    node.values.forEach((enumValue: EnumValueNode) => {
      if (typeof enumValue.value === 'string') {
        enumeration.enums[enumValue.value] = this.visit(enumValue);
      }
    });

    return enumeration;
  }

  visitEnumValueNode(node: EnumValueNode): string | number | boolean {
    return node.value;
  }

  visitFieldDefinitionNode(
    node: FieldDefinitionNode
  ): StructureType | undefined {
    if (node.type === undefined) {
      return this.fields[node.fieldName];
    }

    return this.visit(node.type) as StructureType | undefined;
  }

  visitListDefinitionNode(node: ListDefinitionNode): StructureType {
    const value = this.visit(node.elementType) as StructureType | undefined;

    if (value === undefined || value.kind !== 'EnumStructure')
      return {
        kind: 'ListStructure',
        value,
      };
    else throw new Error('Something went very wrong, this should not happen!');
  }

  visitModelTypeNameNode(node: ModelTypeNameNode): StructureType | undefined {
    return this.models[node.name];
  }

  visitNamedFieldDefinitionNode(
    node: NamedFieldDefinitionNode
  ): StructureType | undefined {
    const fieldName = node.fieldName;

    if (node.type !== undefined) {
      this.fields[fieldName] = this.visit(node.type) as StructureType;

      return this.fields[fieldName];
    }

    return undefined;
  }

  visitNamedModelDefinitionNode(
    node: NamedModelDefinitionNode
  ): StructureType | undefined {
    const modelName = node.modelName;

    if (node.type !== undefined) {
      this.models[modelName] = this.visit(node.type) as StructureType;

      return this.models[modelName];
    }

    return undefined;
  }

  visitNonNullDefinitionNode(node: NonNullDefinitionNode): StructureType {
    const value = this.visit(node.type) as StructureType | undefined;

    if (value === undefined || value.kind !== 'UnionStructure')
      return {
        kind: 'NonNullStructure',
        required: true,
        value,
      };
    else throw new Error('Something went very wrong, this should not happen!');
  }

  visitObjectDefinitionNode(node: ObjectDefinitionNode): StructureType {
    const obj: ObjectStructure = {
      kind: 'ObjectStructure',
    };

    node.fields.forEach((field: FieldDefinitionNode) => {
      obj.fields = { ...obj.fields };
      obj.fields[field.fieldName] = this.visit(field);
    });

    return obj;
  }

  visitPrimitiveTypeNameNode(_node: PrimitiveTypeNameNode): StructureType {
    return {
      kind: 'PrimitiveStructure',
    };
  }

  visitProfileDocumentNode(node: ProfileDocumentNode): ProfileOutput {
    node.definitions
      .filter(
        (definition): definition is NamedFieldDefinitionNode =>
          definition.kind === 'NamedFieldDefinition'
      )
      .forEach(field => {
        this.fields[field.fieldName] = undefined;
        this.visit(field);
      });

    node.definitions
      .filter((definition): definition is NamedModelDefinitionNode => {
        return definition.kind === 'NamedModelDefinition';
      })
      .forEach(model => {
        this.models[model.modelName] = undefined;
        this.visit(model);
      });

    const profileId = this.visit(node.profile);
    const usecase = this.visit(
      node.definitions.filter(
        (definition): definition is UseCaseDefinitionNode => {
          return definition.kind === 'UseCaseDefinition';
        }
      )[0]
    );

    return {
      profileId,
      usecase,
    };
  }

  visitProfileIdNode(node: ProfileIdNode): string {
    return node.profileId;
  }

  visitProfileNode(node: ProfileNode): string {
    return this.visit(node.profileId);
  }

  visitUnionDefinitionNode(node: UnionDefinitionNode): StructureType {
    const union: UnionStructure = {
      kind: 'UnionStructure',
      types: [],
    };

    node.types.forEach((type, i) => {
      const structure = this.visit(type) as StructureType | undefined;
      if (structure === undefined || structure.kind !== 'UnionStructure') {
        union.types[i] = structure;
      } else
        throw new Error('Something went very wrong, this should not happen!');
    });

    return union;
  }

  visitUseCaseDefinitionNode(node: UseCaseDefinitionNode): UseCaseStructure {
    const useCaseName = node.useCaseName;

    if (node.input !== undefined && node.result !== undefined) {
      return {
        useCaseName,
        input: this.visit(node.input) as ObjectStructure,
        result: this.visit(node.result) as StructureType,
      };
    }
    if (node.result !== undefined) {
      return {
        useCaseName,
        result: this.visit(node.result) as StructureType,
      };
    } else
      throw new Error('Something went very wrong, this should not happen!');
  }
}
