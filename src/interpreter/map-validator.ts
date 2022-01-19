import {
  AssignmentNode,
  CallStatementNode,
  ConditionAtomNode,
  HttpCallStatementNode,
  HttpRequestNode,
  HttpResponseHandlerNode,
  InlineCallNode,
  isInlineCallNode,
  isMapDefinitionNode,
  isObjectLiteralNode,
  isOperationDefinitionNode,
  IterationAtomNode,
  JessieExpressionNode,
  LiteralNode,
  MapASTNode,
  MapAstVisitor,
  MapDefinitionNode,
  MapDocumentNode,
  MapHeaderNode,
  ObjectLiteralNode,
  OperationDefinitionNode,
  OutcomeStatementNode,
  PrimitiveLiteralNode,
  SetStatementNode,
} from '@superfaceai/ast';
import createDebug from 'debug';
import * as ts from 'typescript';

import { buildAssignment, IssueLocation, UseCaseSlotType } from '.';
import { RETURN_CONSTRUCTS } from './constructs';
import { ValidationIssue } from './issue';
import {
  ObjectStructure,
  ProfileOutput,
  StructureType,
  UseCaseStructure,
} from './profile-output';
import { isNonNullStructure, isScalarStructure } from './profile-output.utils';
import {
  compareStructure,
  findTypescriptIdentifier,
  getOutcomes,
  getVariableName,
  mergeVariables,
} from './utils';

const debug = createDebug('superface-parser:map-validator');

function assertUnreachable(node: never): never;
function assertUnreachable(node: MapASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

export type ValidationResult =
  | { pass: true; warnings?: ValidationIssue[] }
  | { pass: false; errors: ValidationIssue[]; warnings?: ValidationIssue[] };

export type ScopeInfo = 'map' | 'call' | 'httpResponse';

interface Stack {
  type: ScopeInfo;
  name: string;
  variables: Record<string, LiteralNode>;
}

export class MapValidator implements MapAstVisitor {
  private stack: Stack[] = [];

  private errors: ValidationIssue[] = [];
  private warnings: ValidationIssue[] = [];
  private operations: Record<string, OperationDefinitionNode> = {};

  private currentUseCase: UseCaseStructure | undefined;
  private currentStructure: StructureType | undefined;
  private inputStructure: ObjectStructure | undefined;

  private isOutcomeWithCondition = false;

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
    debug('Visiting node: ' + node.kind);

    switch (node.kind) {
      case 'MapDocument':
        return this.visitMapDocumentNode(node);
      case 'MapHeader':
        return this.visitMapHeaderNode(node);
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
      case 'ConditionAtom':
        return this.visitConditionAtomNode(node);
      case 'IterationAtom':
        return this.visitIterationAtomNode(node);
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
    this.visit(node.header);

    // store operations
    node.definitions.forEach(definition => {
      if (isOperationDefinitionNode(definition)) {
        this.operations[definition.name] = definition;
      }
    });

    // all usecases & maps
    const maps = node.definitions.filter(isMapDefinitionNode);
    const mapNames = maps.map(map => map.name);
    const usecaseNames = this.profileOutput.usecases.map(
      usecase => usecase.useCaseName
    );

    // found usecases
    const validMaps = maps.filter(map => usecaseNames.includes(map.name));

    // not found usecases
    const extraMaps = mapNames.filter(name => !usecaseNames.includes(name));
    const notFoundMaps = usecaseNames.filter(
      usecase => !mapNames.includes(usecase)
    );

    for (const map of notFoundMaps) {
      this.errors.push({
        kind: 'mapNotFound',
        context: {
          path: this.getPath(node),
          expected: map,
        },
      });
    }

    if (extraMaps.length > 0) {
      this.warnings.push({
        kind: 'extraMapsFound',
        context: {
          path: this.getPath(node),
          expected: usecaseNames,
          actual: mapNames,
        },
      });
    }

    for (const map of validMaps) {
      this.currentUseCase = this.profileOutput.usecases.find(
        usecase => usecase.useCaseName === map.name
      );
      this.visit(map);
    }
  }

  visitMapHeaderNode(node: MapHeaderNode): void {
    const { scope, name, version: profileVersion } = this.profileOutput.header;

    if (
      (scope && scope !== node.profile.scope) ||
      (!scope && node.profile.scope)
    ) {
      this.errors.push({
        kind: 'wrongScope',
        context: {
          path: this.getPath(node),
          expected: scope,
          actual: node.profile.scope,
        },
      });
    }

    if (node.profile.name !== name) {
      this.errors.push({
        kind: 'wrongProfileName',
        context: {
          path: this.getPath(node),
          expected: name,
          actual: node.profile.name,
        },
      });
    }

    // map should be compatible with every patch version of a profile, therefore it should ignore patch version
    const mapVersion = node.profile.version;
    if (
      mapVersion.major !== profileVersion.major ||
      mapVersion.minor !== profileVersion.minor
    ) {
      this.errors.push({
        kind: 'wrongProfileVersion',
        context: {
          path: this.getPath(node),
          expected: profileVersion,
          actual: mapVersion,
        },
      });
    }
  }

  visitOperationDefinitionNode(_node: OperationDefinitionNode): never {
    throw new Error('Method not implemented.');
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
        kind: 'outcomeNotDefined',
        context: {
          path: this.getPath(node),
          slot: UseCaseSlotType.RESULT,
          expected: usecase.result,
        },
      });
    }

    if (
      usecase.error?.kind === 'NonNullStructure' &&
      getOutcomes(node, true).length === 0
    ) {
      this.errors.push({
        kind: 'outcomeNotDefined',
        context: {
          path: this.getPath(node),
          slot: UseCaseSlotType.ERROR,
          expected: usecase.error,
        },
      });
    }

    this.newStack('map', node.name);
    this.inputStructure = usecase.input;

    node.statements.forEach(statement => this.visit(statement));

    this.inputStructure = undefined;
    this.stack.pop();
  }

  visitHttpCallStatementNode(node: HttpCallStatementNode): void {
    const variableExpressions = node.url
      .match(/{([_A-Za-z][_0-9A-Za-z]*[.]?)*[_0-9A-Za-z]}/g)
      ?.map(expression => expression.slice(1, -1));

    if (variableExpressions) {
      for (const expression of variableExpressions) {
        this.visit({
          kind: 'JessieExpression',
          expression,
          location: node.location,
        });
      }
    }

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
    if (node.arguments.length > 0) {
      node.arguments.forEach(argument => this.visit(argument));
    }

    this.newStack('call', node.operationName);

    node.statements.forEach(statement => this.visit(statement));

    this.stack.pop();
  }

  visitOutcomeStatementNode(node: OutcomeStatementNode): void {
    if (node.condition) {
      this.visit(node.condition);
      this.isOutcomeWithCondition = true;
    }

    if (node.isError) {
      if (!this.currentUseCase?.error) {
        this.warnings.push({
          kind: 'useCaseSlotNotFound',
          context: {
            path: this.getPath(node),
            expected: UseCaseSlotType.ERROR,
            actual: node.value,
          },
        });
      }
      this.currentStructure = this.currentUseCase?.error;
    } else {
      if (!this.currentUseCase?.result) {
        this.warnings.push({
          kind: 'useCaseSlotNotFound',
          context: {
            path: this.getPath(node),
            expected: UseCaseSlotType.RESULT,
            actual: node.value,
          },
        });
      }
      this.currentStructure = this.currentUseCase?.result;
    }

    this.visit(node.value);

    this.isOutcomeWithCondition = false;
    this.currentStructure = undefined;
  }

  visitSetStatementNode(node: SetStatementNode): void {
    node.assignments.forEach(assignment => {
      // Init new variables if object used in dot notation wasn't defined before
      if (assignment.key.length > 1) {
        const keys = [];
        for (let i = 0; i < assignment.key.length - 1; i++) {
          const item = assignment.key[i];

          keys.push(item);

          if (this.variables[keys.join('.')] === undefined) {
            this.addVariableToStack(
              buildAssignment(keys, {
                kind: 'ObjectLiteral',
                fields: [],
                location: assignment.location,
              }),
              true
            );
          }
        }
      }

      this.visit(assignment.value);

      if (!isInlineCallNode(assignment.value)) {
        this.addVariableToStack(assignment, false);
      }
    });
  }

  visitConditionAtomNode(node: ConditionAtomNode): void {
    this.visit(node.expression);
  }

  visitIterationAtomNode(node: IterationAtomNode): void {
    this.visit(node.iterable);
  }

  visitAssignmentNode(node: AssignmentNode): boolean {
    return this.visit(node.value);
  }

  visitInlineCallNode(node: InlineCallNode): boolean {
    if (node.arguments.length > 0) {
      const originalStructure = this.currentStructure;

      // set current structure to undefined to validate only input
      this.currentStructure = undefined;

      node.arguments.forEach(argument => this.visit(argument));

      this.currentStructure = originalStructure;
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

    const constructResult = construct.visit(
      rootNode,
      node.location,
      this.currentStructure,
      this.inputStructure,
      this.isOutcomeWithCondition
    );

    let result = constructResult.pass;

    if (!constructResult.pass) {
      this.errors.push(...constructResult.errors);
    }
    this.warnings.push(...(constructResult.warnings ?? []));

    // validate variables from jessie
    for (const { jessieNode, type } of constructResult.variables ?? []) {
      if (
        this.stackTop.type === 'httpResponse' &&
        findTypescriptIdentifier('body', jessieNode)
      ) {
        continue;
      }

      if (
        this.stackTop.type === 'call' &&
        (findTypescriptIdentifier('data', jessieNode) ||
          findTypescriptIdentifier('error', jessieNode))
      ) {
        continue;
      }

      const variableName = getVariableName(jessieNode);
      const variable = this.variables[variableName];

      if (variable !== undefined) {
        this.currentStructure = type;

        result = this.visit(variable);

        if (!result) {
          this.addIssue({
            kind: 'wrongVariableStructure',
            context: {
              path: this.getPath(node),
              name: variableName,
              expected: type,
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
      node.fields.forEach(field => {
        const fieldResult = this.visit(field);
        result &&= fieldResult;
      });

      return result;
    }

    if (isNonNullStructure(this.currentStructure)) {
      this.currentStructure = this.currentStructure.value;
    }

    if (isScalarStructure(this.currentStructure)) {
      return true;
    }

    const { objectStructure, isValid } = compareStructure(
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

    if (!objectStructure || !objectStructure.fields) {
      throw new Error(
        'Validated object structure is not defined or does not contain fields'
      );
    }

    // all fields
    const profileFields = Object.entries(objectStructure.fields);
    const profileFieldNames = Object.keys(objectStructure.fields);
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
      this.currentStructure = objectStructure.fields[field.key[0]];

      // it should not validate against final value when dot.notation is used
      if (field.key.length > 1) {
        const [, ...tail] = field.key;

        const objectLiteral: ObjectLiteralNode = {
          kind: 'ObjectLiteral',
          fields: [buildAssignment(tail, field.value)],
        };
        visitResult = this.visit(objectLiteral);
      } else {
        visitResult = this.visit(field);
      }

      result &&= visitResult;
    }

    for (const [, value] of requiredFieldsNotFound) {
      result = false;
      this.addIssue({
        kind: 'missingRequired',
        context: {
          path: this.getPath(node),
          expected: value ? value.kind : 'undefined',
        },
      });
    }

    if (extraFields.length > 0) {
      this.warnings.push({
        kind: 'wrongObjectStructure',
        context: {
          path: this.getPath(node),
          expected: objectStructure,
          actual: node,
        },
      });
    }

    return this.isOutcomeWithCondition ? true : result;
  }

  visitPrimitiveLiteralNode(node: PrimitiveLiteralNode): boolean {
    if (!this.currentStructure) {
      return true;
    }

    if (isNonNullStructure(this.currentStructure)) {
      this.currentStructure = this.currentStructure.value;
    }

    if (isScalarStructure(this.currentStructure)) {
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

  private getPath(node: MapASTNode): IssueLocation {
    return {
      kind: node.kind,
      location: node.location,
    };
  }

  /**
   * Handles storing variables with dot notation. If there is assignment with
   * multiple keys, there should be an object containing referenced or other field.
   * This function handles adding fields to object variable stored in validator for
   * later validation of this object.
   */
  private handleVariable(assignment: AssignmentNode): void {
    if (assignment.key.length > 1) {
      const keys: string[] = [];
      const tmpKeys = Array.from(assignment.key);

      for (const assignmentKey of assignment.key) {
        keys.push(assignmentKey);

        if (tmpKeys.length === 1) {
          return;
        }

        tmpKeys.shift();

        let isReassigned = false;
        const variable = this.variables[keys.join('.')];
        const value: ObjectLiteralNode = {
          kind: 'ObjectLiteral',
          fields: [],
          location: variable.location,
        };

        if (variable && isObjectLiteralNode(variable)) {
          const fieldKey = tmpKeys.join('.');

          for (const variableField of variable.fields) {
            if (variableField.key.join('.') === fieldKey) {
              variableField.value = assignment.value;
              isReassigned = true;
            }
          }

          value.fields.push(...variable.fields);
        }

        if (!isReassigned) {
          value.fields.push(
            buildAssignment(
              Array.from(tmpKeys),
              assignment.value,
              assignment.location
            )
          );
        }

        this.addVariableToStack(buildAssignment(keys, value), true);
      }
    }
  }

  private addVariableToStack(
    assignment: AssignmentNode,
    handled: boolean
  ): void {
    const key = assignment.key.join('.');

    const variables: Record<string, LiteralNode> = {};
    variables[key] = assignment.value;

    this.stackTop.variables = mergeVariables(
      this.stackTop.variables,
      variables
    );

    if (!handled) {
      this.handleVariable(assignment);
    }
  }

  private newStack(type: Stack['type'], name?: string): void {
    name = name ?? this.stackTop.name;
    this.stack.push({ type: type, variables: {}, name });
  }

  private get variables(): Record<string, LiteralNode> {
    let variables: Record<string, LiteralNode> = {};

    for (const stackTop of this.stack) {
      variables = mergeVariables(variables, stackTop.variables);
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
