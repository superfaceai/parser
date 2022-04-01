import * as ts from 'typescript';

import { CharIndexSpan } from '../common/source';
import { UseCaseSlotType } from '.';
import { ValidationIssue } from './issue';
import {
  ArrayCollection,
  ObjectStructure,
  StructureType,
} from './profile-output';
import {
  isBooleanStructure,
  isEnumStructure,
  isListStructure,
  isNonNullStructure,
  isNumberStructure,
  isObjectStructure,
  isPrimitiveStructure,
  isScalarStructure,
  isStringStructure,
  isUnionStructure,
} from './profile-output.utils';
import {
  findTypescriptIdentifier,
  findTypescriptProperty,
  getVariableName,
  validateObjectStructure,
} from './utils';

export type TypescriptIdentifier =
  | ts.Identifier
  | ts.PropertyAccessExpression
  | ts.ElementAccessExpression;

export type ReferencedVariables = {
  jessieNode: TypescriptIdentifier;
  type: StructureType;
};

export type RelativeValidationIssue = ValidationIssue & {
  context: { path: { relativeSpan: CharIndexSpan } };
};
export type ConstructResult = {
  variables?: ReferencedVariables[];
  invalidInput: boolean;
  invalidOutput: boolean;
} & (
  | { pass: true; warnings: RelativeValidationIssue[] }
  | {
      pass: false;
      warnings: RelativeValidationIssue[];
      errors: RelativeValidationIssue[];
    }
);

export interface VisitConstruct<T extends ts.Node = ts.Node> {
  visit(
    node: T,
    outputStructure?: StructureType,
    inputStructure?: ObjectStructure,
    isOutcomeWithCondition?: boolean
  ): ConstructResult;
}

const VALID_CONSTRUCT_RESULT: ConstructResult = {
  pass: true,
  invalidInput: false,
  invalidOutput: false,
  warnings: [],
};

function mergeResults(...results: ConstructResult[]): ConstructResult {
  return results.reduce((acc: ConstructResult, val: ConstructResult) => {
    const pass = acc.pass && val.pass;
    const errors = [
      ...(!acc.pass ? acc.errors : []),
      ...(!val.pass ? val.errors : []),
    ];
    const warnings = [...(acc.warnings ?? []), ...(val.warnings ?? [])];
    const variables = [...(acc.variables ?? []), ...(val.variables ?? [])];
    const invalidInput = acc.invalidInput || val.invalidInput;
    const invalidOutput = acc.invalidOutput || val.invalidOutput;

    return pass
      ? {
          pass,
          warnings,
          variables,
          invalidInput,
          invalidOutput,
        }
      : {
          pass,
          errors,
          warnings,
          variables,
          invalidInput,
          invalidOutput,
        };
  }, VALID_CONSTRUCT_RESULT);
}

function getPath(node: ts.Node): { kind: string; relativeSpan: CharIndexSpan } {
  return {
    kind: ts.SyntaxKind[node.kind],
    relativeSpan: { start: node.getStart(), end: node.getEnd() },
  };
}

function isTypescriptIdentifier(node: ts.Node): node is TypescriptIdentifier {
  return (
    (ts.isIdentifier(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)) &&
    getVariableName(node) !== 'undefined'
  );
}

function compareStructures(
  node: ts.Node,
  inputStructure: StructureType,
  outputStructure: StructureType
): ConstructResult {
  if (isNonNullStructure(outputStructure)) {
    outputStructure = outputStructure.value;
  }
  if (isNonNullStructure(inputStructure)) {
    inputStructure = inputStructure.value;
  }

  if (isScalarStructure(outputStructure) || isScalarStructure(inputStructure)) {
    return VALID_CONSTRUCT_RESULT;
  }

  if (
    isEnumStructure(outputStructure) &&
    isEnumStructure(inputStructure) &&
    outputStructure.enums === inputStructure.enums
  ) {
    return VALID_CONSTRUCT_RESULT;
  }

  if (
    isListStructure(outputStructure) &&
    isListStructure(inputStructure) &&
    outputStructure.value === inputStructure.value
  ) {
    return VALID_CONSTRUCT_RESULT;
  }

  if (
    isObjectStructure(outputStructure) &&
    isObjectStructure(inputStructure) &&
    outputStructure.fields === inputStructure.fields
  ) {
    return VALID_CONSTRUCT_RESULT;
  }

  if (
    isPrimitiveStructure(outputStructure) &&
    isPrimitiveStructure(inputStructure) &&
    outputStructure.type === inputStructure.type
  ) {
    return VALID_CONSTRUCT_RESULT;
  }

  if (
    isUnionStructure(outputStructure) &&
    isUnionStructure(inputStructure) &&
    outputStructure.types === inputStructure.types
  ) {
    return VALID_CONSTRUCT_RESULT;
  }

  return {
    pass: false,
    errors: [
      {
        kind: 'wrongInput',
        context: {
          path: getPath(node),
          expected: outputStructure,
          actual: inputStructure,
        },
      },
    ],
    warnings: [],
    invalidInput: false,
    invalidOutput: true,
  };
}

export function visitConstruct(
  node: ts.Node,
  outputStructure?: StructureType,
  inputStructure?: ObjectStructure,
  isOutcomeWithCondition?: boolean,
  construct?: VisitConstruct
): ConstructResult {
  return construct
    ? construct.visit(
        node,
        outputStructure,
        inputStructure,
        isOutcomeWithCondition
      )
    : VALID_CONSTRUCT_RESULT;
}

function returnIssue(
  issue: RelativeValidationIssue,
  invalidInput: boolean,
  invalidOutput: boolean,
  isOutcomeWithCondition?: boolean
): ConstructResult {
  return isOutcomeWithCondition
    ? {
        pass: true,
        warnings: [issue],
        invalidInput,
        invalidOutput,
      }
    : {
        pass: false,
        warnings: [],
        errors: [issue],
        invalidInput,
        invalidOutput,
      };
}

function getFieldStructure(
  property: string,
  node: ts.LeftHandSideExpression,
  objectStructure: ObjectStructure
): StructureType | undefined {
  if (ts.isIdentifier(node)) {
    if (!objectStructure.fields) {
      throw new Error('Validated object structure does not contain fields');
    }

    return objectStructure.fields[property];
  } else if (ts.isPropertyAccessExpression(node)) {
    let structure = validateObjectStructure(node, objectStructure);

    if (structure && isNonNullStructure(structure)) {
      structure = structure.value;
    }

    if (!structure || !isObjectStructure(structure) || !structure.fields) {
      return undefined;
    }

    return structure.fields[property];
  }

  return undefined;
}

export const RETURN_CONSTRUCTS: {
  [kind in ts.SyntaxKind]?: VisitConstruct;
} = {
  [ts.SyntaxKind.StringLiteral]: {
    visit: (
      node: ts.StringLiteral,
      outputStructure?: StructureType,
      _inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult => {
      if (!outputStructure) {
        return VALID_CONSTRUCT_RESULT;
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      // TODO: take `UnionStructure` in consideration
      if (
        isScalarStructure(outputStructure) ||
        isStringStructure(outputStructure)
      ) {
        return VALID_CONSTRUCT_RESULT;
      }

      if (isEnumStructure(outputStructure)) {
        const enumValues = outputStructure.enums.map(value => value.value);

        if (enumValues.includes(node.text)) {
          return VALID_CONSTRUCT_RESULT;
        }
      }

      return returnIssue(
        {
          kind: 'wrongStructure',
          context: {
            path: getPath(node),
            actual: node.text,
            expected: outputStructure,
          },
        },
        false,
        true,
        isOutcomeWithCondition
      );
    },
  },

  [ts.SyntaxKind.NumericLiteral]: {
    visit: (
      node: ts.NumericLiteral,
      outputStructure?: StructureType,
      _inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult => {
      if (!outputStructure) {
        return VALID_CONSTRUCT_RESULT;
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      // TODO: take `UnionStructure` in consideration
      if (
        isScalarStructure(outputStructure) ||
        isNumberStructure(outputStructure)
      ) {
        return VALID_CONSTRUCT_RESULT;
      }

      return returnIssue(
        {
          kind: 'wrongStructure',
          context: {
            path: getPath(node),
            actual: node.text,
            expected: outputStructure,
          },
        },
        false,
        true,
        isOutcomeWithCondition
      );
    },
  },

  [ts.SyntaxKind.FalseKeyword]: {
    visit: (
      node: ts.FalseLiteral,
      outputStructure?: StructureType,
      _inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult => {
      if (!outputStructure) {
        return VALID_CONSTRUCT_RESULT;
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      // TODO: take `UnionStructure` in consideration
      if (
        isScalarStructure(outputStructure) ||
        (isPrimitiveStructure(outputStructure) &&
          isBooleanStructure(outputStructure))
      ) {
        return VALID_CONSTRUCT_RESULT;
      }

      return returnIssue(
        {
          kind: 'wrongStructure',
          context: {
            path: getPath(node),
            actual: 'false',
            expected: outputStructure,
          },
        },
        false,
        true,
        isOutcomeWithCondition
      );
    },
  },

  [ts.SyntaxKind.TrueKeyword]: {
    visit: (
      node: ts.TrueLiteral,
      outputStructure?: StructureType,
      _inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult => {
      if (!outputStructure) {
        return VALID_CONSTRUCT_RESULT;
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      // TODO: take `UnionStructure` in consideration
      if (
        isScalarStructure(outputStructure) ||
        (isPrimitiveStructure(outputStructure) &&
          isBooleanStructure(outputStructure))
      ) {
        return VALID_CONSTRUCT_RESULT;
      }

      return returnIssue(
        {
          kind: 'wrongStructure',
          context: {
            path: getPath(node),
            actual: 'true',
            expected: outputStructure,
          },
        },
        false,
        true,
        isOutcomeWithCondition
      );
    },
  },

  [ts.SyntaxKind.NullKeyword]: {
    visit: (
      node: ts.NullLiteral,
      outputStructure?: StructureType,
      _inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult => {
      if (!outputStructure) {
        return VALID_CONSTRUCT_RESULT;
      }
      if (isNonNullStructure(outputStructure)) {
        return returnIssue(
          {
            kind: 'wrongStructure',
            context: {
              path: getPath(node),
              actual: 'null',
              expected: outputStructure,
            },
          },
          false,
          true,
          isOutcomeWithCondition
        );
      }

      return VALID_CONSTRUCT_RESULT;
    },
  },

  [ts.SyntaxKind.BinaryExpression]: {
    visit: (
      node: ts.BinaryExpression,
      outputStructure?: StructureType,
      inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult => {
      const results: ConstructResult[] = [];

      // if Input is defined - check ids in children nodes
      if (inputStructure) {
        if (isTypescriptIdentifier(node.left)) {
          results.push(
            visitConstruct(
              node.left,
              undefined,
              inputStructure,
              isOutcomeWithCondition,
              RETURN_CONSTRUCTS[node.left.kind]
            )
          );
        }
        if (isTypescriptIdentifier(node.right)) {
          results.push(
            visitConstruct(
              node.right,
              undefined,
              inputStructure,
              isOutcomeWithCondition,
              RETURN_CONSTRUCTS[node.right.kind]
            )
          );
        }
      }

      // if Output is not defined - do not check validation of result or error
      if (!outputStructure) {
        return mergeResults(...results);
      }

      // if Output is defined - do check
      if (isNonNullStructure(outputStructure)) {
        if (isScalarStructure(outputStructure.value)) {
          return mergeResults(...results);
        }
      }

      if (isScalarStructure(outputStructure)) {
        return mergeResults(...results);
      }

      results.push(
        visitConstruct(
          node.left,
          outputStructure,
          undefined,
          isOutcomeWithCondition,
          RETURN_CONSTRUCTS[node.left.kind]
        ),
        visitConstruct(
          node.right,
          outputStructure,
          undefined,
          isOutcomeWithCondition,
          RETURN_CONSTRUCTS[node.right.kind]
        )
      );

      return mergeResults(...results);
    },
  },

  [ts.SyntaxKind.Identifier]: {
    visit: (
      node: ts.Identifier,
      outputStructure?: StructureType,
      inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult => {
      if (node.text === 'input') {
        if (!inputStructure || !inputStructure.fields) {
          return returnIssue(
            {
              kind: 'useCaseSlotNotFound',
              context: {
                path: getPath(node),
                expected: UseCaseSlotType.INPUT,
                actual: getVariableName(node),
              },
            },
            true,
            false,
            isOutcomeWithCondition
          );
        }

        if (outputStructure) {
          return compareStructures(node, inputStructure, outputStructure);
        }

        return VALID_CONSTRUCT_RESULT;
      }

      const variables: ReferencedVariables[] = [];
      if (outputStructure && !isScalarStructure(outputStructure)) {
        if (node.text === 'undefined') {
          if (isNonNullStructure(outputStructure)) {
            return returnIssue(
              {
                kind: 'wrongStructure',
                context: {
                  path: getPath(node),
                  actual: getVariableName(node),
                  expected: outputStructure.value,
                },
              },
              false,
              true,
              isOutcomeWithCondition
            );
          } else {
            return VALID_CONSTRUCT_RESULT;
          }
        }

        variables.push({
          jessieNode: node,
          type: outputStructure,
        });
      }

      return {
        ...VALID_CONSTRUCT_RESULT,
        variables,
      };
    },
  },

  [ts.SyntaxKind.PropertyAccessExpression]: {
    visit(
      node: ts.PropertyAccessExpression,
      outputStructure?: StructureType,
      inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult {
      if (findTypescriptIdentifier('input', node.expression)) {
        if (findTypescriptProperty('auth', node.expression)) {
          return VALID_CONSTRUCT_RESULT;
        }

        if (!inputStructure || !inputStructure.fields) {
          return returnIssue(
            {
              kind: 'useCaseSlotNotFound',
              context: {
                path: getPath(node),
                expected: UseCaseSlotType.INPUT,
                actual: getVariableName(node),
              },
            },
            true,
            false,
            isOutcomeWithCondition
          );
        }

        const issue: RelativeValidationIssue = {
          kind: 'wrongInput',
          context: {
            path: getPath(node),
            expected: inputStructure,
            actual: getVariableName(node),
          },
        };

        const property = node.name.text;
        const fieldValue = getFieldStructure(
          property,
          node.expression,
          inputStructure
        );

        if (!fieldValue) {
          return returnIssue(issue, true, false, isOutcomeWithCondition);
        }

        if (outputStructure) {
          return compareStructures(node, fieldValue, outputStructure);
        }

        return VALID_CONSTRUCT_RESULT;
      }

      const variables: ReferencedVariables[] = [];
      if (outputStructure && !isScalarStructure(outputStructure)) {
        variables.push({
          jessieNode: node,
          type: outputStructure,
        });
      }

      return {
        ...VALID_CONSTRUCT_RESULT,
        variables,
      };
    },
  },

  [ts.SyntaxKind.ElementAccessExpression]: {
    visit(
      node: ts.ElementAccessExpression,
      outputStructure?: StructureType,
      inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult {
      if (findTypescriptIdentifier('input', node.expression)) {
        if (findTypescriptProperty('auth', node.expression)) {
          return VALID_CONSTRUCT_RESULT;
        }

        if (!inputStructure || !inputStructure.fields) {
          const issue: RelativeValidationIssue = {
            kind: 'useCaseSlotNotFound',
            context: {
              path: getPath(node),
              expected: UseCaseSlotType.INPUT,
              actual: getVariableName(node),
            },
          };

          return returnIssue(issue, true, false, isOutcomeWithCondition);
        }

        const issue: RelativeValidationIssue = {
          kind: 'wrongInput',
          context: {
            path: getPath(node),
            expected: inputStructure,
            actual: getVariableName(node),
          },
        };

        const property = (node.argumentExpression as ts.Identifier).text;
        const fieldValue = getFieldStructure(
          property,
          node.expression,
          inputStructure
        );

        if (!fieldValue) {
          return returnIssue(issue, true, false, isOutcomeWithCondition);
        }

        if (outputStructure) {
          return compareStructures(node, fieldValue, outputStructure);
        }

        return VALID_CONSTRUCT_RESULT;
      }

      const variables: ReferencedVariables[] = [];
      if (outputStructure && !isScalarStructure(outputStructure)) {
        variables.push({
          jessieNode: node,
          type: outputStructure,
        });
      }

      return {
        ...VALID_CONSTRUCT_RESULT,
        variables,
      };
    },
  },

  [ts.SyntaxKind.ObjectLiteralExpression]: {
    visit(
      node: ts.ObjectLiteralExpression,
      outputStructure?: StructureType,
      inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult {
      const results: ConstructResult[] = [];

      // object should only contain property assignments
      const properties = node.properties.filter(ts.isPropertyAssignment);

      if (inputStructure) {
        for (const property of properties) {
          if (isTypescriptIdentifier(property.initializer)) {
            results.push(
              visitConstruct(
                property.initializer,
                undefined,
                inputStructure,
                isOutcomeWithCondition,
                RETURN_CONSTRUCTS[property.initializer.kind]
              )
            );
          }
        }
      }

      if (!outputStructure) {
        return mergeResults(...results);
      }

      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }

      if (isScalarStructure(outputStructure)) {
        return mergeResults(...results);
      }

      // TODO: take `UnionStructure` in consideration
      if (!isObjectStructure(outputStructure)) {
        const issue: RelativeValidationIssue = {
          kind: 'wrongStructure',
          context: {
            path: getPath(node),
            actual: node.getText(),
            expected: outputStructure,
          },
        };

        return mergeResults(
          ...results,
          returnIssue(issue, false, true, isOutcomeWithCondition)
        );
      }

      const structureOfProperties = outputStructure.fields;

      if (properties.length === 0 && !structureOfProperties) {
        return VALID_CONSTRUCT_RESULT;
      }

      if (!structureOfProperties) {
        throw new Error('Validated object structure does not contain fields');
      }

      // all fields
      const profileProperties = Object.entries(structureOfProperties);
      const profilePropertyNames = Object.keys(structureOfProperties);
      const mapPropertyNames = properties.map(
        property => (property.name as ts.Identifier).text
      );

      // required fields
      const requiredProperties = profileProperties.filter(
        ([, value]) => value.required
      );
      const requiredPropertiesNotFound = requiredProperties.filter(
        ([key]) => !mapPropertyNames.includes(key)
      );

      // fields found inside node
      const matchingProperties = properties.filter(property =>
        profilePropertyNames.includes((property.name as ts.Identifier).text)
      );
      const extraProperties = properties.filter(
        property =>
          !profilePropertyNames.includes((property.name as ts.Identifier).text)
      );

      for (const property of matchingProperties) {
        results.push(
          visitConstruct(
            property.initializer,
            structureOfProperties[(property.name as ts.Identifier).text],
            undefined,
            isOutcomeWithCondition,
            RETURN_CONSTRUCTS[property.initializer.kind]
          )
        );
      }

      for (const [key] of requiredPropertiesNotFound) {
        const issue: RelativeValidationIssue = {
          kind: 'missingRequired',
          context: {
            path: getPath(node),
            expected: key,
          },
        };

        results.push(returnIssue(issue, false, true, isOutcomeWithCondition));
      }

      if (extraProperties.length > 0) {
        const issue: RelativeValidationIssue = {
          kind: 'wrongObjectStructure',
          context: {
            path: getPath(node),
            expected: outputStructure,
            actual: node.getText(),
          },
        };

        results.push(returnIssue(issue, false, false, true));
      }

      return mergeResults(...results);
    },
  },

  [ts.SyntaxKind.ArrayLiteralExpression]: {
    visit(
      node: ts.ArrayLiteralExpression,
      outputStructure?: StructureType,
      inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult {
      const results: ConstructResult[] = [];

      if (inputStructure) {
        for (const element of node.elements) {
          if (isTypescriptIdentifier(element))
            results.push(
              visitConstruct(
                element,
                undefined,
                inputStructure,
                isOutcomeWithCondition,
                RETURN_CONSTRUCTS[element.kind]
              )
            );
        }
      }

      if (!outputStructure) {
        return mergeResults(...results);
      }

      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }

      if (isScalarStructure(outputStructure)) {
        return mergeResults(...results);
      }

      const wrongStructureIssue: RelativeValidationIssue = {
        kind: 'wrongStructure',
        context: {
          path: getPath(node),
          actual: node.getText(),
          expected: outputStructure,
        },
      };

      // TODO: take `UnionStructure` in consideration
      if (!isListStructure(outputStructure)) {
        return mergeResults(
          ...results,
          returnIssue(wrongStructureIssue, false, true, isOutcomeWithCondition)
        );
      }

      let structureOfTypes: ArrayCollection | undefined;
      let structureOfType: StructureType | undefined;

      if (isUnionStructure(outputStructure.value)) {
        structureOfTypes = outputStructure.value.types;
      } else {
        structureOfType = outputStructure.value;
      }

      if (structureOfType) {
        for (const element of node.elements) {
          results.push(
            visitConstruct(
              element,
              structureOfType,
              undefined,
              isOutcomeWithCondition,
              RETURN_CONSTRUCTS[element.kind]
            )
          );
        }

        return mergeResults(...results);
      }

      if (!structureOfTypes) {
        throw new Error('Validated types in list structure are not defined');
      }

      for (const element of node.elements) {
        if (isTypescriptIdentifier(element)) {
          results.push(
            visitConstruct(
              element,
              outputStructure.value,
              undefined,
              isOutcomeWithCondition,
              RETURN_CONSTRUCTS[element.kind]
            )
          );
          continue;
        }

        let diff = 0;

        for (const value of structureOfTypes) {
          const result = visitConstruct(
            element,
            value,
            undefined,
            isOutcomeWithCondition,
            RETURN_CONSTRUCTS[element.kind]
          );

          if (!result.pass) {
            diff++;
          }
        }

        if (diff === structureOfTypes.length) {
          results.push(
            returnIssue(
              wrongStructureIssue,
              false,
              true,
              isOutcomeWithCondition
            )
          );
        }
      }

      return mergeResults(...results, VALID_CONSTRUCT_RESULT);
    },
  },

  [ts.SyntaxKind.ParenthesizedExpression]: {
    visit(
      node: ts.ParenthesizedExpression,
      outputStructure?: StructureType,
      inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult {
      return visitConstruct(
        node.expression,
        outputStructure,
        inputStructure,
        isOutcomeWithCondition,
        RETURN_CONSTRUCTS[node.expression.kind]
      );
    },
  },

  [ts.SyntaxKind.ExpressionStatement]: {
    visit(
      node: ts.ExpressionStatement,
      outputStructure?: StructureType,
      inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult {
      return visitConstruct(
        node.expression,
        outputStructure,
        inputStructure,
        isOutcomeWithCondition,
        RETURN_CONSTRUCTS[node.expression.kind]
      );
    },
  },

  [ts.SyntaxKind.SourceFile]: {
    visit(
      node: ts.SourceFile,
      outputStructure?: StructureType,
      inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult {
      const statement = node.statements[node.statements.length - 1];

      return visitConstruct(
        statement,
        outputStructure,
        inputStructure,
        isOutcomeWithCondition,
        RETURN_CONSTRUCTS[statement.kind]
      );
    },
  },
};
