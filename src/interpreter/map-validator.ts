import {
  AssignmentNode,
  CallStatementNode,
  HttpCallStatementNode,
  HttpRequestNode,
  HttpResponseHandlerNode,
  InlineCallNode,
  isMapDefinitionNode,
  isOperationDefinitionNode,
  JessieExpressionNode,
  LiteralNode,
  MapASTNode,
  MapDefinitionNode,
  MapDocumentNode,
  MapNode,
  MapProfileIdNode,
  ObjectLiteralNode,
  OperationDefinitionNode,
  OutcomeStatementNode,
  PrimitiveLiteralNode,
  ProviderNode,
  SetStatementNode,
  StatementConditionNode,
} from '@superfaceai/ast';
import { MapVisitor } from '@superfaceai/sdk';
import * as ts from 'typescript';

import { RETURN_CONSTRUCTS } from './constructs';
import {
  ArrayCollection,
  ObjectCollection,
  ObjectStructure,
  ProfileOutput,
  StructureType,
  UnionStructure,
  UseCaseStructure,
} from './profile-validator';
import { compareStructure, getOutcomes, mergeVariables } from './utils';

function assertUnreachable(node: never): never;
function assertUnreachable(node: MapASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

export type ErrorContext = { path?: string[] };
export type ValidationError =
  | {
      kind: 'wrongProfileID';
      context: ErrorContext & { expected: string; actual: string };
    }
  | {
      kind: 'wrongUsecaseName';
      context: ErrorContext & { expected: string; actual: string };
    }
  | {
      kind: 'usecaseNotFound';
      context: ErrorContext & { expectedUseCase: string };
    }
  | {
      kind: 'operationNotFound';
      context: ErrorContext & { expected: string };
    }
  | {
      kind: 'nonNullStructure';
      context: ErrorContext & {
        expected: Exclude<StructureType, UnionStructure>;
        actual: string;
      };
    }
  | {
      kind: 'resultNotDefined';
      context: ErrorContext & { expectedResult: StructureType | undefined };
    }
  | {
      kind: 'errorNotDefined';
      context: ErrorContext & { expectedError: StructureType | undefined };
    }
  | {
      kind: 'wrongObjectStructure';
      context: ErrorContext & {
        expected: ObjectCollection;
        actual: AssignmentNode[];
      };
    }
  | {
      kind: 'wrongArrayStructure';
      context: ErrorContext & {
        expected: ArrayCollection;
        actual: LiteralNode[];
      };
    }
  | {
      kind: 'wrongStructure';
      context: ErrorContext & {
        expected: StructureType;
        actual: LiteralNode | StructureType | string;
      };
    }
  | {
      kind: 'resultNotFound';
      context: ErrorContext & { actualResult: LiteralNode };
    }
  | {
      kind: 'errorNotFound';
      context: ErrorContext & { actualError: LiteralNode };
    }
  | {
      kind: 'wrongInput';
      context: ErrorContext & {
        expected: ObjectStructure;
        actual: string;
      };
    }
  | {
      kind: 'wrongVariableStructure';
      context: ErrorContext & {
        name: string;
        expected: StructureType;
        actual: LiteralNode | string;
      };
    }
  | {
      kind: 'variableNotDefined';
      context: ErrorContext & { name: string };
    }
  | {
      kind: 'missingRequired';
      context: ErrorContext & { field: string };
    }
  | {
      kind: 'mapNotFound';
      context: ErrorContext & { expected: string };
    }
  | {
      kind: 'extraMapsFound';
      context: ErrorContext & {
        expected: string[];
        actual: string[];
      };
    };

export type ValidationWarning =
  | {
      kind: 'wrongProfileID';
      context: ErrorContext & { expected: string; actual: string };
    }
  | {
      kind: 'wrongUsecaseName';
      context: ErrorContext & { expected: string; actual: string };
    }
  | {
      kind: 'usecaseNotFound';
      context: ErrorContext & { expectedUseCase: string };
    }
  | {
      kind: 'operationNotFound';
      context: ErrorContext & { expected: string };
    }
  | {
      kind: 'resultNotDefined';
      context: ErrorContext & { expectedResult: StructureType | undefined };
    }
  | {
      kind: 'errorNotDefined';
      context: ErrorContext & { expectedError: StructureType | undefined };
    }
  | {
      kind: 'wrongObjectStructure';
      context: ErrorContext & {
        expected: ObjectCollection;
        actual: AssignmentNode[];
      };
    }
  | {
      kind: 'wrongArrayStructure';
      context: ErrorContext & {
        expected: ArrayCollection;
        actual: LiteralNode[];
      };
    }
  | {
      kind: 'wrongStructure';
      context: ErrorContext & {
        expected: StructureType;
        actual: LiteralNode | StructureType | string;
      };
    }
  | {
      kind: 'wrongInput';
      context: ErrorContext & {
        expected: ObjectStructure;
        actual: string;
      };
    }
  | {
      kind: 'resultNotFound';
      context: ErrorContext & { actualResult: LiteralNode };
    }
  | {
      kind: 'errorNotFound';
      context: ErrorContext & { actualError: LiteralNode };
    }
  | {
      kind: 'wrongVariableStructure';
      context: ErrorContext & {
        name: string;
        expected: StructureType;
        actual: LiteralNode | string;
      };
    }
  | {
      kind: 'variableNotDefined';
      context: ErrorContext & { name: string };
    }
  | {
      kind: 'resultNotFound';
      context: ErrorContext & { actualResult: LiteralNode };
    }
  | {
      kind: 'extraMapsFound';
      context: ErrorContext & {
        expected: string[];
        actual: string[];
      };
    }
  | {
      kind: 'nonNullStructure';
      context: ErrorContext & {
        expected: Exclude<StructureType, UnionStructure>;
        actual: string;
      };
    }
  | {
      kind: 'missingRequired';
      context: ErrorContext & { field: string };
    }
  | {
      kind: 'mapNotFound';
      context: ErrorContext & { expected: string };
    };

export type ValidationResult =
  | { pass: true; warnings?: ValidationWarning[] }
  | { pass: false; errors: ValidationError[]; warnings?: ValidationWarning[] };

export type ValidationIssue = ValidationError | ValidationWarning;

export type ScopeInfo = 'map' | 'operation' | 'call' | 'httpResponse';

interface Stack {
  type: ScopeInfo;
  variables: Record<string, LiteralNode>;
}

export class MapValidator implements MapVisitor {
  private stack: Stack[] = [];
  private argumentScopedVariables: Record<
    string,
    Record<string, LiteralNode>
  > = {};

  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];
  private operations: Record<string, OperationDefinitionNode> = {};

  private currentUseCase: UseCaseStructure | undefined;
  private currentStructure: StructureType | undefined;
  private inputStructure: ObjectStructure | undefined;

  private callOperationScope: string | undefined;
  private isOutcomeWithCondition = false;

  private dataVariable: Record<string, OutcomeStatementNode[]> = {};
  private errorVariable: Record<string, OutcomeStatementNode[]> = {};

  constructor(
    private readonly mapAst: MapASTNode,
    private readonly profileOutput: ProfileOutput
  ) {}

  validate(): ValidationResult {
    this.visit(this.mapAst);

    return this.errors.length > 0
      ? { pass: false, errors: this.errors, warnings: this.warnings }
      : { pass: true, warnings: this.warnings };
  }

  visit(node: LiteralNode | AssignmentNode): boolean;
  visit(node: MapASTNode): void;
  visit(node: MapASTNode): boolean | void {
    switch (node.kind) {
      case 'MapDocument':
        return this.visitMapDocumentNode(node);
      case 'Map':
        return this.visitMapNode(node);
      case 'Provider':
        return this.visitProviderNode(node);
      case 'ProfileId':
        return this.visitMapProfileIdNode(node);
      case 'OperationDefinition':
        return this.visitOperationDefinitionNode(node);
      case 'MapDefinition':
        return this.visitMapDefinitionNode(node);
      case 'HttpCallStatement':
        return this.visitHttpCallStatementNode(node);
      case 'HttpResponseHandler':
        return this.visitHttpResponseHandlerNode(node);
      case 'HttpRequest':
        return this.visitHttpRequestNode(node);
      case 'CallStatement':
        return this.visitCallStatementNode(node);
      case 'OutcomeStatement':
        return this.visitOutcomeStatementNode(node);
      case 'SetStatement':
        return this.visitSetStatementNode(node);
      case 'StatementCondition':
        return this.visitStatementConditionNode(node);
      case 'Assignment':
        return this.visitAssignmentNode(node);
      case 'InlineCall':
        return this.visitInlineCallNode(node);
      case 'JessieExpression':
        return this.visitJessieExpressionNode(node);
      case 'ObjectLiteral':
        return this.visitObjectLiteralNode(node);
      case 'PrimitiveLiteral':
        return this.visitPrimitiveLiteralNode(node);

      default:
        assertUnreachable(node);
    }
  }

  visitMapDocumentNode(node: MapDocumentNode): void {
    // check the valid ProfileID
    this.visit(node.map);

    // save operations and their outcomes
    node.definitions.forEach(definition => {
      if (isOperationDefinitionNode(definition)) {
        this.operations[definition.name] = definition;
        this.visit(definition);
      }
    });

    // check usecase - map compatibility
    const maps = node.definitions.filter(isMapDefinitionNode);
    const usecases = Array.from(this.profileOutput.usecases);

    for (let i = 0; i < usecases.length; i++) {
      const usecase = usecases.pop();
      if (!usecase) {
        throw new Error('This should not happen!');
      }

      let isFound = false;

      for (let j = maps.length - 1; j >= 0; j--) {
        const map = maps[j];

        if (
          map.kind === 'MapDefinition' &&
          map.usecaseName === usecase.useCaseName
        ) {
          isFound = true;
          this.currentUseCase = usecase;
          this.visit(map);
          maps.splice(j, 1);
          break;
        }
      }

      if (!isFound) {
        this.errors.push({
          kind: 'mapNotFound',
          context: {
            path: this.getPath(node),
            expected: usecase.useCaseName,
          },
        });
      }
    }

    if (maps.length > 0) {
      this.warnings.push({
        kind: 'extraMapsFound',
        context: {
          path: this.getPath(node),
          expected: this.profileOutput.usecases.map(
            usecase => usecase.useCaseName
          ),
          actual: node.definitions
            .filter(isMapDefinitionNode)
            .map(def => def.usecaseName),
        },
      });
    }
  }

  visitMapNode(node: MapNode): void {
    this.visit(node.profileId);
  }

  visitProviderNode(_node: ProviderNode): void {
    throw new Error('Method not implemented.');
  }

  visitMapProfileIdNode(node: MapProfileIdNode): void {
    if (!(node.profileId === this.profileOutput.profileId)) {
      this.errors.push({
        kind: 'wrongProfileID',
        context: {
          path: this.getPath(node),
          expected: this.profileOutput.profileId,
          actual: node.profileId,
        },
      });
    }
  }

  visitOperationDefinitionNode(node: OperationDefinitionNode): void {
    this.dataVariable[node.name] = getOutcomes(node, false);
    this.errorVariable[node.name] = getOutcomes(node, true);

    this.newStack('operation');

    node.statements.forEach(statement => this.visit(statement));

    this.stack.pop();
  }

  visitMapDefinitionNode(node: MapDefinitionNode): void {
    const usecase = this.currentUseCase;

    if (!usecase) {
      throw new Error('Usecase should be defined!');
    }

    if (
      usecase.result?.kind === 'NonNullStructure' &&
      getOutcomes(node, false).length === 0
    ) {
      this.errors.push({
        kind: 'resultNotDefined',
        context: {
          path: this.getPath(node),
          expectedResult: usecase.result,
        },
      });
    }

    if (
      usecase.error?.kind === 'NonNullStructure' &&
      getOutcomes(node, true).length === 0
    ) {
      this.errors.push({
        kind: 'errorNotDefined',
        context: {
          path: this.getPath(node),
          expectedError: usecase.error,
        },
      });
    }

    this.newStack('map');
    this.inputStructure = usecase.input;

    node.statements.forEach(statement => this.visit(statement));

    this.inputStructure = undefined;
    this.stack.pop();
  }

  visitHttpCallStatementNode(node: HttpCallStatementNode): void {
    if (node.request) {
      this.visit(node.request);
    }

    node.responseHandlers.forEach(response => this.visit(response));
  }

  visitHttpResponseHandlerNode(node: HttpResponseHandlerNode): void {
    this.newStack('httpResponse');
    node.statements.forEach(statement => this.visit(statement));
    this.stack.pop();
  }

  visitHttpRequestNode(node: HttpRequestNode): void {
    if (node.query) {
      this.visit(node.query);
    }
    if (node.headers) {
      this.visit(node.headers);
    }
    if (node.body) {
      this.visit(node.body);
    }
  }

  visitCallStatementNode(node: CallStatementNode): void {
    if (!this.operations[node.operationName]) {
      this.errors.push({
        kind: 'operationNotFound',
        context: {
          path: this.getPath(node),
          expected: node.operationName,
        },
      });
    }

    // argument handling
    if (node.arguments.length > 0) {
      this.argumentScopedVariables[node.operationName] = {};
      node.arguments.forEach(argument => {
        if (this.inputStructure) {
          this.visit(argument);
        }
        this.argumentScopedVariables[node.operationName][
          argument.key.join('.')
        ] = argument.value;
      });
    }

    // call statements
    this.newStack('call');
    this.callOperationScope = node.operationName;

    node.statements.forEach(statement => this.visit(statement));

    this.callOperationScope = undefined;
    this.stack.pop();
  }

  visitOutcomeStatementNode(node: OutcomeStatementNode): void {
    if (node.condition) {
      this.isOutcomeWithCondition = true;
      this.visit(node.condition);
    }

    if (node.isError) {
      if (!this.currentUseCase?.error) {
        this.warnings.push({
          kind: 'errorNotFound',
          context: {
            path: this.getPath(node),
            actualError: node.value,
          },
        });
      }
      this.currentStructure = this.currentUseCase?.error;
    } else {
      if (!this.currentUseCase?.result) {
        this.warnings.push({
          kind: 'resultNotFound',
          context: {
            path: this.getPath(node),
            actualResult: node.value,
          },
        });
      }
      this.currentStructure = this.currentUseCase?.result;
    }

    this.visit(node.value);

    this.isOutcomeWithCondition = false;
    this.currentStructure = undefined;
  }

  private constructObject(key: string, field: AssignmentNode): void {
    const object: ObjectLiteralNode = {
      kind: 'ObjectLiteral',
      fields: [],
    };
    let isReassigned = false;

    const variable = this.variables[key];
    if (variable && variable.kind === 'ObjectLiteral') {
      const fieldKey = field.key.join('.');

      variable.fields.forEach(variableField => {
        if (variableField.key.join('.') === fieldKey) {
          isReassigned = true;
          variableField.value = field.value;
        }
      });

      object.fields.push(...variable.fields);
    }

    if (!isReassigned) {
      object.fields.push(field);
    }

    this.addVariableToStack(key, object);
  }

  private cleanUpVariables(key: string): void {
    Object.keys(this.variables).forEach(variableKey => {
      if (
        variableKey.length > key.length &&
        variableKey[key.length] === '.' &&
        variableKey.includes(key)
      ) {
        delete this.stackTop.variables[variableKey];
      }
    });
  }

  visitSetStatementNode(node: SetStatementNode): void {
    node.assignments.forEach(assignment => {
      const value = assignment.value;
      if (this.inputStructure) {
        this.visit(value);
      }

      const variableKey = assignment.key.join('.');
      this.addVariableToStack(variableKey, value);

      if (assignment.key.length > 1) {
        const keys: string[] = [];
        const field: AssignmentNode = {
          kind: 'Assignment',
          key: Array.from(assignment.key),
          value,
        };

        assignment.key.forEach(key => {
          keys.push(key);
          field.key.shift();

          if (field.key.length === 0) {
            return;
          }

          this.constructObject(keys.join('.'), field);
        });
      }

      this.cleanUpVariables(variableKey);
    });
  }

  visitStatementConditionNode(node: StatementConditionNode): void {
    if (this.inputStructure) {
      this.visit(node.expression);
    }
  }

  visitAssignmentNode(node: AssignmentNode): boolean {
    return this.visit(node.value);
  }

  visitInlineCallNode(node: InlineCallNode): boolean {
    if (!this.operations[node.operationName]) {
      this.errors.push({
        kind: 'operationNotFound',
        context: {
          path: this.getPath(node),
          expected: node.operationName,
        },
      });
    }

    if (node.arguments.length > 0) {
      this.argumentScopedVariables[node.operationName] = {};
      node.arguments.forEach(argument => {
        if (this.inputStructure) {
          this.visit(argument);
        }
        this.argumentScopedVariables[node.operationName][
          argument.key.join('.')
        ] = argument.value;
      });
    }

    if (
      !this.currentStructure ||
      this.currentStructure.kind === 'AnyStructure'
    ) {
      return true;
    }

    const outcomeValues = this.dataVariable[node.operationName];

    if (outcomeValues.length === 0) {
      this.errors.push({
        kind: 'resultNotDefined',
        context: {
          path: this.getPath(node),
          expectedResult: this.currentStructure,
        },
      });

      return false;
    }

    return outcomeValues.every(value => this.visit(value.value));
  }

  private validateJessieIDs(
    types: (StructureType | undefined)[],
    variable: LiteralNode
  ): boolean {
    let isValid = false;

    // multiple types such as in UnionStructure
    for (const type of types) {
      if (!type) {
        throw new Error('This should not happen!');
      }
      const previousEndIndex = this.errors.length;
      this.currentStructure = type;

      isValid = isValid || this.visit(variable);

      if (this.errors.length - previousEndIndex > 0) {
        this.errors = this.errors.slice(0, previousEndIndex);
      }

      if (!this.currentStructure) {
        throw new Error('This should not happen!');
      }

      if (!isValid) {
        return false;
      }
    }

    return true;
  }

  visitJessieExpressionNode(node: JessieExpressionNode): boolean {
    const rootNode = ts.createSourceFile(
      'scripts.js',
      `(${node.source ?? node.expression})`,
      ts.ScriptTarget.ES2015,
      true,
      ts.ScriptKind.JS
    );

    const construct = RETURN_CONSTRUCTS[rootNode.kind];

    if (!construct) {
      throw new Error('Rule construct not found!');
    }

    if (
      this.stackTop.type === 'map' &&
      !this.currentStructure &&
      !this.inputStructure
    ) {
      throw new Error('Profile capability structure not found!');
    }

    const constructResult = construct.visit(
      rootNode,
      this.currentStructure,
      this.inputStructure,
      this.isOutcomeWithCondition
    );

    let result = constructResult.pass;

    if (this.currentStructure && constructResult.invalidOutput) {
      this.addIssue({
        kind: 'wrongStructure',
        context: {
          path: this.getPath(node),
          expected: this.currentStructure,
          actual: node.source ?? node.expression,
        },
      });
    }

    if (this.inputStructure && constructResult.invalidInput) {
      this.addIssue({
        kind: 'wrongInput',
        context: {
          path: this.getPath(node),
          expected: this.inputStructure,
          actual: node.source ?? node.expression,
        },
      });
    }

    if (!constructResult.pass) {
      this.errors.push(...constructResult.errors);
    }
    this.warnings.push(...(constructResult.warnings ?? []));

    // validate variables from jessie
    for (const variableName in constructResult.variables) {
      const types = constructResult.variables[variableName];

      if (!this.currentStructure) {
        throw new Error('This should not happen!');
      }

      // if validator is in call scope and jessie contains 'data' variable
      if (this.callOperationScope) {
        let outcomes: OutcomeStatementNode[];
        if (variableName.split('.')[0] === 'data') {
          outcomes = this.dataVariable[this.callOperationScope];
        } else if (variableName.split('.')[0] === 'error') {
          outcomes = this.errorVariable[this.callOperationScope];
        } else {
          continue;
        }

        for (const outcome of outcomes) {
          this.isOutcomeWithCondition = outcome.condition ? true : false;
          result = this.validateJessieIDs(types, outcome.value);

          if (!result) {
            this.addIssue({
              kind: 'wrongVariableStructure',
              context: {
                path: this.getPath(node),
                name: variableName,
                expected: this.currentStructure,
                actual: outcome.value,
              },
            });
          }
        }
      } else {
        const variable = this.variables[variableName];

        if (!variable) {
          result = false;
          this.addIssue({
            kind: 'variableNotDefined',
            context: {
              path: this.getPath(node),
              name: variableName,
            },
          });

          continue;
        }

        result = this.validateJessieIDs(types, variable);

        if (!result) {
          this.addIssue({
            kind: 'wrongVariableStructure',
            context: {
              path: this.getPath(node),
              name: variableName,
              expected: this.currentStructure,
              actual: variable,
            },
          });
        }
      }
    }

    return this.isOutcomeWithCondition ? true : result;
  }

  visitObjectLiteralNode(node: ObjectLiteralNode): boolean {
    if (!this.currentStructure) {
      let result = true;
      if (this.inputStructure) {
        node.fields.forEach(field => {
          const fieldResult = this.visit(field);
          result = result && fieldResult;
        });
      }

      return result;
    }

    if (this.currentStructure.kind === 'AnyStructure') {
      return true;
    }

    const { isValid, structureOfFields } = compareStructure(
      node,
      this.currentStructure
    );

    if (!isValid) {
      this.addIssue({
        kind: 'wrongStructure',
        context: {
          path: this.getPath(node),
          expected: this.currentStructure,
          actual: node,
        },
      });

      return this.isOutcomeWithCondition ? true : false;
    }

    if (!structureOfFields) {
      throw new Error('This should not happen!');
    }

    const fieldValues = Object.values(node.fields);
    const fieldNames = Object.keys(structureOfFields);
    let result = true;
    let index = fieldNames.length;

    while (index--) {
      const key = fieldNames[index];
      const value = structureOfFields[key];
      if (!value) {
        throw new Error(`Value with key: ${key} does not exist!`);
      }

      let isFound = false;
      let nodeIndex = fieldValues.length;

      while (nodeIndex--) {
        const field = fieldValues[nodeIndex];
        const nodeKey = field.key.join('');

        if (nodeKey === key) {
          this.currentStructure = value;
          this.visit(field);

          isFound = true;
          fieldNames.splice(index, 1);
          fieldValues.splice(nodeIndex, 1);
        }
      }

      if (value.required && !isFound) {
        result = false;
        this.addIssue({
          kind: 'missingRequired',
          context: {
            path: this.getPath(node),
            field: value ? value.kind : 'undefined',
          },
        });
      }
    }

    if (fieldValues.length > 0) {
      this.warnings.push({
        kind: 'wrongObjectStructure',
        context: {
          path: this.getPath(node),
          expected: structureOfFields,
          actual: node.fields,
        },
      });
    }

    return this.isOutcomeWithCondition ? true : result;
  }

  visitPrimitiveLiteralNode(node: PrimitiveLiteralNode): boolean {
    if (
      !this.currentStructure ||
      this.currentStructure.kind === 'AnyStructure'
    ) {
      return true;
    }

    const { isValid } = compareStructure(node, this.currentStructure);

    if (!isValid) {
      this.addIssue({
        kind: 'wrongStructure',
        context: {
          path: this.getPath(node),
          expected: this.currentStructure,
          actual: node,
        },
      });
    }

    return this.isOutcomeWithCondition ? true : isValid;
  }

  private getPath(node: MapASTNode): string[] {
    return node.location
      ? [`${node.location.line}:${node.location.column}`, node.kind]
      : [node.kind];
  }

  private addVariableToStack(key: string, value: LiteralNode): void {
    const variable: Record<string, LiteralNode> = {};
    variable[key] = value;

    this.stackTop.variables = mergeVariables(this.stackTop.variables, variable);
  }

  private newStack(type: Stack['type']): void {
    this.stack.push({ type: type, variables: {} });
  }

  private get variables(): Record<string, LiteralNode> {
    let variables: Record<string, LiteralNode> = {};

    for (const stackTop of this.stack) {
      variables = mergeVariables(stackTop.variables, variables);
    }

    return variables;
  }

  private get stackTop(): Stack {
    if (this.stack.length === 0) {
      throw new Error('Trying to get variables out of scope!');
    }

    return this.stack[this.stack.length - 1];
  }

  private addIssue(issue: ValidationIssue): void {
    this.isOutcomeWithCondition
      ? this.warnings.push(issue)
      : this.errors.push(issue);
  }
}
