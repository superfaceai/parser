import {
  EnumDefinitionNode,
  EnumValueNode,
  FieldDefinitionNode,
  isNamedFieldDefinitionNode,
  isNamedModelDefinitionNode,
  isUseCaseDefinitionNode,
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

import {
  ObjectStructure,
  ProfileOutput,
  StructureType,
  UnionStructure,
  UseCaseStructure,
} from './profile-output';
import { isEnumStructure, isUnionStructure } from './profile-output.utils';

function assertUnreachable(node: never): never;
function assertUnreachable(node: ProfileASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

export class ProfileValidator implements ProfileVisitor {
  private fields: Record<string, StructureType> = {};
  private models: Record<string, StructureType> = {};

  visit(node: ProfileDocumentNode): ProfileOutput;
  visit(node: ProfileNode | ProfileIdNode): string;
  visit(node: UseCaseDefinitionNode): UseCaseStructure;
  visit(node: EnumValueNode): string | number | boolean;
  visit(node: NamedModelDefinitionNode | NamedFieldDefinitionNode): void;
  visit(node: ObjectDefinitionNode): ObjectStructure;
  visit(node: Type): StructureType;
  visit(node: ProfileASTNode | undefined): undefined;
  visit(
    node: ProfileASTNode
  ):
    | StructureType
    | UseCaseStructure
    | UseCaseStructure[]
    | ProfileOutput
    | void
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

  visitFieldDefinitionNode(node: FieldDefinitionNode): StructureType {
    const required = node.required;
    const field = this.fields[node.fieldName] ?? { kind: 'ScalarStructure' };
    const result = node.type ? this.visit(node.type) : { required, ...field };

    return {
      required,
      ...result,
    };
  }

  visitListDefinitionNode(node: ListDefinitionNode): StructureType {
    const value = this.visit(node.elementType);

    if (isEnumStructure(value)) {
      throw new Error('Something went very wrong, this should not happen!');
    }

    return {
      kind: 'ListStructure',
      value,
    };
  }

  visitModelTypeNameNode(node: ModelTypeNameNode): StructureType {
    return this.models[node.name] ?? { kind: 'ScalarStructure' };
  }

  visitNamedFieldDefinitionNode(node: NamedFieldDefinitionNode): void {
    this.fields[node.fieldName] = node.type
      ? this.visit(node.type)
      : { kind: 'ScalarStructure' };
  }

  visitNamedModelDefinitionNode(node: NamedModelDefinitionNode): void {
    this.models[node.modelName] = node.type
      ? this.visit(node.type)
      : { kind: 'ScalarStructure' };
  }

  visitNonNullDefinitionNode(node: NonNullDefinitionNode): StructureType {
    const value = this.visit(node.type);

    if (isUnionStructure(value)) {
      throw new Error('Something went very wrong, this should not happen!');
    }

    return {
      kind: 'NonNullStructure',
      value,
    };
  }

  visitObjectDefinitionNode(node: ObjectDefinitionNode): StructureType {
    return node.fields.reduce<ObjectStructure>(
      (obj, field) => {
        obj.fields = { ...obj.fields };
        obj.fields[field.fieldName] = this.visit(field) ?? {
          kind: 'ScalarStructure',
        };

        return obj;
      },
      { kind: 'ObjectStructure' }
    );
  }

  visitPrimitiveTypeNameNode(node: PrimitiveTypeNameNode): StructureType {
    return {
      kind: 'PrimitiveStructure',
      type: node.name,
    };
  }

  visitProfileDocumentNode(node: ProfileDocumentNode): ProfileOutput {
    node.definitions
      .filter(isNamedFieldDefinitionNode)
      .forEach(field => this.visit(field));

    node.definitions
      .filter(isNamedModelDefinitionNode)
      .forEach(model => this.visit(model));

    const profileId = this.visit(node.profile);
    const usecases = node.definitions
      .filter(isUseCaseDefinitionNode)
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

      if (!isUnionStructure(structure)) {
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
