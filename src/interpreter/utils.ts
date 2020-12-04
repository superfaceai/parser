import {
  isCallStatementNode,
  isHttpCallStatementNode,
  isOutcomeStatementNode,
  LiteralNode,
  MapASTNode,
  MapDefinitionNode,
  OperationDefinitionNode,
  OutcomeStatementNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';

import {
  MapValidator,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from './map-validator';
import {
  ObjectCollection,
  ProfileOutput,
  ProfileValidator,
  StructureType,
} from './profile-validator';

export function formatErrors(errors?: ValidationError[]): string {
  if (!errors) {
    return 'Unknown error';
  }

  return errors
    .map(err => {
      const location = err.context
        ? err.context.path
          ? err.context.path.join(' ')
          : ''
        : '';

      let expected;
      let actual;

      switch (err.kind) {
        case 'wrongProfileID':
          return `${location} - Wrong Profile ID: expected ${err.context.expected}, but got ${err.context.actual}`;

        case 'wrongUsecaseName':
          return `${location} - Wrong Usecase Name: expected ${err.context.expected}, but got ${err.context.actual}`;

        case 'usecaseNotFound':
          return `${location} - Usecase Not Found: expected ${err.context.expectedUseCase}, but got undefined`;

        case 'wrongObjectStructure':
          expected = Object.keys(err.context.expected).join(', ');
          actual = err.context.actual.map(val => val.key.join('.')).join(', ');

          return `${location} - Wrong Object Structure: expected ${expected}, but got ${actual}`;

        case 'wrongArrayStructure':
          expected = Object.values(err.context.expected).join(', ');
          actual = err.context.actual.map(val => val.kind).join(', ');

          return `${location} - Wrong Array Structure: expected ${expected}, but gor ${actual}`;

        case 'wrongStructure':
          if (err.context.expected.kind === 'PrimitiveStructure') {
            expected = err.context.expected.type;
          } else if (err.context.expected.kind === 'NonNullStructure') {
            if (err.context.expected.value.kind === 'PrimitiveStructure') {
              expected = err.context.expected.value.type;
            } else {
              expected = err.context.expected.value.kind;
            }
          } else if (err.context.expected.kind === 'EnumStructure') {
            expected = err.context.expected.enums.join(' or ');
          } else {
            expected = err.context.expected.kind;
          }

          if (typeof err.context.actual !== 'string') {
            if (err.context.actual.kind === 'PrimitiveLiteral') {
              actual = err.context.actual.value;
            } else {
              actual = err.context.actual.kind;
            }
          } else {
            actual = err.context.actual;
          }

          return `${location} - Wrong Structure: expected ${expected}, but got "${actual.toString()}"`;

        case 'variableNotDefined':
          return `${location} - Missing Variable definition: ${err.context.name} is not defined`;

        case 'missingRequired':
          return `${location} - Missing required field`;

        case 'resultNotDefined':
          return `${location} - Result not defined`;

        case 'errorNotDefined':
          return `${location} - Error not defined`;

        case 'operationNotFound':
          return `${location} - Operation not found: ${err.context.expected}`;

        case 'mapNotFound':
          return `${location} - Map not found: ${err.context.expected}`;

        case 'wrongInput':
          if (!err.context.expected.fields) {
            throw new Error('This should not happen!');
          }
          expected = Object.keys(err.context.expected.fields).join(', ');

          return `${location} - Wrong Input Structure: expected ${expected}, but got ${err.context.actual}`;

        case 'wrongVariableStructure':
          if (err.context.expected.kind === 'PrimitiveStructure') {
            expected = err.context.expected.type;
          } else if (err.context.expected.kind === 'NonNullStructure') {
            if (err.context.expected.value.kind === 'PrimitiveStructure') {
              expected = err.context.expected.value.type;
            } else {
              expected = err.context.expected.value.kind;
            }
          } else if (err.context.expected.kind === 'EnumStructure') {
            expected = err.context.expected.enums.join(' or ');
          } else {
            expected = err.context.expected.kind;
          }

          if (typeof err.context.actual !== 'string') {
            if (err.context.actual.kind === 'PrimitiveLiteral') {
              actual = err.context.actual.value;
            } else {
              actual = err.context.actual.kind;
            }
          } else {
            actual = err.context.actual;
          }

          return `${location} - Wrong Variable Structure: variable ${
            err.context.name
          } expected ${expected}, but got ${actual.toString()}`;

        case 'inputNotUsed':
          return `There is no input defined in usecase`;

        default:
          throw new Error(`${err.kind} Invalid error!`);
      }
    })
    .join('\n');
}

export function formatWarnings(warnings?: ValidationWarning[]): string {
  if (!warnings) {
    return 'Unknown warning';
  }

  return warnings
    .map(warn => {
      const location = warn.context
        ? warn.context.path
          ? warn.context.path.join(' ')
          : ''
        : '';

      let expected;
      let actual;

      switch (warn.kind) {
        case 'wrongObjectStructure':
          expected = Object.keys(warn.context.expected).join(', ');
          actual = warn.context.actual.map(val => val.key.join('.')).join(', ');

          return `${location} - Wrong Object Structure: expected ${expected}, but got ${actual}`;

        case 'wrongStructure':
          if (warn.context.expected.kind === 'PrimitiveStructure') {
            expected = warn.context.expected.type;
          } else if (warn.context.expected.kind === 'NonNullStructure') {
            if (warn.context.expected.value.kind === 'PrimitiveStructure') {
              expected = warn.context.expected.value.type;
            } else {
              expected = warn.context.expected.value.kind;
            }
          } else if (warn.context.expected.kind === 'EnumStructure') {
            expected = warn.context.expected.enums.join(' or ');
          } else {
            expected = warn.context.expected.kind;
          }

          if (typeof warn.context.actual !== 'string') {
            if (warn.context.actual.kind === 'PrimitiveLiteral') {
              actual = warn.context.actual.value;
            } else {
              actual = warn.context.actual.kind;
            }
          } else {
            actual = warn.context.actual;
          }

          return `${location} - Wrong Structure: expected ${expected}, but got "${actual.toString()}"`;

        case 'wrongVariableStructure':
          if (warn.context.expected.kind === 'PrimitiveStructure') {
            expected = warn.context.expected.type;
          } else if (warn.context.expected.kind === 'NonNullStructure') {
            if (warn.context.expected.value.kind === 'PrimitiveStructure') {
              expected = warn.context.expected.value.type;
            } else {
              expected = warn.context.expected.value.kind;
            }
          } else if (warn.context.expected.kind === 'EnumStructure') {
            expected = warn.context.expected.enums.join(' or ');
          } else {
            expected = warn.context.expected.kind;
          }

          if (typeof warn.context.actual !== 'string') {
            if (warn.context.actual.kind === 'PrimitiveLiteral') {
              actual = warn.context.actual.value;
            } else {
              actual = warn.context.actual.kind;
            }
          } else {
            actual = warn.context.actual;
          }

          return `${location} - Wrong Variable Structure: variable ${
            warn.context.name
          } expected ${expected}, but got ${actual.toString()}`;

        case 'variableNotDefined':
          return `${location} - Missing Variable definition: ${warn.context.name} is not defined`;

        case 'resultNotFound':
          if (warn.context.actualResult.kind === 'PrimitiveLiteral') {
            actual = warn.context.actualResult.value;
          } else {
            actual = warn.context.actualResult.kind;
          }

          return `${location} - Result Not Found: returning "${actual.toString()}", but result is undefined`;

        case 'errorNotFound':
          if (warn.context.actualError.kind === 'PrimitiveLiteral') {
            actual = warn.context.actualError.value;
          } else {
            actual = warn.context.actualError.kind;
          }

          return `${location} - Error Not Found: returning "${actual.toString()}", but error is undefined`;

        case 'extraMapsFound':
          return `${location} - Extra Maps Found: ${warn.context.expected.join(
            ', '
          )}, but got ${warn.context.actual.join(', ')}`;

        case 'missingRequired':
          return `${location} - Missing required field`;

        case 'wrongInput':
          if (!warn.context.expected.fields) {
            throw new Error('This should not happen!');
          }
          expected = Object.keys(warn.context.expected.fields).join(', ');

          return `${location} - Wrong Input Structure: expected ${expected}, but got ${warn.context.actual}`;

        case 'inputNotUsed':
          return `There is no input defined in usecase`;

        default:
          throw new Error(`${warn.kind} Invalid warning!`);
      }
    })
    .join('\n');
}

/**
 * Compares the node with profile output structure. The arguments represent the actual nested level in structure.
 * @param node represents LiteralNode
 * @param structure represent Result or Input and their descendent structure
 */
export function compareStructure(
  node: LiteralNode,
  structure: StructureType
): {
  isValid: boolean;
  structureOfFields?: ObjectCollection;
  nonNull?: boolean;
} {
  switch (structure.kind) {
    case 'NonNullStructure':
      if (structure.value)
        return {
          nonNull: true,
          ...compareStructure(node, structure.value),
        };
      break;

    case 'PrimitiveStructure':
      if (
        node.kind === 'PrimitiveLiteral' &&
        typeof node.value === structure.type
      ) {
        return { isValid: true };
      }
      break;

    case 'ObjectStructure':
      if (node.kind === 'ObjectLiteral') {
        return { isValid: true, structureOfFields: structure.fields };
      }
      break;

    case 'EnumStructure':
      if (
        node.kind === 'PrimitiveLiteral' &&
        structure.enums.includes(node.value)
      ) {
        return { isValid: true };
      }
  }

  return { isValid: false };
}

function isErrorOutcome(node: MapASTNode): node is OutcomeStatementNode {
  return node.kind === 'OutcomeStatement' && node.isError;
}

function isResultOutcome(node: MapASTNode): node is OutcomeStatementNode {
  return node.kind === 'OutcomeStatement' && !node.isError;
}

export function getOutcomes(
  node: MapDefinitionNode | OperationDefinitionNode,
  isError?: boolean
): OutcomeStatementNode[] {
  let filterFunction = isOutcomeStatementNode;
  if (isError !== undefined) {
    filterFunction = isError ? isErrorOutcome : isResultOutcome;
  }

  const outcomes = node.statements.filter(filterFunction);

  node.statements
    .filter(isCallStatementNode)
    .forEach(callStatement =>
      outcomes.concat(callStatement.statements.filter(filterFunction))
    );

  node.statements
    .filter(isHttpCallStatementNode)
    .forEach(httpCall =>
      httpCall.responseHandlers.forEach(responseHandler =>
        outcomes.concat(responseHandler.statements.filter(filterFunction))
      )
    );

  return outcomes;
}

export const mergeVariables = (
  left: Record<string, LiteralNode>,
  right: Record<string, LiteralNode>
): Record<string, LiteralNode> => {
  const result: Record<string, LiteralNode> = {};

  for (const key of Object.keys(left)) {
    result[key] = left[key];
  }
  for (const key of Object.keys(right)) {
    result[key] = right[key];
  }

  return result;
};

export const getProfileOutput = (
  profile: ProfileDocumentNode
): ProfileOutput => {
  const profileValidator = new ProfileValidator();

  return profileValidator.visit(profile);
};

export const validateMap = (
  profileOutput: ProfileOutput,
  mapAst: MapASTNode
): ValidationResult => {
  const mapValidator = new MapValidator(mapAst, profileOutput);

  return mapValidator.validate();
};
