import {
  AssignmentNode,
  ComlinkAssignmentNode,
  ComlinkLiteralNode,
  isCallStatementNode,
  isComlinkListLiteralNode,
  isComlinkPrimitiveLiteralNode,
  isHttpCallStatementNode,
  isObjectLiteralNode,
  isOutcomeStatementNode,
  isPrimitiveLiteralNode,
  isUseCaseDefinitionNode,
  LiteralNode,
  LocationSpan,
  MapASTNode,
  MapDefinitionNode,
  OperationDefinitionNode,
  OutcomeStatementNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import * as ts from 'typescript';

import { TypescriptIdentifier } from './constructs';
import { UseCaseSlotType, ValidationIssue } from './issue';
import { MapValidator, ValidationResult } from './map-validator';
import { ProfileIOAnalyzer } from './profile-io-analyzer';
import {
  ListStructure,
  ObjectStructure,
  ProfileOutput,
  StructureType,
  VersionStructure,
} from './profile-output';
import { isObjectStructure } from './profile-output.utils';

export function composeVersion(version: VersionStructure): string {
  return (
    `${version.major}.${version.minor}` +
    (version.patch !== undefined ? `.${version.patch}` : '') +
    (version.label ? `-${version.label}` : '')
  );
}

function formatPrimitive(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  }

  return value.toString();
}

function formatStructure(structure: StructureType | string): string {
  if (typeof structure === 'string') {
    return structure;
  }

  switch (structure.kind) {
    case 'EnumStructure':
      return structure.enums.map(enumValue => enumValue.value).join(' or ');
    case 'ListStructure':
      return `[${formatStructure(structure.value)}]`;
    case 'NonNullStructure':
      return `NonNull ${formatStructure(structure.value)}`;
    case 'ObjectStructure':
      return `{ ${Object.entries(structure.fields ?? [])
        .map(([key, type]) => `${key}: ${formatStructure(type)}`)
        .join(', ')} }`;
    case 'PrimitiveStructure':
      return structure.type;
    case 'ScalarStructure':
      return 'any';
    case 'UnionStructure':
      return structure.types.map(type => formatStructure(type)).join(' | ');
  }
}

function formatLiteral(
  literal:
    | LiteralNode
    | ComlinkLiteralNode
    | AssignmentNode
    | ComlinkAssignmentNode
    | string
): string {
  if (typeof literal === 'string') {
    return literal;
  }

  switch (literal.kind) {
    case 'PrimitiveLiteral':
    case 'ComlinkPrimitiveLiteral':
      return formatPrimitive(literal.value);
    case 'ObjectLiteral':
    case 'ComlinkObjectLiteral':
      return `{ ${literal.fields.map(formatLiteral).join(', ')} }`;
    case 'JessieExpression':
      return literal.source ?? literal.expression;
    case 'InlineCall':
      return `call ${literal.operationName}(${literal.arguments
        .map(formatLiteral)
        .join(', ')})`;
    case 'ComlinkListLiteral':
      return `[ ${literal.items.map(formatLiteral).join(', ')} ]`;

    case 'ComlinkAssignment':
    case 'Assignment':
      return `${literal.key.join('.')}: ${formatLiteral(literal.value)}`;
  }
}

export function formatIssueContext(issue: ValidationIssue): string {
  let expected;
  let actual;

  switch (issue.kind) {
    case 'wrongScope':
      return `Wrong Scope: expected ${
        issue.context.expected ?? 'no scope in profile'
      }, but got ${issue.context.actual ?? 'no scope in map'}`;

    case 'wrongProfileName':
      return `Wrong Profile Name: expected "${issue.context.expected}", but got "${issue.context.actual}"`;

    case 'wrongProfileVersion':
      return `Wrong Profile Version: expected "${composeVersion(
        issue.context.expected
      )}", but map requests "${composeVersion(issue.context.actual)}"`;

    case 'mapNotFound':
      return `Map not found: "${issue.context.expected}"`;

    case 'extraMapsFound':
      return `Extra Maps Found: "${issue.context.expected.join(
        ','
      )}", but got "${issue.context.actual.join(', ')}"`;

    case 'outcomeNotDefined':
      return `No ${issue.context.slot} outcome defined`;

    case 'useCaseSlotNotFound':
      actual = `${
        issue.context.expected === UseCaseSlotType.INPUT ? '' : 'returning '
      }"${formatLiteral(issue.context.actual)}"`;

      return `${issue.context.expected} Not Found: ${actual}, but there is no ${issue.context.expected} defined in usecase`;

    case 'wrongObjectStructure':
      expected = formatStructure(issue.context.expected);
      actual = formatLiteral(issue.context.actual);

      return `Wrong Object Structure: expected "${expected}", but got "${actual}"`;

    case 'wrongStructure':
      expected = formatStructure(issue.context.expected);
      actual = formatLiteral(issue.context.actual);

      return `Wrong Structure: expected "${expected}", but got "${actual}"`;

    case 'missingRequired':
      return 'Missing required field';

    case 'wrongInput':
      expected = formatStructure(issue.context.expected);
      actual = formatStructure(issue.context.actual);

      return `Wrong Input Structure: expected "${expected}", but got "${actual}"`;

    case 'wrongVariableStructure':
      expected = formatStructure(issue.context.expected);
      actual = formatLiteral(issue.context.actual);

      return `Wrong Variable Structure: variable ${
        issue.context.name
      } expected "${expected}", but got "${actual.toString()}"`;

    default:
      throw new Error('Invalid issue!');
  }
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues
    .map(issue => {
      const { kind, location } = issue.context.path;
      const path = location
        ? `${location.start.line}:${location.start.column} ${kind}`
        : kind;

      return `${path} - ${formatIssueContext(issue)}`;
    })
    .join('\n');
}

/**
 * Compares the node with profile output structure. The arguments represent the actual nested level in structure.
 * @param node represents LiteralNode
 * @param structure represent Result or Error and their descendent structure
 */
export function compareStructure(
  node: LiteralNode | ComlinkLiteralNode,
  structure: StructureType
): {
  isValid: boolean;
  objectStructure?: ObjectStructure;
  listStructure?: ListStructure;
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
        return { isValid: true, objectStructure: structure };
      }
      break;

    case 'ListStructure':
      if (isComlinkListLiteralNode(node)) {
        return { isValid: true, listStructure: structure };
      }
      break;

    case 'EnumStructure':
      if (
        (isPrimitiveLiteralNode(node) || isComlinkPrimitiveLiteralNode(node)) &&
        structure.enums.map(enumValue => enumValue.value).includes(node.value)
      ) {
        return { isValid: true };
      }
      break;

    case 'UnionStructure':
      for (const type of structure.types) {
        const compareResult = compareStructure(node, type);

        if (compareResult.isValid) {
          return compareResult;
        }
      }
  }

  return { isValid: false };
}

export function getOutcomes(
  node: MapDefinitionNode | OperationDefinitionNode,
  isErrorFilter?: boolean
): OutcomeStatementNode[] {
  const filterFunction = (input: MapASTNode): input is OutcomeStatementNode => {
    if (!isOutcomeStatementNode(input)) {
      return false;
    }

    if (isErrorFilter !== undefined && input.isError !== isErrorFilter) {
      return false;
    }

    return true;
  };

  const outcomes = node.statements
    .filter(filterFunction)
    .concat(
      node.statements
        .filter(isCallStatementNode)
        .flatMap(callStatement =>
          callStatement.statements.filter(filterFunction)
        )
    )
    .concat(
      node.statements
        .filter(isHttpCallStatementNode)
        .flatMap(httpCall =>
          httpCall.responseHandlers.flatMap(responseHandler =>
            responseHandler.statements.filter(filterFunction)
          )
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

export type UseCaseInfo = {
  name: string;
  safety?: 'safe' | 'unsafe' | 'idempotent';
};
export const getProfileUsecases = (
  profile: ProfileDocumentNode
): UseCaseInfo[] => {
  return profile.definitions
    .filter(isUseCaseDefinitionNode)
    .map(definition => ({
      name: definition.useCaseName,
      safety: definition.safety,
    }));
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

export const buildAssignment = (
  key: string[],
  value: LiteralNode,
  location?: LocationSpan
): AssignmentNode => ({ kind: 'Assignment', key, value, location });
