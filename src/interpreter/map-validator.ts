import {
  AssignmentNode,
  CallStatementNode,
  ConditionAtomNode,
  HttpCallStatementNode,
  HttpRequestNode,
  HttpResponseHandlerNode,
  InlineCallNode,
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
import * as ts from 'typescript';

import { RETURN_CONSTRUCTS } from './constructs';
import { ValidationIssue } from './issue';
import {
  ObjectStructure,
  ProfileOutput,
  StructureType,
  UseCaseStructure,
} from './profile-output';
import {
  isEnumStructure,
  isNonNullStructure,
  isPrimitiveStructure,
  isScalarStructure,
} from './profile-output.utils';
import {
  compareStructure,
  findTypescriptIdentifier,
  findTypescriptProperty,
  getOutcomes,
  getTypescriptIdentifier,
  getVariableName,
  mergeVariables,
  validateObjectStructure,
} from './utils';

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
    const { scope, name, version } = this.profileOutput.header;

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
    const { major, minor } = node.profile.version;
    if (major !== version.major || minor !== version.minor) {
      this.errors.push({
        kind: 'wrongProfileVersion',
        context: {
          path: this.getPath(node),
          expected: version,
          actual: { major, minor },
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

    this.newStack('map', node.name);
    this.inputStructure = usecase.input;

    node.statements.forEach(statement => this.visit(statement));

    this.inputStructure = undefined;
    this.stack.pop();
  }

  visitHttpCallStatementNode(node: HttpCallStatementNode): void {
    const variableExpressions = node.url
      .match(/{([_A-Za-z][_0-9A-Za-z]*[.]?)*(?<![.])}/g)
      ?.map(expression => expression.slice(1, -1));

    if (variableExpressions) {
      for (const expression of variableExpressions) {
        const sourceFile = ts.createSourceFile(
          'scripts.js',
          `(${expression})`,
          ts.ScriptTarget.ES2015,
          true,
          ts.ScriptKind.JS
        );

        const typescriptIdentifier = getTypescriptIdentifier(sourceFile);

        if (!typescriptIdentifier) {
          throw new Error('Invalid variable!');
        }

        if (findTypescriptIdentifier('input', typescriptIdentifier)) {
          if (findTypescriptProperty('auth', typescriptIdentifier)) {
            continue;
          }

          if (!this.inputStructure || !this.inputStructure.fields) {
            this.errors.push({
              kind: 'inputNotFound',
              context: {
                path: this.getPath(node),
                actual: expression,
              },
            });
            continue;
          }

          const wrongStructureIssue: ValidationIssue = {
            kind: 'wrongStructure',
            context: {
              path: this.getPath(node),
              expected: { kind: 'PrimitiveStructure', type: 'string' },
              actual: this.inputStructure,
            },
          };

          // identifier `input` by itself is always an object
          if (ts.isIdentifier(typescriptIdentifier)) {
            this.errors.push(wrongStructureIssue);
            continue;
          }

          const structure = validateObjectStructure(
            typescriptIdentifier,
            this.inputStructure
          );

          if (!structure) {
            this.errors.push({
              kind: 'wrongInput',
              context: {
                path: this.getPath(node),
                expected: this.inputStructure,
                actual: expression,
              },
            });
            continue;
          }

          wrongStructureIssue.context.actual = structure;
          if (isScalarStructure(structure)) {
            this.warnings.push(wrongStructureIssue);
            continue;
          }

          if (!isPrimitiveStructure(structure) && !isEnumStructure(structure)) {
            this.errors.push(wrongStructureIssue);
            continue;
          }
        }
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

  visitSetStatementNode(node: SetStatementNode): void {
    node.assignments.forEach(assignment => {
      this.visit(assignment.value);
      this.addVariableToStack(assignment);
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
      node.arguments.forEach(argument => this.visit(argument));
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
    } else if (constructResult.invalidInput) {
      this.addIssue({
        kind: 'inputNotFound',
        context: {
          path: this.getPath(node),
          actual: node.source ?? node.expression,
        },
      });
    }

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

      this.currentStructure = type;
      result = this.visit(variable);

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

    const { structureOfFields, isValid } = compareStructure(
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
        const assignment: AssignmentNode = {
          kind: 'Assignment',
          key: [head],
          value: {
            kind: 'ObjectLiteral',
            fields: [
              {
                kind: 'Assignment',
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
      this.addIssue({
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

  private getPath(node: MapASTNode): string[] {
    return node.location
      ? [`${node.location.line}:${node.location.column}`, node.kind]
      : [node.kind];
  }

  private cleanUpVariables(key: string): void {
    for (const variableKey of Object.keys(this.variables)) {
      if (
        variableKey.length > key.length &&
        variableKey[key.length] === '.' &&
        variableKey.startsWith(key)
      ) {
        delete this.variables[variableKey];
      }
    }
  }

  private handleVariable(assignment: AssignmentNode): void {
    if (assignment.key.length > 1) {
      const keys: string[] = [];
      const tmpField: AssignmentNode = {
        kind: 'Assignment',
        key: Array.from(assignment.key),
        value: assignment.value,
      };

      for (const assignmentKey of assignment.key) {
        keys.push(assignmentKey);
        tmpField.key.shift();

        if (tmpField.key.length === 0) {
          return;
        }

        let isReassigned = false;
        const variable = this.variables[keys.join('.')];
        const value: ObjectLiteralNode = {
          kind: 'ObjectLiteral',
          fields: [],
        };

        if (variable && isObjectLiteralNode(variable)) {
          const fieldKey = tmpField.key.join('.');

          for (const variableField of variable.fields) {
            if (variableField.key.join('.') === fieldKey) {
              isReassigned = true;
              variableField.value = tmpField.value;
            }
          }

          value.fields.push(...variable.fields);
        }

        if (!isReassigned) {
          value.fields.push(tmpField);
        }

        this.addVariableToStack({
          kind: 'Assignment',
          key: keys,
          value,
        });
      }
    }
  }

  private addVariableToStack(assignment: AssignmentNode): void {
    const key = assignment.key.join('.');

    const variable: Record<string, LiteralNode> = {};
    variable[key] = assignment.value;

    this.stackTop.variables = mergeVariables(this.stackTop.variables, variable);

    this.handleVariable(assignment);
    this.cleanUpVariables(key);
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
