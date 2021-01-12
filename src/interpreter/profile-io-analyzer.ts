import {
  DocumentedNode,
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
  ProfileHeaderNode,
  Type,
  UnionDefinitionNode,
  UseCaseDefinitionNode,
  UseCaseSlotDefinitionNode,
} from '@superfaceai/ast';
import { ProfileVisitor } from '@superfaceai/sdk';
import createDebug from 'debug';

import {
  DocumentedStructure,
  ObjectStructure,
  ProfileOutput,
  StructureType,
  UnionStructure,
  UseCaseStructure,
} from './profile-output';
import { isEnumStructure, isUnionStructure } from './profile-output.utils';

const debug = createDebug('superface-parser:profile-io-analyzer');

function addDoc<T>(
  node: DocumentedNode,
  structure: T
): T & DocumentedStructure {
  const result: T & DocumentedStructure = { ...structure };
  if (node.description !== undefined) {
    result.description = node.description;
  }
  if (node.title !== undefined) {
    result.title = node.title;
  }

  return result;
}

function assertUnreachable(node: never): never;
function assertUnreachable(node: ProfileASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

export class ProfileIOAnalyzer implements ProfileVisitor {
  private fields: Record<string, StructureType> = {};
  private models: Record<string, StructureType> = {};

  visit(node: ProfileDocumentNode): ProfileOutput;
  visit(node: ProfileHeaderNode): { profileId: string } & DocumentedStructure;
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
    | ({ profileId: string } & DocumentedStructure)
    | void
    | string
    | number
    | boolean {
    if (!node) {
      return undefined;
    }

    debug('Visiting node: ' + node.kind);

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
      case 'ProfileHeader':
        return this.visitProfileHeaderNode(node);
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

    return addDoc(node, this.visit(node.type));
  }

  visitEnumDefinitionNode(node: EnumDefinitionNode): StructureType {
    return {
      kind: 'EnumStructure',
      enums: node.values.map(value =>
        addDoc(value, { value: this.visit(value) })
      ),
    };
  }

  visitEnumValueNode(node: EnumValueNode): string | number | boolean {
    return node.value;
  }

  visitFieldDefinitionNode(node: FieldDefinitionNode): StructureType {
    const required = node.required;
    const field = this.fields[node.fieldName] ?? { kind: 'ScalarStructure' };
    const result = node.type ? this.visit(node.type) : { required, ...field };

    return addDoc(node, {
      required,
      ...result,
    });
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
    this.fields[node.fieldName] = addDoc(
      node,
      node.type ? this.visit(node.type) : { kind: 'ScalarStructure' }
    );
  }

  visitNamedModelDefinitionNode(node: NamedModelDefinitionNode): void {
    this.models[node.modelName] = addDoc(
      node,
      node.type ? this.visit(node.type) : { kind: 'ScalarStructure' }
    );
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

    const { profileId, title, description } = this.visit(node.header);
    const usecases = node.definitions
      .filter(isUseCaseDefinitionNode)
      .map(definition => this.visit(definition));

    return addDoc({ title, description }, { profileId, usecases });
  }

  visitProfileHeaderNode(
    node: ProfileHeaderNode
  ): { profileId: string; title?: string; description?: string } {
    return addDoc(node, {
      profileId: node.name,
    });
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
    return addDoc(node, {
      useCaseName: node.useCaseName,
      input: this.visit(node.input),
      result: this.visit(node.result),
      error: this.visit(node.error),
    });
  }
}
