import {
  LiteralNode,
  MapDefinitionNode,
  OutcomeStatementNode,
} from '@superindustries/language';
import * as ts from 'typescript';

import { RETURN_CONSTRUCTS } from './constructs';
import {
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from './map-validator';
import {
  ArrayCollection,
  ObjectCollection,
  StructureType,
} from './profile-validator';

export function formatWarnings(_warnings?: ValidationWarning[]): string {
  return '';
}

export function formatErrors(errors?: ValidationError[]): string {
  if (!errors) {
    return 'Unknown error';
  }

  return errors
    .map(err => {
      const prefix = err.context?.path
        ? `[${err.context.path.join('.')}] `
        : '';

      switch (err.kind) {
        case 'wrongProfileID':
          return `${prefix}Wrong Profile ID: expected ${err.context.expected}, but got ${err.context.actual}`;

        case 'wrongUsecaseName':
          return `${prefix}Wrong Usecase Name: expected ${err.context.expected}, but got ${err.context.actual}`;

        case 'usecaseNotFound':
          return `${prefix}Usecase Not Found: expected ${err.context.expectedUseCase}, but got undefined`;

        case 'resultNotFound':
          return `${prefix}Result Not Found: expected ${err.context.actualResult}, but got undefined`;

        case 'inputNotFound':
          return `${prefix}Input Not Found: expected ${err.context.actualInput}, but got undefined`;

        case 'wrongObjectStructure':
          return `${prefix}Wrong Object Structure: expected ${Object.keys(
            err.context.expected
          ).join(', ')}, but got ${err.context.actual
            .map(val => val.key.join('.'))
            .join(', ')}`;

        case 'wrongArrayStructure':
          return `${prefix}Wrong Array Structure: expected ${Object.values(
            err.context.expected
          )
            .map(val =>
              val?.kind === 'PrimitiveStructure'
                ? val?.type
                : val?.kind === 'NonNullStructure'
                ? val.value.kind === 'PrimitiveStructure'
                  ? val.value.type
                  : val.value.kind
                : val?.kind
            )
            .join(' or ')}, but got "${err.context.actual
            .map(val =>
              val.kind === 'JessieExpression'
                ? val.expression
                : val.kind === 'PrimitiveLiteral'
                ? val.value
                : val.kind
            )
            .join(', ')}"`;

        case 'wrongStructure':
          return `${prefix}Wrong Structure: expected ${
            err.context.expected.kind === 'PrimitiveStructure'
              ? err.context.expected.type
              : err.context.expected.kind === 'NonNullStructure'
              ? err.context.expected.value.kind === 'PrimitiveStructure'
                ? err.context.expected.value.type
                : err.context.expected.value.kind
              : err.context.expected.kind
          }, but got "${
            typeof err.context.actual === 'string'
              ? err.context.actual
              : err.context.actual.kind === 'PrimitiveLiteral'
              ? err.context.actual.value
              : err.context.actual.kind
          }"`;

        case 'variableNotDefined':
          return `${prefix}Missing Variable definition: ${err.context.actualVariableName} not defined`;

        case 'conditionNotFulfilled':
          return `${prefix}Condition Not fulfilled: ${err.context.conditionExpression} failed`;

        case 'missingRequired':
          return `${prefix}Missing required field`;

        case 'resultNotDefined':
          return `${prefix}Result not defined`;

        default:
          throw new Error('Invalid error!');
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
  input: StructureType
): {
  isValid: boolean;
  newObjectCollection?: ObjectCollection;
  newArrayCollection?: ArrayCollection;
  newStructure?: StructureType;
  nonNull?: boolean;
} {
  switch (input.kind) {
    case 'NonNullStructure':
      if (input.value)
        return {
          nonNull: true,
          ...compareStructure(node, input.value),
        };
      break;

    case 'PrimitiveStructure':
      if (
        node.kind === 'PrimitiveLiteral' &&
        typeof node.value === input.type
      ) {
        return { isValid: true };
      }
      if (
        node.kind === 'JessieExpression' &&
        typeof eval(node.expression) === input.type
      ) {
        return { isValid: true };
      }
      break;

    case 'ListStructure':
      // TODO: no ArrayLiteral anymore
      if (node.kind === 'InlineCall') {
        if (input.value.kind === 'UnionStructure') {
          return {
            isValid: true,
            newArrayCollection: input.value.types,
          };
        }

        return { isValid: true, newStructure: input.value };
      }
      if (
        node.kind === 'JessieExpression' &&
        Array.isArray(eval(node.expression))
      ) {
        return { isValid: true, newArrayCollection: eval(node.expression) };
      }
      break;

    case 'ObjectStructure':
      if (node.kind === 'ObjectLiteral') {
        return { isValid: true, newObjectCollection: input.fields };
      }
      if (
        node.kind === 'JessieExpression' &&
        typeof eval(node.expression) === 'object'
      ) {
        return { isValid: true, newObjectCollection: eval(node.expression) };
      }
      break;
  }

  return { isValid: false };
}

/**
 * Walker function that predicates return structure.
 * @param expression string expression from JessieExpressionNode
 * @returns ValidationResult
 */
export const validateJessie = (
  expression: string,
  input: StructureType
): ValidationResult => {
  const errors: ValidationError[] = [];

  const rootNode = ts.createSourceFile(
    'scripts.js',
    expression,
    ts.ScriptTarget.ES2015,
    true,
    ts.ScriptKind.JS
  );

  function nodeVisitor<T extends ts.Node>(node: T): void {
    let isValid = false;
    const rule = RETURN_CONSTRUCTS[node.kind];

    if (!rule) {
      return node.forEachChild(nodeVisitor);
    }

    if (rule.predicate(node, input)) {
      isValid = true;
    }

    if (!isValid) {
      errors.push({
        kind: 'wrongStructure',
        context: { expected: input, actual: node.getText() },
      });
    }
  }

  nodeVisitor(rootNode);

  if (errors.length > 0) {
    return { pass: false, errors };
  }

  return { pass: true };
};

/**
 * TODO: refactor this
 * NOTE: will this function be needed?
 *
 * Since profile result can be mapped in multiple statements in multiple levels of tree,
 * we can check whether it contains any maping result or map does not contain any.
 */
export function findResult(
  _node: MapDefinitionNode | OutcomeStatementNode,
  _input: StructureType
): ValidationResult | undefined {
  // const error = {
  //   kind: 'resultNotDefined',
  //   context: { expectedResult: input },
  // };

  return undefined;
}
