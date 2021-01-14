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
import * as ts from 'typescript';

import { TypescriptIdentifier } from './constructs';
import { ValidationIssue } from './issue';
import { MapValidator, ValidationResult } from './map-validator';
import { ProfileIOAnalyzer } from './profile-io-analyzer';
import {
  ObjectCollection,
  ObjectStructure,
  ProfileOutput,
  StructureType,
  VersionStructure,
} from './profile-output';
import {
  isEnumStructure,
  isNonNullStructure,
  isObjectStructure,
  isPrimitiveStructure,
} from './profile-output.utils';

export function composeVersion(version: VersionStructure): string {
  return (
    `${version.major}.${version.minor}.${version.patch}` +
    (version.label ? `-${version.label}` : '')
  );
}

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
        case 'wrongScope':
          return `${location} - Wrong Scope: expected ${
            issue.context.expected ?? 'no scope in profile'
          }, but got ${issue.context.actual ?? 'no scope in map'}`;

        case 'wrongProfileName':
          return `${location} - Wrong Profile Name: expected ${issue.context.expected}, but got ${issue.context.actual}`;

        case 'wrongProfileVersion':
          return `${location} - Wrong Profile Version: expected ${composeVersion(
            issue.context.expected
          )}, but got ${composeVersion(issue.context.actual)}`;

        case 'mapNotFound':
          return `${location} - Map not found: ${issue.context.expected}`;

        case 'extraMapsFound':
          return `${location} - Extra Maps Found: ${issue.context.expected.join(
            ','
          )}, but got ${issue.context.actual.join(', ')}`;

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
          return `${location} - Input Not Found: ${issue.context.actual} - there is no input defined in usecase`;

        case 'wrongObjectStructure':
          expected = Object.keys(issue.context.expected).join(', ');
          actual =
            typeof issue.context.actual === 'string'
              ? issue.context.actual
              : issue.context.actual.map(val => val.key.join('.')).join(', ');

          return `${location} - Wrong Object Structure: expected ${expected}, but got ${actual}`;

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
            expected = issue.context.expected.enums
              .map(enumValue => enumValue.value)
              .join(' or ');
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
            expected = issue.context.expected.enums
              .map(enumValue => enumValue.value)
              .join(' or ');
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
        structure.enums.map(enumValue => enumValue.value).includes(node.value)
      ) {
        return { isValid: true };
      }
      break;

    case 'UnionStructure':
      for (const type of Object.values(structure.types)) {
        const compareResult = compareStructure(node, type);
        if (compareResult.isValid) {
          return compareResult;
        }
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
  const analyzer = new ProfileIOAnalyzer();

  return analyzer.visit(profile);
};

export const validateMap = (
  profileOutput: ProfileOutput,
  mapAst: MapASTNode
): ValidationResult => {
  const mapValidator = new MapValidator(mapAst, profileOutput);

  return mapValidator.validate();
};

export function getTypescriptIdentifier(
  node: ts.Node
): TypescriptIdentifier | undefined {
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isIdentifier(node)
  ) {
    return node;
  }

  return ts.forEachChild(node, getTypescriptIdentifier);
}

export const REDUDANT_EXPRESSION_CHARACTERS_REGEX = /['"[\]]/g;

export function replaceRedudantCharacters(text: string): string {
  return text.replace(REDUDANT_EXPRESSION_CHARACTERS_REGEX, '');
}

export function validateObjectStructure(
  node: TypescriptIdentifier,
  structure: ObjectStructure
): StructureType | undefined {
  if (ts.isIdentifier(node)) {
    return structure;
  }

  let expression: ts.LeftHandSideExpression;
  let name: ts.PrivateIdentifier | ts.Expression;

  if (ts.isElementAccessExpression(node)) {
    expression = node.expression;
    name = node.argumentExpression;
  } else {
    expression = node.expression;
    name = node.name;
  }

  const key = replaceRedudantCharacters(name.getText());
  let outputStructure: StructureType | undefined;

  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  ) {
    outputStructure = validateObjectStructure(expression, structure);
  } else if (ts.isIdentifier(expression)) {
    if (!structure.fields) {
      return undefined;
    }

    return structure.fields[key];
  }

  if (
    !outputStructure ||
    !isObjectStructure(outputStructure) ||
    !outputStructure.fields
  ) {
    return undefined;
  }

  return outputStructure.fields[key];
}

export function findTypescriptIdentifier(name: string, node: ts.Node): boolean {
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    return findTypescriptIdentifier(name, node.expression);
  }
  if (ts.isIdentifier(node)) {
    return node.text === name;
  }

  return false;
}

export function findTypescriptProperty(name: string, node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node)) {
    return ts.isIdentifier(node.expression)
      ? name === node.name.text
      : findTypescriptProperty(name, node.expression);
  }

  if (ts.isElementAccessExpression(node)) {
    return ts.isIdentifier(node.expression)
      ? name === replaceRedudantCharacters(node.argumentExpression.getText())
      : findTypescriptProperty(name, node.expression);
  }

  return false;
}

export function getTypescriptIdentifierName(node: ts.Node): string {
  if (ts.isIdentifier(node)) {
    return node.text;
  }

  if (ts.isPropertyAccessExpression(node)) {
    return replaceRedudantCharacters(node.getText());
  }

  if (ts.isElementAccessExpression(node)) {
    return replaceRedudantCharacters(
      `${node.expression.getText()}.${node.argumentExpression.getText()}`
    );
  }

  return 'undefined';
}

export function getVariableName(
  node: TypescriptIdentifier | ts.LeftHandSideExpression,
  name?: string
): string {
  name = name ? replaceRedudantCharacters(name) : '';

  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) {
    return name !== '' ? `${node.text}.${name}` : node.text;
  }

  if (ts.isPropertyAccessExpression(node)) {
    name = name !== '' ? `${node.name.text}.${name}` : node.name.text;

    return getVariableName(node.expression, name);
  }

  if (ts.isElementAccessExpression(node)) {
    const nodeName = (node.argumentExpression as ts.Identifier).text;
    name = name !== '' ? `${nodeName}.${name}` : nodeName;

    return getVariableName(node.expression, name);
  }

  return 'undefined';
}