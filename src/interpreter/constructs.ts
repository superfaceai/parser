import * as ts from 'typescript';

import { ValidationIssue } from './issue';
import { ValidationResult } from './map-validator';
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

export type ConstructResult = ValidationResult & {
  variables?: ReferencedVariables[];
  invalidInput: boolean;
  invalidOutput: boolean;
};

export interface VisitConstruct<T extends ts.Node = ts.Node> {
  visit(
    node: T,
    outputStructure?: StructureType,
    inputStructure?: ObjectStructure,
    isOutcomeWithCondition?: boolean
  ): ConstructResult;
  visitInput?(
    node: ts.PropertyAccessExpression,
    structure: ObjectStructure
  ): StructureType | undefined;
}

function mergeResults(...results: ConstructResult[]): ConstructResult {
  return results.reduce(
    (acc: ConstructResult, val: ConstructResult) => {
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
    },
    { pass: true, invalidInput: false, invalidOutput: false }
  );
}

function getPath(node: ts.Node): string[] {
  return [`${node.getStart()}:${node.getEnd()}`, ts.SyntaxKind[node.kind]];
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
    return { pass: true, invalidInput: false, invalidOutput: false };
  }

  switch (outputStructure.kind) {
    case 'EnumStructure':
      if (
        isEnumStructure(inputStructure) &&
        outputStructure.enums === inputStructure.enums
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      break;
    case 'ListStructure':
      if (
        isListStructure(inputStructure) &&
        outputStructure.value === inputStructure.value
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      break;
    case 'ObjectStructure':
      if (
        isObjectStructure(inputStructure) &&
        outputStructure.fields === inputStructure.fields
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      break;
    case 'PrimitiveStructure':
      if (
        isPrimitiveStructure(inputStructure) &&
        outputStructure.type === inputStructure.type
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      break;
    case 'UnionStructure':
      if (
        isUnionStructure(inputStructure) &&
        outputStructure.types === inputStructure.types
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      break;
  }

  return {
    pass: false,
    errors: [
      {
        kind: 'wrongStructure',
        context: {
          path: getPath(node),
          expected: outputStructure,
          actual: inputStructure,
        },
      },
    ],
    invalidInput: false,
    invalidOutput: true,
  };
}

function visitConstruct(
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
    : { pass: true, invalidInput: false, invalidOutput: false };
}

function returnIssue(
  issue: ValidationIssue,
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
      throw new Error('This should not happen!');
    }

    return objectStructure.fields[property];
  } else if (ts.isPropertyAccessExpression(node)) {
    const structure = validateObjectStructure(node, objectStructure);

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
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      if (
        isScalarStructure(outputStructure) ||
        (isPrimitiveStructure(outputStructure) &&
          isStringStructure(outputStructure))
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
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
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      if (
        isScalarStructure(outputStructure) ||
        (isPrimitiveStructure(outputStructure) &&
          isNumberStructure(outputStructure))
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
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
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      if (
        isScalarStructure(outputStructure) ||
        (isPrimitiveStructure(outputStructure) &&
          isBooleanStructure(outputStructure))
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
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
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      if (
        isScalarStructure(outputStructure) ||
        (isPrimitiveStructure(outputStructure) &&
          isBooleanStructure(outputStructure))
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
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
        return { pass: true, invalidInput: false, invalidOutput: false };
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

      return { pass: true, invalidInput: false, invalidOutput: false };
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
              node,
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
        outputStructure = outputStructure.value;
      }

      if (isScalarStructure(outputStructure)) {
        return mergeResults(...results);
      }

      const issue: ValidationIssue = {
        kind: 'wrongStructure',
        context: {
          path: getPath(node),
          actual: node.getText(),
          expected: outputStructure,
        },
      };

      if (
        isPrimitiveStructure(outputStructure) &&
        isBooleanStructure(outputStructure)
      ) {
        return mergeResults(
          ...results,
          returnIssue(issue, false, true, isOutcomeWithCondition)
        );
      }

      const nodeContainsString =
        ts.isStringLiteral(node.left) || ts.isStringLiteral(node.right);
      const nodeContainsID =
        isTypescriptIdentifier(node.left) || isTypescriptIdentifier(node.right);

      if (isTypescriptIdentifier(node.left)) {
        results.push(
          visitConstruct(
            node.left,
            outputStructure,
            undefined,
            isOutcomeWithCondition,
            RETURN_CONSTRUCTS[node.left.kind]
          )
        );
      }

      if (isTypescriptIdentifier(node.right)) {
        results.push(
          visitConstruct(
            node.right,
            outputStructure,
            undefined,
            isOutcomeWithCondition,
            RETURN_CONSTRUCTS[node.left.kind]
          )
        );
      }

      if (
        isPrimitiveStructure(outputStructure) &&
        isStringStructure(outputStructure) &&
        (nodeContainsString || nodeContainsID) &&
        node.operatorToken.getText() === '+'
      ) {
        return mergeResults(...results, {
          pass: true,
          invalidInput: false,
          invalidOutput: false,
        });
      }

      if (
        isPrimitiveStructure(outputStructure) &&
        isNumberStructure(outputStructure) &&
        !nodeContainsString
      ) {
        return mergeResults(...results, {
          pass: true,
          invalidInput: false,
          invalidOutput: false,
        });
      }

      return mergeResults(
        ...results,
        returnIssue(issue, false, true, isOutcomeWithCondition)
      );
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
              kind: 'inputNotFound',
              context: {
                path: getPath(node),
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

        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      const variables: ReferencedVariables[] = [];
      if (outputStructure && !isScalarStructure(outputStructure)) {
        if (isNonNullStructure(outputStructure) && node.text === 'undefined') {
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
        }

        variables.push({
          jessieNode: node,
          type: outputStructure,
        });
      }

      return {
        pass: true,
        invalidInput: false,
        invalidOutput: false,
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
          return { pass: true, invalidInput: false, invalidOutput: false };
        }

        if (!inputStructure || !inputStructure.fields) {
          return returnIssue(
            {
              kind: 'inputNotFound',
              context: {
                path: getPath(node),
                actual: getVariableName(node),
              },
            },
            true,
            false,
            isOutcomeWithCondition
          );
        }

        const issue: ValidationIssue = {
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

        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      const variables: ReferencedVariables[] = [];
      if (outputStructure && !isScalarStructure(outputStructure)) {
        variables.push({
          jessieNode: node,
          type: outputStructure,
        });
      }

      return {
        pass: true,
        invalidInput: false,
        invalidOutput: false,
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
          return { pass: true, invalidInput: false, invalidOutput: false };
        }

        if (!inputStructure || !inputStructure.fields) {
          const issue: ValidationIssue = {
            kind: 'inputNotFound',
            context: {
              path: getPath(node),
              actual: getVariableName(node),
            },
          };

          return returnIssue(issue, true, false, isOutcomeWithCondition);
        }

        const issue: ValidationIssue = {
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

        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      const variables: ReferencedVariables[] = [];
      if (outputStructure && !isScalarStructure(outputStructure)) {
        variables.push({
          jessieNode: node,
          type: outputStructure,
        });
      }

      return {
        pass: true,
        invalidInput: false,
        invalidOutput: false,
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

      if (!isObjectStructure(outputStructure)) {
        const issue: ValidationIssue = {
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
        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      if (!structureOfProperties) {
        throw new Error('This should not happen!');
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
        const issue: ValidationIssue = {
          kind: 'missingRequired',
          context: {
            path: getPath(node),
            field: key,
          },
        };

        results.push(returnIssue(issue, false, true, isOutcomeWithCondition));
      }

      if (extraProperties.length > 0) {
        const issue: ValidationIssue = {
          kind: 'wrongObjectStructure',
          context: {
            path: getPath(node),
            expected: structureOfProperties,
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

      const wrongStructureIssue: ValidationIssue = {
        kind: 'wrongStructure',
        context: {
          path: getPath(node),
          actual: node.getText(),
          expected: outputStructure,
        },
      };

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
        throw new Error('This should not happen!');
      }

      const typeValues = Object.values(structureOfTypes);

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

        for (const value of typeValues) {
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

        if (diff === typeValues.length) {
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

      return mergeResults(...results, {
        pass: true,
        invalidInput: false,
        invalidOutput: false,
      });
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
