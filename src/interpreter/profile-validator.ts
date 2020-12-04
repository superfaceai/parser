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
  Type,
  UnionDefinitionNode,
  UseCaseDefinitionNode,
  UseCaseSlotDefinitionNode,
} from '@superfaceai/ast';
import { ProfileVisitor } from '@superfaceai/sdk';

function assertUnreachable(node: never): never;
function assertUnreachable(node: ProfileASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

export type StructureKind =
  | 'PrimitiveStructure'
  | 'EnumStructure'
  | 'NonNullStructure'
  | 'ListStructure'
  | 'ObjectStructure'
  | 'ModelStructure'
  | 'UnionStructure'
  | 'AnyStructure';

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
  type: 'string' | 'number' | 'boolean';
  required?: true;
}
/**
 * @interface EnumStructure represent structure of enum type
 *  map have to return those two types
 */
export interface EnumStructure extends Structure {
  kind: 'EnumStructure';
  enums: (string | number | boolean)[];
  required?: true;
}
/**
 * @interface NonNullStructure represent structure of type that is !required
 */
export interface NonNullStructure extends Structure {
  kind: 'NonNullStructure';
  value: Exclude<StructureType, UnionStructure>;
  required?: true;
}
/**
 * @interface ListStructure represent structure of []list type
 */
export interface ListStructure extends Structure {
  kind: 'ListStructure';
  value: Exclude<StructureType, EnumStructure>;
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
 * @interface AnyStructure represent any structure
 */
export interface AnyStructure extends Structure {
  kind: 'AnyStructure';
  required?: true;
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
  | UnionStructure
  | AnyStructure;

/**
 * @interface UseCaseStructure - represents usecase structure
 */
export interface UseCaseStructure {
  useCaseName: string;
  input?: ObjectStructure;
  result?: StructureType;
  async?: StructureType;
  error?: StructureType;
}

/**
 * @interface ProfileOutput - represent profile structure
 * @property profileId - profile id
 * @property usecase (opt.) - contains structure of input, result, error and other components
 */
export interface ProfileOutput {
  profileId: string;
  usecases: UseCaseStructure[];
}

export type ObjectCollection = Record<string, StructureType | undefined>;
export type ArrayCollection = {
  [P in number]?: Exclude<StructureType, UnionStructure>;
};

export class ProfileValidator implements ProfileVisitor {
  private fields: Record<string, StructureType | undefined> = {};
  private models: Record<string, StructureType | undefined> = {};

  visit(node: ProfileDocumentNode): ProfileOutput;
  visit(node: ProfileNode | ProfileIdNode): string;
  visit(node: UseCaseDefinitionNode): UseCaseStructure;
  visit(node: EnumValueNode): string | number | boolean;
  visit(
    node:
      | NamedModelDefinitionNode
      | NamedFieldDefinitionNode
      | ModelTypeNameNode
      | FieldDefinitionNode
      | NonNullDefinitionNode
  ): StructureType | undefined;
  visit(node: ObjectDefinitionNode): ObjectStructure;
  visit(node: Type): StructureType;
  visit(node: ProfileASTNode | undefined): undefined;
  visit(
    node: ProfileASTNode
  ):
    | undefined
    | StructureType
    | UseCaseStructure
    | UseCaseStructure[]
    | ProfileOutput
    | string
    | number
    | boolean {
    if (!node) {
      return undefined;
    }
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
      case 'UseCaseSlotDefinition':
        return this.visitUseCaseSlotDefinition(node);
      default:
        assertUnreachable(node);
    }
  }

  visitUseCaseSlotDefinition(node: UseCaseSlotDefinitionNode): StructureType {
    if (!node.type) {
      throw new Error('This should not happen!');
    }

    return this.visit(node.type);
  }
  visitEnumDefinitionNode(node: EnumDefinitionNode): StructureType {
    return {
      kind: 'EnumStructure',
      enums: node.values.map(value => this.visit(value)),
    };
  }

  visitEnumValueNode(node: EnumValueNode): string | number | boolean {
    return node.value;
  }

  visitFieldDefinitionNode(
    node: FieldDefinitionNode
  ): StructureType | undefined {
    const required = node.required;

    if (node.type === undefined) {
      return this.fields[node.fieldName]
        ? ({
            required,
            ...this.fields[node.fieldName],
          } as StructureType)
        : ({ required, kind: 'AnyStructure' } as StructureType);
    }

    return {
      required,
      ...this.visit(node.type),
    } as StructureType;
  }

  visitListDefinitionNode(node: ListDefinitionNode): StructureType {
    const value = this.visit(node.elementType);

    if (value?.kind === 'EnumStructure') {
      throw new Error('Something went very wrong, this should not happen!');
    }

    return {
      kind: 'ListStructure',
      value,
    };
  }

  visitModelTypeNameNode(node: ModelTypeNameNode): StructureType | undefined {
    return this.models[node.name];
  }

  visitNamedFieldDefinitionNode(
    node: NamedFieldDefinitionNode
  ): StructureType | undefined {
    const fieldName = node.fieldName;

    this.fields[fieldName] = node.type
      ? this.visit(node.type)
      : { kind: 'AnyStructure' };

    return this.fields[fieldName];
  }

  visitNamedModelDefinitionNode(
    node: NamedModelDefinitionNode
  ): StructureType | undefined {
    const modelName = node.modelName;

    this.models[modelName] = node.type
      ? this.visit(node.type)
      : { kind: 'AnyStructure' };

    return this.models[modelName];
  }

  visitNonNullDefinitionNode(
    node: NonNullDefinitionNode
  ): StructureType | undefined {
    const value = this.visit(node.type);

    if (value?.kind === 'UnionStructure') {
      throw new Error('Something went very wrong, this should not happen!');
    }

    return value
      ? {
          kind: 'NonNullStructure',
          value,
        }
      : undefined;
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

  visitPrimitiveTypeNameNode(node: PrimitiveTypeNameNode): StructureType {
    return {
      kind: 'PrimitiveStructure',
      type: node.name,
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
      .filter(
        (definition): definition is NamedModelDefinitionNode =>
          definition.kind === 'NamedModelDefinition'
      )
      .forEach(model => {
        this.models[model.modelName] = undefined;
        this.visit(model);
      });

    const profileId = this.visit(node.profile);
    const usecases = node.definitions
      .filter(
        (definition): definition is UseCaseDefinitionNode =>
          definition.kind === 'UseCaseDefinition'
      )
      .map(definition => this.visit(definition));

    return {
      profileId,
      usecases,
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
      const structure = this.visit(type);

      if (structure?.kind !== 'UnionStructure') {
        union.types[i] = structure;
      }
    });

    return union;
  }

  visitUseCaseDefinitionNode(node: UseCaseDefinitionNode): UseCaseStructure {
    return {
      useCaseName: node.useCaseName,
      input: this.visit(node.input),
      result: this.visit(node.result),
      error: this.visit(node.error),
    };
  }
}
