import {
  ComlinkAssignmentNode,
  ComlinkListLiteralNode,
  ComlinkLiteralNode,
  ComlinkObjectLiteralNode,
  ComlinkPrimitiveLiteralNode,
  EnumDefinitionNode,
  EnumValueNode,
  FieldDefinitionNode,
  isUseCaseDefinitionNode,
  ListDefinitionNode,
  ModelTypeNameNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  NonNullDefinitionNode,
  ObjectDefinitionNode,
  PrimitiveTypeNameNode,
  ProfileASTNode,
  ProfileAstVisitor,
  ProfileDocumentNode,
  ProfileHeaderNode,
  UnionDefinitionNode,
  UseCaseDefinitionNode,
  UseCaseExampleNode,
  UseCaseSlotDefinitionNode,
} from '@superfaceai/ast';
import createDebug from 'debug';

import {
  assertDefinedStructure,
  compareStructure,
  isNonNullStructure,
  isScalarStructure,
  IssueLocation,
  ProfileIOAnalyzer,
  ProfileOutput,
  StructureType,
  ValidationIssue,
  ValidationIssueSlot,
  ValidationResult,
} from '.';

const debug = createDebug('superface-parser:example-validator');

function assertUnreachable(node: never): never;
function assertUnreachable(node: ProfileASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

export class ExamplesValidator implements ProfileAstVisitor {
  private errors: ValidationIssue[] = [];
  private warnings: ValidationIssue[] = [];

  private slotType: ValidationIssueSlot | undefined;
  private currentStructure: StructureType | undefined;
  private currentUseCase: string | undefined;

  constructor(
    private readonly profileAst: ProfileASTNode,
    private profileOutput?: ProfileOutput
  ) {
    if (!profileOutput) {
      const profileIOAnalyzer = new ProfileIOAnalyzer();

      this.profileOutput = profileIOAnalyzer.visit(profileAst);
    }
  }

  validate(): ValidationResult {
    this.visit(this.profileAst);

    return this.errors.length > 0
      ? { pass: false, errors: this.errors, warnings: this.warnings }
      : { pass: true, warnings: this.warnings };
  }

  visit(node: ComlinkLiteralNode | ComlinkAssignmentNode): boolean;
  visit(node: ProfileASTNode): void;
  visit(node: ProfileASTNode): boolean | void {
    debug('Visiting node:', node.kind);

    switch (node.kind) {
      case 'ProfileDocument':
        return this.visitProfileDocumentNode(node);
      case 'ProfileHeader':
        return this.visitProfileHeaderNode(node);
      case 'UseCaseDefinition':
        return this.visitUseCaseDefinitionNode(node);
      case 'UseCaseSlotDefinition':
        return this.visitUseCaseSlotDefinition(node);
      case 'UseCaseExample':
        return this.visitUseCaseExampleNode(node);
      case 'ComlinkPrimitiveLiteral':
        return this.visitComlinkPrimitiveLiteralNode(node);
      case 'ComlinkListLiteral':
        return this.visitComlinkListLiteralNode(node);
      case 'ComlinkObjectLiteral':
        return this.visitComlinkObjectLiteralNode(node);
      case 'ComlinkAssignment':
        return this.visitComlinkAssignmentNode(node);
      // UNUSED
      case 'FieldDefinition':
        return this.visitFieldDefinitionNode(node);
      case 'ModelTypeName':
        return this.visitModelTypeNameNode(node);
      case 'NamedFieldDefinition':
        return this.visitNamedFieldDefinitionNode(node);
      case 'NamedModelDefinition':
        return this.visitNamedModelDefinitionNode(node);
      case 'NonNullDefinition':
        return this.visitNonNullDefinitionNode(node);
      case 'UnionDefinition':
        return this.visitUnionDefinitionNode(node);
      case 'ObjectDefinition':
        return this.visitObjectDefinitionNode(node);
      case 'ListDefinition':
        return this.visitListDefinitionNode(node);
      case 'EnumDefinition':
        return this.visitEnumDefinitionNode(node);
      case 'EnumValue':
        return this.visitEnumValueNode(node);
      case 'PrimitiveTypeName':
        return this.visitPrimitiveTypeNameNode(node);
      default:
        assertUnreachable(node);
    }
  }

  visitProfileDocumentNode(node: ProfileDocumentNode): void {
    const useCases = node.definitions.filter(isUseCaseDefinitionNode);

    for (const useCase of useCases) {
      this.visit(useCase);
    }
  }

  visitProfileHeaderNode(_node: ProfileHeaderNode): void {
    throw new Error('not implemented');
  }

  visitUseCaseDefinitionNode(node: UseCaseDefinitionNode): void {
    this.currentUseCase = node.useCaseName;

    if (node.examples) {
      for (const example of node.examples) {
        this.visit(example.value);
      }
    }

    this.currentUseCase = undefined;
  }

  visitUseCaseSlotDefinition(
    node: UseCaseSlotDefinitionNode<ProfileASTNode>
  ): void {
    this.visit(node.value);
  }

  visitUseCaseExampleNode(node: UseCaseExampleNode): void {
    const usecase = this.profileOutput?.usecases.find(
      usecase => usecase.useCaseName === this.currentUseCase
    );

    if (node.input) {
      this.currentStructure = usecase?.input;
      this.slotType = ValidationIssueSlot.INPUT;

      this.visit(node.input);

      this.slotType = undefined;
      this.currentStructure = undefined;
    }

    if (node.result) {
      this.currentStructure = usecase?.result;
      this.slotType = ValidationIssueSlot.RESULT;

      this.visit(node.result);

      this.slotType = undefined;
      this.currentStructure = undefined;
    }

    if (node.asyncResult) {
      this.currentStructure = usecase?.async;
      this.slotType = ValidationIssueSlot.ASYNCRESULT;

      this.visit(node.asyncResult);

      this.slotType = undefined;
      this.currentStructure = undefined;
    }

    if (node.error) {
      this.currentStructure = usecase?.error;
      this.slotType = ValidationIssueSlot.ERROR;

      this.visit(node.error);

      this.slotType = undefined;
      this.currentStructure = undefined;
    }
  }

  visitComlinkPrimitiveLiteralNode(node: ComlinkPrimitiveLiteralNode): boolean {
    if (this.structureIsPrepared(node)) {
      return true;
    }

    assertDefinedStructure(this.currentStructure);

    const { isValid } = compareStructure(node, this.currentStructure);

    if (!isValid) {
      this.errors.push({
        kind: 'wrongStructure',
        context: {
          path: this.getPath(node),
          expected: this.currentStructure,
          actual: node,
        },
      });
    }

    return isValid;
  }

  visitComlinkListLiteralNode(node: ComlinkListLiteralNode): boolean {
    if (this.structureIsPrepared(node)) {
      return true;
    }

    assertDefinedStructure(this.currentStructure);

    const { listType, isValid } = compareStructure(node, this.currentStructure);

    if (!isValid) {
      this.errors.push({
        kind: 'wrongStructure',
        context: {
          path: this.getPath(node),
          expected: this.currentStructure,
          actual: node,
        },
      });

      return false;
    }

    if (!listType) {
      throw new Error('Validated types in list structure are not defined');
    }

    const originalStructure = this.currentStructure;

    let result = true;
    for (const item of node.items) {
      this.currentStructure = listType;
      result &&= this.visit(item);
    }

    this.currentStructure = originalStructure;

    return result;
  }

  visitComlinkObjectLiteralNode(node: ComlinkObjectLiteralNode): boolean {
    if (this.structureIsPrepared(node)) {
      return true;
    }

    assertDefinedStructure(this.currentStructure);

    const { structureOfFields, isValid } = compareStructure(
      node,
      this.currentStructure
    );

    if (!isValid) {
      this.errors.push({
        kind: 'wrongStructure',
        context: {
          path: this.getPath(node),
          expected: this.currentStructure,
          actual: node,
        },
      });

      return false;
    }

    if (!structureOfFields) {
      throw new Error('Validated object structure does not exist');
    }

    // all fields
    const profileFields = Object.entries(structureOfFields);
    const profileFieldNames = Object.keys(structureOfFields);
    const mapFieldNames = node.fields.map(field => field.key[0]);

    // required fields
    const requiredFields = profileFields.filter(([, value]) => value.required);
    const requiredFieldsNotFound = requiredFields.filter(
      ([key]) => !mapFieldNames.includes(key)
    );

    // fields found inside node
    const matchingFields = node.fields.filter(field =>
      profileFieldNames.includes(field.key[0])
    );
    const extraFields = node.fields.filter(
      field => !profileFieldNames.includes(field.key[0])
    );

    let result = true;
    for (const field of matchingFields) {
      let visitResult = true;
      this.currentStructure = structureOfFields[field.key[0]];

      // it should not validate against final value when dot.notation is used
      if (field.key.length > 1) {
        const [head, ...tail] = field.key;
        const assignment: ComlinkAssignmentNode = {
          kind: 'ComlinkAssignment',
          key: [head],
          value: {
            kind: 'ComlinkObjectLiteral',
            fields: [
              {
                kind: 'ComlinkAssignment',
                key: tail,
                value: field.value,
              },
            ],
          },
        };
        visitResult = this.visit(assignment);
      } else {
        visitResult = this.visit(field);
      }

      result &&= visitResult;
    }

    for (const [, value] of requiredFieldsNotFound) {
      result = false;
      this.errors.push({
        kind: 'missingRequired',
        context: {
          path: this.getPath(node),
          field: value ? value.kind : 'undefined',
        },
      });
    }

    if (extraFields.length > 0) {
      this.warnings.push({
        kind: 'wrongObjectStructure',
        context: {
          path: this.getPath(node),
          expected: structureOfFields,
          actual: node.fields,
        },
      });
    }

    return result;
  }

  visitComlinkAssignmentNode(node: ComlinkAssignmentNode): boolean {
    return this.visit(node.value);
  }

  visitFieldDefinitionNode(_node: FieldDefinitionNode): void {
    throw new Error('not implemented');
  }

  visitModelTypeNameNode(_node: ModelTypeNameNode): void {
    throw new Error('not implemented');
  }

  visitNamedFieldDefinitionNode(_node: NamedFieldDefinitionNode): void {
    throw new Error('not implemented');
  }

  visitNamedModelDefinitionNode(_node: NamedModelDefinitionNode): void {
    throw new Error('not implemented');
  }

  visitNonNullDefinitionNode(_node: NonNullDefinitionNode): void {
    throw new Error('not implemented');
  }

  visitUnionDefinitionNode(_node: UnionDefinitionNode): void {
    throw new Error('not implemented');
  }

  visitObjectDefinitionNode(_node: ObjectDefinitionNode): void {
    throw new Error('not implemented');
  }

  visitListDefinitionNode(_node: ListDefinitionNode): void {
    throw new Error('not implemented');
  }

  visitEnumDefinitionNode(_node: EnumDefinitionNode): void {
    throw new Error('not implemented');
  }

  visitEnumValueNode(_node: EnumValueNode): void {
    throw new Error('not implemented');
  }

  visitPrimitiveTypeNameNode(_node: PrimitiveTypeNameNode): void {
    throw new Error('not implemented');
  }

  private structureIsPrepared(node: ComlinkLiteralNode): boolean {
    if (!this.slotType) {
      throw new Error('No slot type defined');
    }

    if (!this.currentStructure) {
      this.warnings.push({
        kind: 'useCaseSlotNotFound',
        context: {
          path: this.getPath(node),
          slot: this.slotType,
          actual: node,
        },
      });

      return true;
    }

    if (isNonNullStructure(this.currentStructure)) {
      this.currentStructure = this.currentStructure.value;
    }

    if (isScalarStructure(this.currentStructure)) {
      return true;
    }

    return false;
  }

  private getPath(node: ProfileASTNode): IssueLocation {
    return {
      kind: node.kind,
      location: node.location,
    };
  }
}
