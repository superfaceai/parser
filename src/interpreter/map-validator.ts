import {
  AssignmentNode,
  CallStatementNode,
  HttpCallStatementNode,
  HttpRequestNode,
  HttpResponseHandlerNode,
  InlineCallNode,
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
} from '@superindustries/language';
import { MapVisitor } from '@superindustries/superface';

import {
  ArrayCollection,
  ObjectCollection,
  ProfileOutput,
  StructureType,
} from './profile-validator';
import {
  compareStructure,
  formatErrors,
  formatWarnings,
  validateJessie,
} from './utils';

function assertUnreachable(node: never): never;
function assertUnreachable(node: MapASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

type ResponseHandler = HttpResponseHandlerNode[];

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
      kind: 'resultNotFound';
      context: ErrorContext & { actualResult: LiteralNode };
    }
  | {
      kind: 'resultNotDefined';
      context: ErrorContext & { expectedResult: StructureType };
    }
  | {
      kind: 'inputNotFound';
      context: ErrorContext & { actualInput: LiteralNode };
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
        actual: LiteralNode | string;
      };
    }
  | {
      kind: 'variableNotDefined';
      context: ErrorContext & { actualVariableName: string };
    }
  | {
      kind: 'conditionNotFulfilled';
      context: ErrorContext & { conditionExpression: string };
    }
  | {
      kind: 'missingRequired';
      context?: ErrorContext & { field: string };
    };

export type ValidationWarning =
  | {
      kind: 'wrongObjectStructure';
      context: ErrorContext & {
        expected: ObjectCollection;
        actual: AssignmentNode[];
      };
    }
  | {
      kind: 'wrongStructure';
      context: ErrorContext & {
        expected: StructureType;
        actual: LiteralNode | string;
      };
    };

export type ValidationResult =
  | { pass: true; warnings?: ValidationWarning[] }
  | { pass: false; errors: ValidationError[]; warnings?: ValidationWarning[] };

export type ScopeInfo = 'map' | 'operation';

export type ValidationFunction = (
  input?: StructureType,
  scope?: ScopeInfo
) => ValidationResult;

export type ScopeInfoFunction = (scope: ScopeInfo) => void;

export class MapValidator implements MapVisitor {
  private mapScopedVariables: Record<string, LiteralNode> = {};
  private operationScopedVariables: Record<
    string,
    Record<string, LiteralNode>
  > = {};
  private operationScope: string | undefined;
  private operations: Record<string, OperationDefinitionNode> = {};
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];

  constructor(
    private readonly mapAst: MapASTNode,
    private readonly profileOutput: ProfileOutput
  ) {}

  validate(): void {
    const validator = this.visit(this.mapAst);
    const result = validator(this.profileOutput.usecase?.result);
    // const error = validator(this.profileOutput.usecase?.error);

    if (result.pass !== true) {
      throw new Error(formatErrors(result.errors));
    }

    if (result.warnings) {
      throw new Error(formatWarnings(result.warnings));
    }
  }
  visit(node: SetStatementNode): ScopeInfoFunction;
  visit(node: MapASTNode): ValidationFunction;
  visit(node: MapASTNode): ValidationFunction | ScopeInfoFunction {
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
  visitMapDocumentNode(node: MapDocumentNode): ValidationFunction {
    // check the valid ProfileID
    const { pass } = this.visit(node.map)();
    if (!pass) {
      return this.visit(node.map);
    }

    // add operations to the state
    node.definitions.forEach(definition => {
      if (definition.kind === 'OperationDefinition') {
        this.operations[definition.name] = definition;
      }
    });

    // check if there is MapDefinitionNode
    const mapDefinitionNode = node.definitions.find(
      (definition): definition is MapDefinitionNode =>
        definition.kind === 'MapDefinition'
    );

    // if MapDefinition and profileOutput usecase are not defined
    if (!mapDefinitionNode && !this.profileOutput.usecase) {
      throw new Error('This should not happen!');
    }

    // if MapDefinition is not defined and profileOutput usecase is
    if (!mapDefinitionNode) {
      throw new Error('Map not found!');
    }

    // if profileOutput usecase is not defined and MapDefinition is
    if (!this.profileOutput.usecase) {
      throw new Error('UseCase not found!');
    }

    return this.visit(mapDefinitionNode);
  }
  visitMapNode(node: MapNode): ValidationFunction {
    return this.visit(node.profileId);
  }
  visitProviderNode(_node: ProviderNode): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitMapProfileIdNode(node: MapProfileIdNode): ValidationFunction {
    return (): ValidationResult => {
      if (node.profileId === this.profileOutput.profileId) {
        return { pass: true };
      }

      this.errors.unshift({
        kind: 'wrongProfileID',
        context: {
          expected: node.profileId,
          actual: this.profileOutput.profileId,
        },
      });

      return { pass: false, errors: this.errors };
    };
  }
  visitOperationDefinitionNode(
    node: OperationDefinitionNode
  ): ValidationFunction {
    return (input): ValidationResult => {
      const validationResults = node.statements.map(
        (statement): ValidationResult => {
          if (statement.kind === 'SetStatement') {
            this.visit(statement)('operation');

            return { pass: true };
          }

          return this.visit(statement)(input, 'operation');
        }
      );
      this.operationScope = undefined;

      const result = validationResults.find(result => result.pass === false);

      return result ?? { pass: true };
    };
  }
  visitMapDefinitionNode(node: MapDefinitionNode): ValidationFunction {
    const usecase = this.profileOutput.usecase;

    if (!usecase) {
      throw new Error('Usecase should be defined!');
    }

    return (input): ValidationResult => {
      if (!input) {
        throw new Error('This should not happen!');
      }

      // check the valid Usecase Name
      // is `profileUseCaseName === node.usecaseName` necessary?
      const profileUseCaseName = usecase.useCaseName;
      if (profileUseCaseName !== node.name) {
        this.errors.unshift({
          kind: 'wrongUsecaseName',
          context: {
            expected: node.usecaseName,
            actual: profileUseCaseName,
          },
        });

        return { pass: false, errors: this.errors };
      }

      if (!usecase.result) {
        throw new Error('Result not found!');
      }
      // if (!usecase.input) {
      //   throw new Error('Input not found!');
      // }

      const validationResults = node.statements.map(
        (statement): ValidationResult => {
          if (statement.kind === 'SetStatement') {
            this.visit(statement)('map');

            return { pass: true };
          }

          return this.visit(statement)(input, 'map');
        }
      );

      const result = validationResults.find(result => result.pass === false);

      return result ?? { pass: true };
    };
  }
  visitHttpCallStatementNode(node: HttpCallStatementNode): ValidationFunction {
    return (input, scope): ValidationResult => {
      const responseHandlers: ResponseHandler = node.responseHandlers;
      const validationResults = responseHandlers.map(response =>
        this.visit(response)(input, scope)
      );

      const result = validationResults.find(result => result.pass === false);

      return result ?? { pass: true };
    };
  }
  visitHttpResponseHandlerNode(
    node: HttpResponseHandlerNode
  ): ValidationFunction {
    return (input, scope): ValidationResult => {
      if (!scope) {
        throw new Error('This should not happen!');
      }

      const validationResults = node.statements.map(
        (statement): ValidationResult => {
          if (statement.kind === 'SetStatement') {
            this.visit(statement)(scope);

            return { pass: true };
          }

          return this.visit(statement)(input, scope);
        }
      );

      const result = validationResults.find(result => result.pass === false);

      return result ?? { pass: true };
    };
  }
  visitHttpRequestNode(_node: HttpRequestNode): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitCallStatementNode(node: CallStatementNode): ValidationFunction {
    return (input, scope): ValidationResult => {
      if (!input || !scope) {
        throw new Error('This should not happen!');
      }

      if (!this.operations[node.operationName]) {
        if (input.kind === 'NonNullStructure') {
          this.errors.unshift({
            kind: 'wrongStructure',
            context: {
              expected: input,
              actual: node.operationName,
            },
          });

          return { pass: false, errors: this.errors };
        }

        return { pass: true };
      }

      // create SetStatement with arguments and save them into given operation scope
      this.operationScope = node.operationName;
      node.arguments.forEach(argument => argument.key.unshift('args'));
      this.visit({
        kind: 'SetStatement',
        assignments: node.arguments,
      })('operation');

      const operationValidator = this.visit(
        this.operations[node.operationName]
      );
      if (!operationValidator(input).pass) {
        return operationValidator(input);
      }

      // if operation validator passed, we can validate callback statements
      const validationResults = node.statements.map(
        (statement): ValidationResult => {
          if (statement.kind === 'SetStatement') {
            this.visit(statement)(scope);

            return { pass: true };
          }

          return this.visit(statement)(input, scope);
        }
      );

      const result = validationResults.find(result => result.pass === false);

      return result ?? { pass: true };
    };
  }
  visitOutcomeStatementNode(node: OutcomeStatementNode): ValidationFunction {
    return this.visit(node.value);
  }
  visitSetStatementNode(node: SetStatementNode): ScopeInfoFunction {
    return (scope): void => {
      node.assignments.forEach(assignment => {
        let literal = assignment.value;
        const baseKey = assignment.key[0];

        if (assignment.key.length > 1) {
          const objectNode: ObjectLiteralNode = {
            kind: 'ObjectLiteral',
            fields: [],
          };

          for (let i = assignment.key.length - 1; i >= 0; i--) {
            const assignmentNode: AssignmentNode = {
              kind: 'Assignment',
              key: [assignment.key[i]],
              value: {
                kind: 'ObjectLiteral',
                fields: objectNode.fields,
              },
            };

            if (i === assignment.key.length - 1) {
              assignmentNode.value = literal;
            }

            objectNode.fields[0] = assignmentNode;
          }

          literal = objectNode;
        }

        if (scope === 'map') {
          this.mapScopedVariables[baseKey] = literal;
        } else if (this.operationScope) {
          this.operationScopedVariables[this.operationScope][baseKey] = literal;
        }
      });
    };
  }
  visitStatementConditionNode(
    _node: StatementConditionNode
  ): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitAssignmentNode(node: AssignmentNode): ValidationFunction {
    return this.visit(node.value);
  }
  visitInlineCallNode(node: InlineCallNode): ValidationFunction {
    return (input): ValidationResult => {
      if (!input) {
        throw new Error('Should not happen!');
      }

      const nonNull = input.kind === 'NonNullStructure';

      if (!this.operations[node.operationName]) {
        if (nonNull) {
          this.errors.unshift({
            kind: 'wrongStructure',
            context: {
              expected: input,
              actual: node,
            },
          });

          return { pass: false, errors: this.errors };
        }

        return { pass: true };
      }

      // create SetStatement with arguments and save them into given operation scope
      this.operationScope = node.operationName;
      node.arguments.forEach(argument => argument.key.unshift('args'));
      this.visit({
        kind: 'SetStatement',
        assignments: node.arguments,
      })('operation');

      return this.visit(this.operations[node.operationName])(input);
    };
  }
  visitJessieExpressionNode(node: JessieExpressionNode): ValidationFunction {
    const literal = this.tryFindLiteral(
      this.operationScope ? 'operation' : 'map',
      node.expression
    );

    if (literal) {
      return this.visit(literal);
    }

    return (input): ValidationResult => {
      if (!input) {
        throw new Error('This should not happen!');
      }

      const result = validateJessie(node.source ?? node.expression, input);

      if (!result.pass) {
        result.errors.forEach(error => this.errors.unshift(error));

        return { pass: false, errors: this.errors };
      }

      return result;
    };
  }
  visitObjectLiteralNode(node: ObjectLiteralNode): ValidationFunction {
    return (input): ValidationResult => {
      if (!input) {
        throw new Error('This should not happen!');
      }

      const { isValid, newObjectCollection } = compareStructure(node, input);

      if (!isValid) {
        this.errors.unshift({
          kind: 'wrongStructure',
          context: { expected: input, actual: node },
        });

        return { pass: false, errors: this.errors };
      }

      const nodeCollection = Object.values(node.fields);
      const objectLiteralIsEmpty = nodeCollection.length < 1;
      if (!newObjectCollection && objectLiteralIsEmpty) {
        return { pass: true };
      }

      if (!newObjectCollection) {
        throw new Error('This should not happen!');
      }

      const objectValuesCollection = Object.values(newObjectCollection);
      const structureHasRequiredFields = objectValuesCollection.some(
        field => field?.required === true
      );

      if (!structureHasRequiredFields && objectLiteralIsEmpty) {
        return { pass: true };
      }

      const objectKeysCollection = Object.keys(newObjectCollection);
      const structureResults: ValidationResult[] = [];
      let index = 0;

      Object.keys(newObjectCollection).forEach(key => {
        const value = newObjectCollection[key];
        if (!value) {
          throw new Error('This should not happen.');
        }

        let isFound = false;
        let nodeIndex = nodeCollection.length;
        while (nodeIndex--) {
          const field = nodeCollection[nodeIndex];
          const nodeKey = field.key.join('');

          if (nodeKey === key) {
            isFound = true;

            structureResults.push(this.visit(field)(value));
            nodeCollection.splice(nodeIndex, 1);
            objectKeysCollection.splice(index, 1);

            index--;
          }
        }

        if (value.required && !isFound) {
          this.errors.unshift({
            kind: 'missingRequired',
            context: {
              field: value ? value.kind : 'undefined',
            },
          });
          structureResults.push({ pass: false, errors: this.errors });
        }

        index++;
      });

      if (nodeCollection.length > 0) {
        this.warnings.unshift({
          kind: 'wrongObjectStructure',
          context: {
            expected: newObjectCollection,
            actual: node.fields,
          },
        });
      }

      const error = structureResults.find(result => result.pass === false);

      return error ?? { pass: true, warnings: this.warnings };
    };
  }
  // visitArrayLiteralNode(node: ArrayLiteralNode): ValidationFunction {
  //   return (input): ValidationResult => {
  //     if (!input) {
  //       throw new Error('This should not happen!');
  //     }

  //     const { isValid, newStructure, newArrayCollection } = compareStructure(
  //       node,
  //       input
  //     );

  //     if (!isValid) {
  //       this.errors.unshift({
  //         kind: 'wrongStructure',
  //         context: { expected: input, actual: node },
  //       });

  //       return { pass: false, errors: this.errors };
  //     }

  //     if (newStructure) {
  //       const structureResults = node.elements.map(element =>
  //         this.visit(element)(newStructure)
  //       );

  //       const error = structureResults.find(result => result.pass === false);

  //       return error ?? { pass: true };
  //     }

  //     if (!newArrayCollection) {
  //       throw new Error('This should not happen!');
  //     }

  //     const nodeCollection = Object.values(node.elements);
  //     const structureResults: ValidationResult[] = [];

  //     Object.values(newArrayCollection).forEach(value => {
  //       if (!value) {
  //         throw new Error('This should not happen!');
  //       }

  //       let nodeIndex = nodeCollection.length;
  //       while (nodeIndex--) {
  //         const element = nodeCollection[nodeIndex];
  //         const { isValid } = compareStructure(element, value);

  //         if (isValid) {
  //           structureResults.push(this.visit(element)(value));
  //           nodeCollection.splice(nodeIndex, 1);
  //         }
  //       }
  //     });

  //     if (nodeCollection.length > 0) {
  //       this.errors.unshift({
  //         kind: 'wrongArrayStructure',
  //         context: {
  //           expected: newArrayCollection,
  //           actual: node.elements,
  //         },
  //       });

  //       return { pass: false, errors: this.errors };
  //     }

  //     const error = structureResults.find(result => result.pass === false);

  //     return error ?? { pass: true };
  //   };
  // }
  visitPrimitiveLiteralNode(node: PrimitiveLiteralNode): ValidationFunction {
    return (input): ValidationResult => {
      if (!input) {
        throw new Error('This should not happen!');
      }

      const { isValid, newStructure } = compareStructure(node, input);

      if (!isValid || newStructure) {
        this.errors.unshift({
          kind: 'wrongStructure',
          context: { expected: input, actual: node },
        });

        return { pass: false, errors: this.errors };
      }

      return { pass: true };
    };
  }

  /**
   * This function assume that expression consists of some variable that was set
   * before somewhere in SetStatement.
   * @param scope
   * @param expression
   */
  tryFindLiteral(
    scope: ScopeInfo,
    expression: string
  ): LiteralNode | undefined {
    const keys = expression.split('.');
    const [head, ...tail] = keys;
    let variables: Record<string, LiteralNode>;

    if (scope === 'operation' && this.operationScope) {
      variables = this.operationScopedVariables[this.operationScope];
    } else {
      variables = this.mapScopedVariables;
    }

    let literal: LiteralNode | undefined = variables[head];

    if (!literal) {
      return undefined;
    }

    if (!tail) {
      return literal;
    }

    for (const key of tail) {
      if (!literal) {
        return undefined;
      }

      if (literal.kind === 'ObjectLiteral') {
        literal = literal.fields.find(field => field.key[0] === key)?.value;
      }
    }

    return literal;
  }
}
