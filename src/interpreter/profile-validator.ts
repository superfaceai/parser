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
} from '@superindustries/language';
import { ProfileVisitor } from '@superindustries/superface';

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
 * @interface ProfileOutput - represent profile output for next validation
 */
export interface ProfileOutput {
  profileId: string;
  usecase?: UseCaseStructure;
}

export class ProfileValidator implements ProfileVisitor {
  private fields: Record<string, StructureType | undefined> = {};
  private models: Record<string, StructureType | undefined> = {};

  visit(node: ProfileDocumentNode): ProfileOutput;
  visit(node: ProfileNode | ProfileIdNode): string;
  visit(node: UseCaseDefinitionNode): UseCaseStructure;
  visit(
    node:
      | NamedModelDefinitionNode
      | NamedFieldDefinitionNode
      | ModelTypeNameNode
      | FieldDefinitionNode
  ): StructureType | undefined;
  visit(node: ObjectDefinitionNode): ObjectStructure;
  visit(node: Type): StructureType;
  visit(node: ProfileASTNode | undefined): undefined;
  visit(
    node: ProfileASTNode
  ): undefined | StructureType | UseCaseStructure | ProfileOutput | string {
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

      default:
        assertUnreachable(node);
    }
  }

  visitEnumDefinitionNode(_node: EnumDefinitionNode): StructureType {
    return {
      kind: 'EnumStructure',
    };
  }

  visitEnumValueNode(_node: EnumValueNode): never {
    throw new Error('Method not implemented.');
  }

  visitFieldDefinitionNode(
    node: FieldDefinitionNode
  ): StructureType | undefined {
    if (node.type === undefined) {
      return this.fields[node.fieldName];
    }

    return this.visit(node.type);
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

    if (node.type !== undefined) {
      this.fields[fieldName] = this.visit(node.type);

      return this.fields[fieldName];
    }

    return undefined;
  }

  visitNamedModelDefinitionNode(
    node: NamedModelDefinitionNode
  ): StructureType | undefined {
    const modelName = node.modelName;

    if (node.type !== undefined) {
      this.models[modelName] = this.visit(node.type);

      return this.models[modelName];
    }

    return undefined;
  }

  visitNonNullDefinitionNode(node: NonNullDefinitionNode): StructureType {
    const value = this.visit(node.type);

    if (value?.kind === 'UnionStructure') {
      throw new Error('Something went very wrong, this should not happen!');
    }

    return {
      kind: 'NonNullStructure',
      required: true,
      value,
    };
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
      .filter(
        (definition): definition is NamedModelDefinitionNode =>
          definition.kind === 'NamedModelDefinition'
      )
      .forEach(model => {
        this.models[model.modelName] = undefined;
        this.visit(model);
      });

    const profileId = this.visit(node.profile);
    const usecase = this.visit(
      node.definitions.find(
        (definition): definition is UseCaseDefinitionNode =>
          definition.kind === 'UseCaseDefinition'
      )
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
    };
  }
}
