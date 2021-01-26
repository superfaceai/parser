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
  ProfileHeaderStructure,
  ProfileOutput,
  StructureType,
  UnionStructure,
  UseCaseStructure,
} from './profile-output';
import { isUnionStructure } from './profile-output.utils';

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
  private namedFields: Record<
    string,
    NamedFieldDefinitionNode | undefined
  > = {};

  private namedModels: Record<
    string,
    NamedModelDefinitionNode | undefined
  > = {};

  private fields: Record<string, StructureType> = {};
  private models: Record<string, StructureType> = {};

  visit(node: ProfileDocumentNode): ProfileOutput;
  visit(node: ProfileHeaderNode): ProfileHeaderStructure;
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
    | ProfileHeaderStructure
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
    if (!this.fields[node.fieldName]) {
      this.visit(this.namedFields[node.fieldName]);
    }

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

    return {
      kind: 'ListStructure',
      value,
    };
  }

  visitModelTypeNameNode(node: ModelTypeNameNode): StructureType {
    if (!this.models[node.name]) {
      this.visit(this.namedModels[node.name]);
    }

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
    const fields = node.definitions.filter(isNamedFieldDefinitionNode);
    const models = node.definitions.filter(isNamedModelDefinitionNode);

    this.initializeFields(fields);
    this.initializeModels(models);

    fields.forEach(field => this.visit(field));
    models.forEach(model => this.visit(model));

    const header = this.visit(node.header);
    const usecases = node.definitions
      .filter(isUseCaseDefinitionNode)
      .map(definition => this.visit(definition));

    return addDoc(
      { title: header.title, description: header.description },
      { header, usecases }
    );
  }

  visitProfileHeaderNode(node: ProfileHeaderNode): ProfileHeaderStructure {
    const header: ProfileHeaderStructure = {
      name: node.name,
      version: node.version,
    };

    if (node.scope) {
      header.scope = node.scope;
    }

    return addDoc(node, header);
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

  /**
   * store the named fields for later reference
   */
  private initializeFields(fields: NamedFieldDefinitionNode[]): void {
    for (const field of fields) {
      this.namedFields[field.fieldName] = field;
    }
  }

  /**
   * store the named models for later reference
   */
  private initializeModels(models: NamedModelDefinitionNode[]): void {
    for (const model of models) {
      this.namedModels[model.modelName] = model;
    }
  }
}
