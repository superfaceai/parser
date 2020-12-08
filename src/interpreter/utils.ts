import {
  isCallStatementNode,
  isHttpCallStatementNode,
  isObjectLiteralNode,
  isOutcomeStatementNode,
  isPrimitiveLiteralNode,
  LiteralNode,
  MapASTNode,
  MapDefinitionNode,
  OperationDefinitionNode,
  OutcomeStatementNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';

import { ValidationIssue } from './issue';
import { MapValidator, ValidationResult } from './map-validator';
import {
  ObjectCollection,
  ProfileOutput,
  StructureType,
} from './profile-output';
import {
  isEnumStructure,
  isNonNullStructure,
  isPrimitiveStructure,
} from './profile-output.utils';
import { ProfileValidator } from './profile-validator';

export function formatIssues(issues?: ValidationIssue[]): string {
  if (!issues) {
    return 'Unknown issue';
  }

  return issues
    .map(issue => {
      const location = issue.context
        ? issue.context.path
          ? issue.context.path.join(' ')
          : ''
        : '';

      let expected;
      let actual;

      switch (issue.kind) {
        case 'wrongProfileID':
          return `${location} - Wrong Profile ID: expected ${issue.context.expected}, but got ${issue.context.actual}`;

        case 'mapNotFound':
          return `${location} - Map not found: ${issue.context.expected}`;

        case 'extraMapsFound':
          return `${location} - Extra Maps Found: ${issue.context.expected.join(
            ','
          )}, but got ${issue.context.actual.join(', ')}`;

        case 'operationNotFound':
          return `${location} - Operation not found: ${issue.context.expected}`;

        case 'resultNotDefined':
          return `${location} - Result not defined`;

        case 'errorNotDefined':
          return `${location} - Error not defined`;

        case 'resultNotFound':
          if (isPrimitiveLiteralNode(issue.context.actualResult)) {
            actual = issue.context.actualResult.value;
          } else {
            actual = issue.context.actualResult.kind;
          }

          return `${location} - Result Not Found: returning "${actual.toString()}", but there is no result defined in usecase`;

        case 'errorNotFound':
          if (isPrimitiveLiteralNode(issue.context.actualError)) {
            actual = issue.context.actualError.value;
          } else {
            actual = issue.context.actualError.kind;
          }

          return `${location} - Error Not Found: returning "${actual.toString()}", but there is no error defined in usecase`;

        case 'inputNotFound':
          return `${location} - Input Not Found: there is no input defined in usecase`;

        case 'wrongObjectStructure':
          expected = Object.keys(issue.context.expected).join(', ');
          actual = issue.context.actual
            .map(val => val.key.join('.'))
            .join(', ');

          return `${location} - Wrong Object Structure: expected ${expected}, but got ${actual}`;

        case 'wrongArrayStructure':
          expected = Object.values(issue.context.expected).join(', ');
          actual = issue.context.actual.map(val => val.kind).join(', ');

          return `${location} - Wrong Array Structure: expected ${expected}, but gor ${actual}`;

        case 'wrongStructure':
          if (isPrimitiveStructure(issue.context.expected)) {
            expected = issue.context.expected.type;
          } else if (isNonNullStructure(issue.context.expected)) {
            if (isPrimitiveStructure(issue.context.expected.value)) {
              expected = issue.context.expected.value.type;
            } else {
              expected = issue.context.expected.value.kind;
            }
          } else if (isEnumStructure(issue.context.expected)) {
            expected = issue.context.expected.enums.join(' or ');
          } else {
            expected = issue.context.expected.kind;
          }

          if (typeof issue.context.actual !== 'string') {
            if (issue.context.actual.kind === 'PrimitiveLiteral') {
              actual = issue.context.actual.value;
            } else {
              actual = issue.context.actual.kind;
            }
          } else {
            actual = issue.context.actual;
          }

          return `${location} - Wrong Structure: expected ${expected}, but got "${actual.toString()}"`;

        case 'missingRequired':
          return `${location} - Missing required field`;

        case 'wrongInput':
          if (!issue.context.expected.fields) {
            throw new Error('This should not happen!');
          }
          expected = Object.keys(issue.context.expected.fields).join(', ');

          return `${location} - Wrong Input Structure: expected ${expected}, but got ${issue.context.actual}`;

        case 'wrongVariableStructure':
          if (isPrimitiveStructure(issue.context.expected)) {
            expected = issue.context.expected.type;
          } else if (isNonNullStructure(issue.context.expected)) {
            if (isPrimitiveStructure(issue.context.expected.value)) {
              expected = issue.context.expected.value.type;
            } else {
              expected = issue.context.expected.value.kind;
            }
          } else if (isEnumStructure(issue.context.expected)) {
            expected = issue.context.expected.enums.join(' or ');
          } else {
            expected = issue.context.expected.kind;
          }

          if (typeof issue.context.actual !== 'string') {
            if (isPrimitiveLiteralNode(issue.context.actual)) {
              actual = issue.context.actual.value;
            } else {
              actual = issue.context.actual.kind;
            }
          } else {
            actual = issue.context.actual;
          }

          return `${location} - Wrong Variable Structure: variable ${
            issue.context.name
          } expected ${expected}, but got ${actual.toString()}`;

        case 'variableNotDefined':
          return `${location} - Missing Variable definition: ${issue.context.name} is not defined`;

        default:
          throw new Error('Invalid issue!');
      }
    })
    .join('\n');
}

/**
 * Compares the node with profile output structure. The arguments represent the actual nested level in structure.
 * @param node represents LiteralNode
 * @param structure represent Result or Error and their descendent structure
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
        isPrimitiveLiteralNode(node) &&
        typeof node.value === structure.type
      ) {
        return { isValid: true };
      }
      break;

    case 'ObjectStructure':
      if (isObjectLiteralNode(node)) {
        return { isValid: true, structureOfFields: structure.fields };
      }
      break;

    case 'EnumStructure':
      if (
        isPrimitiveLiteralNode(node) &&
        structure.enums.includes(node.value)
      ) {
        return { isValid: true };
      }
  }

  return { isValid: false };
}

function isErrorOutcome(node: MapASTNode): node is OutcomeStatementNode {
  return isOutcomeStatementNode(node) && node.isError;
}

function isResultOutcome(node: MapASTNode): node is OutcomeStatementNode {
  return isOutcomeStatementNode(node) && !node.isError;
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
