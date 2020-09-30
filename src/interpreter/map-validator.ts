import {
  ArrayLiteralNode,
  AssignmentNode,
  CallStatementNode,
  FailStatementNode,
  HttpCallStatementNode,
  HttpResponseHandlerNode,
  JessieExpressionNode,
  LiteralNode,
  MapASTNode,
  MapDefinitionNode,
  MapDocumentNode,
  MapErrorStatementNode,
  MapNode,
  MapProfileIdNode,
  MapResultStatementNode,
  MapSubstatement,
  ObjectLiteralNode,
  OperationDefinitionNode,
  OperationSubstatement,
  PrimitiveLiteralNode,
  ProviderNode,
  ReturnStatementNode,
  SetStatementNode,
  StatementConditionNode,
} from '@superindustries/language';
import { MapVisitor } from '@superindustries/superface';

import { ProfileOutput, StructureType } from './profile-validator';
import { compareStructure, formatErrors } from './utils';

function assertUnreachable(node: never): never;
function assertUnreachable(node: MapASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

export type StructureCollection = {
  [P in string | number]?: StructureType;
};

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
      context: ErrorContext & { expectedResult: LiteralNode };
    }
  | {
      kind: 'inputNotFound';
      context: ErrorContext & { expectedInput: LiteralNode };
    }
  | {
      kind: 'wrongObjectStructure';
      context: ErrorContext & {
        expected: AssignmentNode[];
        actual: StructureCollection;
      };
    }
  | {
      kind: 'wrongArrayStructure';
      context: ErrorContext & {
        expected: LiteralNode[];
        actual: StructureCollection;
      };
    }
  | {
      kind: 'wrongStructure';
      context: ErrorContext & {
        expected: LiteralNode;
        actual: StructureType;
      };
    }
  | {
      kind: 'missingRequired';
      context?: ErrorContext & { field: string };
    };
export type ValidationResult = [true] | [false, ValidationError[]];
export type ValidationFunction = (input?: StructureType) => ValidationResult;

export class MapValidator implements MapVisitor {
  private operationDefinitions: Record<string, OperationDefinitionNode> = {};
  private operationDefinitionsInitialized = false;

  constructor(
    private readonly mapAst: MapASTNode,
    private readonly profileOutput: ProfileOutput
  ) {}

  validate(input?: StructureType): void {
    const validator = this.visit(this.mapAst);
    const [result, errors] = validator(input);

    if (result !== true) {
      throw new Error(formatErrors(errors));
    }
  }

  visit(node: MapASTNode): ValidationFunction {
    switch (node.kind) {
      case 'Map':
        return this.visitMapNode(node);
      case 'MapDefinition':
        return this.visitMapDefinitionNode(node);
      case 'MapDocument':
        return this.visitMapDocumentNode(node);
      case 'ProfileId':
        return this.visitMapProfileIdNode(node);
      case 'Provider':
        return this.visitProviderNode(node);
      case 'PrimitiveLiteral':
        return this.visitPrimitiveLiteralNode(node);
      case 'ArrayLiteral':
        return this.visitArrayLiteralNode(node);
      case 'ObjectLiteral':
        return this.visitObjectLiteralNode(node);
      case 'JessieExpression':
        return this.visitJessieExpressionNode(node);
      case 'StatementCondition':
        return this.visitStatementConditionNode(node);
      case 'Assignment':
        return this.visitAssignmentNode(node);
      case 'OperationDefinition':
        return this.visitOperationDefinitionNode(node);
      case 'HttpCallStatement':
        return this.visitHttpCallStatementNode(node);
      case 'HttpResponseHandler':
        return this.visitHttpResponseHandlerNode(node);
      case 'SetStatement':
        return this.visitSetStatementNode(node);
      case 'CallStatement':
        return this.visitCallStatementNode(node);
      case 'ReturnStatement':
        return this.visitReturnStatementNode(node);
      case 'FailStatement':
        return this.visitFailStatementNode(node);
      case 'MapResultStatement':
        return this.visitMapResultStatementNode(node);
      case 'MapErrorStatement':
        return this.visitMapErrorStatementNode(node);

      default:
        assertUnreachable(node);
    }
  }
  visitMapNode(node: MapNode): ValidationFunction {
    return this.visit(node.profileId);
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
      const profileUseCaseName = usecase.useCaseName;
      if (
        !(
          profileUseCaseName === node.usecaseName &&
          profileUseCaseName === node.name
        )
      ) {
        return [
          false,
          [
            {
              kind: 'wrongUsecaseName',
              context: {
                expected: node.usecaseName,
                actual: profileUseCaseName,
              },
            },
          ],
        ];
      }

      // check if there are statements that manipulate with Result
      const resultStatement = node.statements.find(
        (statement): statement is MapResultStatementNode =>
          statement.kind === 'MapResultStatement'
      );
      /**
       * NOTE:
       * this is valid in ASTExplorer
       * - profile-validator does not insist on defined result
       */
      // if MapResultStatement and Profile Result are undefined
      if (!resultStatement && !usecase.result) {
        return [true];
      }

      // if MapResultStatement is not defined but Profile Result is
      if (!resultStatement) {
        // not sure if this is right solution - shouldn't be just ignored?
        throw new Error('MapResultStatement not found!');
      }

      // if MapResultStatement is defined but Profile Result is not
      if (!usecase.result) {
        return [
          false,
          [
            {
              kind: 'resultNotFound',
              context: {
                expectedResult: resultStatement.value,
              },
            },
          ],
        ];
      }

      return this.visit(resultStatement)(input);
    };
  }
  visitMapDocumentNode(node: MapDocumentNode): ValidationFunction {
    // check the valid ProfileID
    const [result] = this.visit(node.map)();
    if (result !== true) {
      return this.visit(node.map);
    }

    // check if there is MapDefinitionNode
    const mapDefinitionNode = node.definitions.find(
      (definition): definition is MapDefinitionNode =>
        definition.kind === 'MapDefinition'
    );

    /**
     * NOTE:
     * this is valid in ASTExplorer, but wouldn't be valid after profile-parameter-validator walker
     * - profile-parameter-validator insist on defined usecase
     * - profile-validator does not insist on defined usecase
     */
    // if MapDefinition and Usecase are not defined
    if (!mapDefinitionNode && !this.profileOutput.usecase) {
      return (): ValidationResult => [true];
    }

    // if MapDefinition doesn't exist and profileOutput usecase exists
    if (!mapDefinitionNode) {
      throw new Error('Map not found!');
    }

    // if MapDefinition exists but profileOutput usecase doesn't
    if (!this.profileOutput.usecase) {
      return (): ValidationResult => [
        false,
        [
          {
            kind: 'usecaseNotFound',
            context: {
              expectedUseCase: mapDefinitionNode.usecaseName,
            },
          },
        ],
      ];
    }

    // store operation definitions before map definition
    if (!this.operationDefinitionsInitialized) {
      node.definitions
        .filter(
          (definition): definition is OperationDefinitionNode =>
            definition.kind === 'OperationDefinition'
        )
        .forEach(
          definition =>
            (this.operationDefinitions[definition.name] = definition)
        );

      this.operationDefinitionsInitialized = true;
    }

    return this.visit(mapDefinitionNode);
  }
  visitMapProfileIdNode(node: MapProfileIdNode): ValidationFunction {
    return (): ValidationResult => {
      if (node.profileId === this.profileOutput.profileId) {
        return [true];
      }

      return [
        false,
        [
          {
            kind: 'wrongProfileID',
            context: {
              expected: node.profileId,
              actual: this.profileOutput.profileId,
            },
          },
        ],
      ];
    };
  }
  visitProviderNode(_node: ProviderNode): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitPrimitiveLiteralNode(node: PrimitiveLiteralNode): ValidationFunction {
    return (input): ValidationResult => {
      if (!input) {
        throw new Error('This should not happen!');
      }

      const { isValid, newInput } = compareStructure(node, input);

      if (!isValid || newInput) {
        return [
          false,
          [
            {
              kind: 'wrongStructure',
              context: { expected: node, actual: input },
            },
          ],
        ];
      }

      return [true];
    };
  }
  visitArrayLiteralNode(node: ArrayLiteralNode): ValidationFunction {
    return (input): ValidationResult => {
      if (!input) {
        throw new Error('This should not happen!');
      }

      const { isValid, newInput, newCollection } = compareStructure(
        node,
        input
      );

      if (!isValid) {
        return [
          false,
          [
            {
              kind: 'wrongStructure',
              context: { expected: node, actual: input },
            },
          ],
        ];
      }

      // this means array consist of one type
      if (newInput) {
        return this.visit(node.elements[0])(newInput);
      }

      // valid empty collection?
      if (!newCollection) {
        return [true];
      }

      // not empty collection have to be visited and input should be moved
      const elementResults = node.elements.map((field, i) => {
        if (newCollection[i]) {
          return this.visit(field)(newCollection[i]);
        }

        return [
          false,
          [
            {
              kind: 'wrongArrayStructure',
              context: { expected: node.elements, actual: newCollection },
            },
          ],
        ];
      });

      const areValid = elementResults.every(result => result[0] === true);

      if (!areValid) {
        return elementResults.find(
          value => value[0] === false
        ) as ValidationResult;
      }

      return [true];
    };
  }
  visitObjectLiteralNode(node: ObjectLiteralNode): ValidationFunction {
    return (input): ValidationResult => {
      if (!input) {
        throw new Error('This should not happen!');
      }

      const { isValid, newCollection } = compareStructure(node, input);

      if (!isValid) {
        return [
          false,
          [
            {
              kind: 'wrongStructure',
              context: { expected: node, actual: input },
            },
          ],
        ];
      }

      /**
       * NOTE:
       * This is valid in AST Explorer. Input can have empty fields.
       */
      // valid empty collection?
      if (!newCollection) {
        return [true];
      }

      // not empty collection have to be visited and input should be moved
      const fieldResults = node.fields.map(field => {
        const key = field.key.join('');

        if (newCollection[key]) {
          return this.visit(field)(newCollection[key]);
        }

        return [
          false,
          [
            {
              kind: 'wrongObjectStructure',
              context: { expected: node.fields, actual: newCollection },
            },
          ],
        ];
      });

      const areValid = fieldResults.every(result => result[0] === true);

      if (!areValid) {
        return fieldResults.find(
          value => value[0] === false
        ) as ValidationResult;
      }

      return [true];
    };
  }
  visitJessieExpressionNode(_node: JessieExpressionNode): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitStatementConditionNode(
    _node: StatementConditionNode
  ): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitAssignmentNode(node: AssignmentNode): ValidationFunction {
    return this.visit(node.value);
  }
  visitOperationDefinitionNode(
    _node: OperationDefinitionNode
  ): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitHttpCallStatementNode(
    _node:
      | HttpCallStatementNode<MapSubstatement>
      | HttpCallStatementNode<OperationSubstatement>
  ): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitHttpResponseHandlerNode(
    _node:
      | HttpResponseHandlerNode<MapSubstatement>
      | HttpResponseHandlerNode<OperationSubstatement>
  ): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitSetStatementNode(_node: SetStatementNode): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitCallStatementNode(
    _node:
      | CallStatementNode<MapSubstatement>
      | CallStatementNode<OperationSubstatement>
  ): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitReturnStatementNode(_node: ReturnStatementNode): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitFailStatementNode(_node: FailStatementNode): ValidationFunction {
    throw new Error('Method not implemented.');
  }
  visitMapResultStatementNode(
    node: MapResultStatementNode
  ): ValidationFunction {
    return (input): ValidationResult => {
      const usecase = this.profileOutput.usecase;

      if (!input || !usecase || !usecase.result) {
        throw new Error('This should not happen!');
      }

      return this.visit(node.value)(input);
    };
  }
  visitMapErrorStatementNode(_node: MapErrorStatementNode): ValidationFunction {
    throw new Error('Method not implemented.');
  }
}
