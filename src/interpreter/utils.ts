import {
  AssignmentNode,
  AstMetadata,
  ComlinkAssignmentNode,
  ComlinkListLiteralNode,
  ComlinkLiteralNode,
  ComlinkObjectLiteralNode,
  ComlinkPrimitiveLiteralNode,
  isCallStatementNode,
  isHttpCallStatementNode,
  isOutcomeStatementNode,
  isUseCaseDefinitionNode,
  LiteralNode,
  LocationSpan,
  MapASTNode,
  MapDefinitionNode,
  ObjectLiteralNode,
  OperationDefinitionNode,
  OutcomeStatementNode,
  PrimitiveLiteralNode,
  ProfileASTNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import * as ts from 'typescript';

import { PARSED_AST_VERSION, PARSED_VERSION } from '../metadata';
import { TypescriptIdentifier } from './constructs';
import { ExampleValidator } from './example-validator';
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
      return `${formatStructure(structure.value)}!`;
    case 'ObjectStructure':
      return `{${Object.entries(structure.fields ?? [])
        .map(([key, type]) => `${key}: ${formatStructure(type)}`)
        .join(', ')}}`;
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
    case 'ComlinkNoneLiteral':
      return 'None';
    case 'ObjectLiteral':
    case 'ComlinkObjectLiteral':
      return `{${literal.fields.map(formatLiteral).join(', ')}}`;
    case 'JessieExpression':
      return literal.source ?? literal.expression;
    case 'InlineCall':
      return `call ${literal.operationName}(${literal.arguments
        .map(formatLiteral)
        .join(', ')})`;
    case 'ComlinkListLiteral':
      return `[${literal.items.map(formatLiteral).join(', ')}]`;

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
      return `Wrong Scope: expected ${issue.context.expected ?? 'no scope in profile'
        }, but got ${issue.context.actual ?? 'no scope in map'}`;

    case 'wrongProfileName':
      return `Wrong Profile Name: expected "${issue.context.expected}", but got "${issue.context.actual}"`;

    case 'wrongProfileVersion':
      return `Version does not match: expected "${composeVersion(
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
      actual = `${issue.context.expected === UseCaseSlotType.INPUT ? '' : 'returning '
        }${formatLiteral(issue.context.actual)}`;

      return `${issue.context.expected} Not Found: ${actual}, but there is no ${issue.context.expected} defined in usecase`;

    case 'wrongObjectStructure':
      expected = formatStructure(issue.context.expected);
      actual = formatLiteral(issue.context.actual);

      return `Wrong Object Structure: expected ${expected}, but got ${actual}`;

    case 'wrongStructure':
      expected = formatStructure(issue.context.expected);
      actual = formatLiteral(issue.context.actual);

      return `Wrong Structure: expected ${expected}, but got ${actual}`;

    case 'missingRequired':
      return 'Missing required field';

    case 'wrongInput':
      expected = formatStructure(issue.context.expected);
      actual = formatStructure(issue.context.actual);

      return `Wrong Input Structure: expected ${expected}, but got ${actual}`;

    case 'wrongVariableStructure':
      expected = formatStructure(issue.context.expected);
      actual = formatLiteral(issue.context.actual);

      return `Wrong Variable Structure: variable ${issue.context.name} expected ${expected}, but got ${actual}`;

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

export function validatePrimitiveLiteral(
  structure: StructureType,
  node: PrimitiveLiteralNode | ComlinkPrimitiveLiteralNode
): { isValid: boolean } {
  if (
    structure.kind === 'PrimitiveStructure' &&
    typeof node.value === structure.type
  ) {
    return { isValid: true };
  }

  if (
    structure.kind === 'EnumStructure' &&
    structure.enums.find(enumValue => enumValue.value === node.value) !==
    undefined
  ) {
    return { isValid: true };
  }

  if (structure.kind === 'UnionStructure') {
    for (const type of structure.types) {
      const result = validatePrimitiveLiteral(type, node);

      if (result.isValid) {
        return result;
      }
    }
  }

  return { isValid: false };
}

export function validateObjectLiteral(
  structure: StructureType,
  node: ObjectLiteralNode | ComlinkObjectLiteralNode
):
  | { isValid: true; objectStructure: ObjectStructure }
  | { isValid: false; objectStructure?: undefined } {
  if (structure.kind === 'ObjectStructure') {
    return { isValid: true, objectStructure: structure };
  }

  if (structure.kind === 'UnionStructure') {
    for (const type of structure.types) {
      const result = validateObjectLiteral(type, node);

      if (result.isValid) {
        return result;
      }
    }
  }

  return { isValid: false };
}

export function validateListLiteral(
  structure: StructureType,
  node: ComlinkListLiteralNode
):
  | { isValid: true; listStructure: ListStructure }
  | { isValid: false; listStructure?: undefined } {
  if (structure.kind === 'ListStructure') {
    return { isValid: true, listStructure: structure };
  }

  if (structure.kind === 'UnionStructure') {
    for (const type of structure.types) {
      const result = validateListLiteral(type, node);

      if (result.isValid) {
        return result;
      }
    }
  }

  return { isValid: false };
}

export function validateNoneLiteral(structure: StructureType): { isValid: boolean } {
  if (structure.kind === 'NonNullStructure') {
    return { isValid: false };
  }

  return { isValid: true }
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

export const validateExamples = (
  profileAst: ProfileASTNode,
  profileOutput?: ProfileOutput
): ValidationResult => {
  const exampleValidator = new ExampleValidator(profileAst, profileOutput);

  return exampleValidator.validate();
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


type AccessKey = { kind: 'AccessKey', key: string };
type AccessKeyError = { kind: 'AccessKeyError', message: string }
type AccessKeyResult = AccessKey | AccessKeyError;

export function isAccessKey(accessKey: AccessKeyResult): accessKey is AccessKey {
  return accessKey.kind === 'AccessKey';
}

export function isAccessKeyError(accessKey: AccessKeyResult): accessKey is AccessKeyError {
  return accessKey.kind === 'AccessKeyError';
}

export function getAccessKey(
  node: ts.Identifier | ts.AccessExpression | ts.LeftHandSideExpression
): AccessKeyResult {
  if (ts.isIdentifier(node)) {
    return { kind: 'AccessKey', key: node.text };
  }

  if (ts.isStringLiteral(node)) {
    return { kind: 'AccessKey', key: node.text };
  }

  if (ts.isPropertyAccessExpression(node)) {
    const expression = getAccessKey(node.expression);
    const name = getAccessKey(node.name);

    if (isAccessKeyError(expression)) {
      return expression;
    }

    if (isAccessKeyError(name)) {
      return name;
    }

    return { kind: 'AccessKey', key: `${expression.key}.${name.key}` };
  }

  if (ts.isElementAccessExpression(node)) {
    if (ts.isLiteralExpression(node.argumentExpression)) {
      const expression = getAccessKey(node.expression);
      const argumentExpression = getAccessKey(node.argumentExpression);

      if (isAccessKeyError(expression)) {
        return expression;
      }

      if (isAccessKeyError(argumentExpression)) {
        return argumentExpression;
      }

      return { kind: 'AccessKey', key: `${expression.key}.${argumentExpression.key}` };
    }

    return { kind: 'AccessKeyError', message: "Access key with dynamic part can't be resolved" }
  }

  return { kind: 'AccessKeyError', message: `${node.kind} is not supported as access key` };
}

export const buildAssignment = (
  key: string[],
  value: LiteralNode,
  location?: LocationSpan
): AssignmentNode => ({ kind: 'Assignment', key, value, location });

export function isCompatible(metadata: AstMetadata): boolean {
  // check ast versions
  if (metadata.astVersion.major !== PARSED_AST_VERSION.major) {
    return false;
  }

  // check parser versions
  if (metadata.parserVersion.major !== PARSED_VERSION.major) {
    return false;
  }

  return true;
}
