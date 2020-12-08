import * as ts from 'typescript';

import { ValidationIssue } from './issue';
import { ValidationResult } from './map-validator';
import {
  ArrayCollection,
  ObjectStructure,
  StructureType,
} from './profile-output';
import {
  assertBoolean,
  assertNumber,
  assertString,
  isEnumStructure,
  isListStructure,
  isNonNullStructure,
  isObjectStructure,
  isPrimitiveStructure,
  isScalarStructure,
  isUnionStructure,
} from './profile-output.utils';

export type ID =
  | ts.Identifier
  | ts.PropertyAccessExpression
  | ts.ElementAccessExpression;

export interface ReferencedVariables {
  [variableName: string]: (StructureType | undefined)[];
}

export type ConstructResult = ValidationResult & {
  variables?: ReferencedVariables;
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
      const variables = {
        ...(acc.variables ?? {}),
        ...(val.variables ?? {}),
      };
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

function assertID(node: ts.Node): node is ID {
  return (
    (ts.isIdentifier(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)) &&
    node.getText() !== 'undefined'
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
      if (!outputStructure || isScalarStructure(outputStructure)) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      if (
        isPrimitiveStructure(outputStructure) &&
        assertString(outputStructure)
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      return returnIssue(
        {
          kind: 'wrongStructure',
          context: {
            path: getPath(node),
            actual: node.getText(),
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
      if (!outputStructure || isScalarStructure(outputStructure)) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      if (
        isPrimitiveStructure(outputStructure) &&
        assertNumber(outputStructure)
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      return returnIssue(
        {
          kind: 'wrongStructure',
          context: {
            path: getPath(node),
            actual: node.getText(),
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
      node: ts.BooleanLiteral,
      outputStructure?: StructureType,
      _inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult => {
      if (!outputStructure || isScalarStructure(outputStructure)) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      if (
        isPrimitiveStructure(outputStructure) &&
        assertBoolean(outputStructure)
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      return returnIssue(
        {
          kind: 'wrongStructure',
          context: {
            path: getPath(node),
            actual: node.getText(),
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
      node: ts.BooleanLiteral,
      outputStructure?: StructureType,
      _inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult => {
      if (!outputStructure || isScalarStructure(outputStructure)) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      if (
        isPrimitiveStructure(outputStructure) &&
        assertBoolean(outputStructure)
      ) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      return returnIssue(
        {
          kind: 'wrongStructure',
          context: {
            path: getPath(node),
            actual: node.getText(),
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
      if (!outputStructure || isScalarStructure(outputStructure)) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }
      if (isNonNullStructure(outputStructure)) {
        return returnIssue(
          {
            kind: 'wrongStructure',
            context: {
              path: getPath(node),
              actual: node.getText(),
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
        if (assertID(node.left)) {
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
        if (assertID(node.right)) {
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
      if (!outputStructure || isScalarStructure(outputStructure)) {
        return mergeResults(...results);
      }

      // if Output is defined - do check
      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
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
        assertBoolean(outputStructure)
      ) {
        return isOutcomeWithCondition
          ? mergeResults(...results, {
              pass: true,
              warnings: [issue],
              invalidInput: false,
              invalidOutput: true,
            })
          : mergeResults(...results, {
              pass: false,
              errors: [issue],
              invalidInput: false,
              invalidOutput: true,
            });
      }

      const nodeContainsString =
        ts.isStringLiteral(node.left) || ts.isStringLiteral(node.right);

      const nodeContainsID = assertID(node.left) || assertID(node.right);

      if (assertID(node.left)) {
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

      if (assertID(node.right)) {
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
        assertString(outputStructure) &&
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
        assertNumber(outputStructure) &&
        !nodeContainsString
      ) {
        return mergeResults(...results, {
          pass: true,
          invalidInput: false,
          invalidOutput: false,
        });
      }

      return isOutcomeWithCondition
        ? mergeResults(...results, {
            pass: true,
            warnings: [issue],
            invalidInput: false,
            invalidOutput: true,
          })
        : mergeResults(...results, {
            pass: false,
            errors: [issue],
            invalidInput: false,
            invalidOutput: true,
          });
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
        if (!inputStructure) {
          throw new Error('Input not found');
        }

        if (!inputStructure.fields) {
          throw new Error('Input not found');
        }

        if (outputStructure) {
          return compareStructures(node, inputStructure, outputStructure);
        }

        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      if (outputStructure && !isScalarStructure(outputStructure)) {
        if (isNonNullStructure(outputStructure) && node.text === 'undefined') {
          return returnIssue(
            {
              kind: 'wrongStructure',
              context: {
                path: getPath(node),
                actual: node.getText(),
                expected: outputStructure.value,
              },
            },
            false,
            true,
            isOutcomeWithCondition
          );
        }

        const variables: ReferencedVariables = {};
        if (isUnionStructure(outputStructure)) {
          variables[node.text] = Object.values(outputStructure.types);
        } else {
          variables[node.text] = [outputStructure];
        }

        return {
          pass: true,
          invalidInput: false,
          invalidOutput: false,
          variables,
        };
      }

      return { pass: true, invalidInput: false, invalidOutput: false };
    },
  },

  [ts.SyntaxKind.PropertyAccessExpression]: {
    visit(
      node: ts.PropertyAccessExpression,
      outputStructure?: StructureType,
      inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult {
      if (node.expression.getText().split('.')[0] === 'input') {
        if (!inputStructure) {
          throw new Error('Input not found');
        }

        const issue: ValidationIssue = {
          kind: 'wrongInput',
          context: {
            path: getPath(node),
            expected: inputStructure,
            actual: node.getText(),
          },
        };

        if (!inputStructure.fields) {
          return returnIssue(issue, true, false, isOutcomeWithCondition);
        }

        const property = node.name.getText();
        let fieldValue: StructureType | undefined;

        // input.to or input.from or input.person
        if (ts.isIdentifier(node.expression)) {
          fieldValue = inputStructure.fields[property];

          if (!fieldValue) {
            return returnIssue(issue, true, false, isOutcomeWithCondition);
          }
        } else if (ts.isPropertyAccessExpression(node.expression)) {
          // input.person.to or input.person.from or input.person.text.length
          let structure: StructureType | undefined;
          if (this.visitInput) {
            structure = this.visitInput(node.expression, inputStructure);
          }

          if (!structure) {
            return returnIssue(issue, true, false, isOutcomeWithCondition);
          }

          if (!isObjectStructure(structure) || !structure.fields) {
            return returnIssue(issue, true, false, isOutcomeWithCondition);
          }

          fieldValue = structure.fields[property];

          if (!fieldValue) {
            return returnIssue(issue, true, false, isOutcomeWithCondition);
          }
        }

        if (outputStructure) {
          if (!fieldValue) {
            throw new Error('This should not happen!');
          }

          return compareStructures(node, fieldValue, outputStructure);
        }

        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      if (outputStructure && !isScalarStructure(outputStructure)) {
        const variables: ReferencedVariables = {};
        let variableName = node.getText();

        const trimVariableName = (text: string, quote: '"' | "'"): string =>
          text.slice(1, text.lastIndexOf(quote)) +
          text.slice(text.lastIndexOf(quote) + 1, text.length);

        if (variableName.startsWith("'")) {
          variableName = trimVariableName(variableName, "'");
        } else if (variableName.startsWith('"')) {
          variableName = trimVariableName(variableName, '"');
        }

        if (isUnionStructure(outputStructure)) {
          variables[variableName] = Object.values(outputStructure.types);
        } else {
          variables[variableName] = [outputStructure];
        }

        return {
          pass: true,
          invalidInput: false,
          invalidOutput: false,
          variables,
        };
      }

      return { pass: true, invalidInput: false, invalidOutput: false };
    },

    visitInput(
      node: ts.PropertyAccessExpression,
      structure: ObjectStructure
    ): StructureType | undefined {
      const { expression, name } = node;
      let outputStructure: StructureType | undefined;

      if (ts.isPropertyAccessExpression(expression)) {
        if (this.visitInput) {
          outputStructure = this.visitInput(expression, structure);
        }
      } else if (ts.isIdentifier(expression)) {
        if (!structure.fields) {
          return undefined;
        }

        return structure.fields[name.getText()];
      }

      if (
        !outputStructure ||
        !isObjectStructure(outputStructure) ||
        !outputStructure.fields
      ) {
        return undefined;
      }

      return outputStructure.fields[name.getText()];
    },
  },

  [ts.SyntaxKind.ElementAccessExpression]: {
    visit(
      node: ts.ElementAccessExpression,
      outputStructure?: StructureType,
      inputStructure?: ObjectStructure,
      isOutcomeWithCondition?: boolean
    ): ConstructResult {
      if (node.expression.getText().split('.')[0] === 'input') {
        if (!inputStructure) {
          throw new Error('Input not found');
        }

        const issue: ValidationIssue = {
          kind: 'wrongInput',
          context: {
            path: getPath(node),
            expected: inputStructure,
            actual: node.getText(),
          },
        };

        if (!inputStructure.fields) {
          return returnIssue(issue, true, false, isOutcomeWithCondition);
        }

        const property = node.argumentExpression.getText();
        let fieldValue: StructureType | undefined;

        // input['to'] or input['from'] or input['person']
        if (ts.isIdentifier(node.expression)) {
          fieldValue = inputStructure.fields[property];

          if (!fieldValue) {
            return returnIssue(issue, true, false, isOutcomeWithCondition);
          }
        } else if (ts.isPropertyAccessExpression(node.expression)) {
          // input.person['to'] or input.person['from'] or input.person.text['length']
          let structure: StructureType | undefined;
          if (this.visitInput) {
            structure = this.visitInput(node.expression, inputStructure);
          }

          if (!structure) {
            return returnIssue(issue, true, false, isOutcomeWithCondition);
          }

          if (!isObjectStructure(structure) || !structure.fields) {
            return returnIssue(issue, true, false, isOutcomeWithCondition);
          }

          fieldValue = structure.fields[property];

          if (!fieldValue) {
            return returnIssue(issue, true, false, isOutcomeWithCondition);
          }
        }

        if (outputStructure) {
          if (!fieldValue) {
            throw new Error('This should not happen!');
          }

          return compareStructures(node, fieldValue, outputStructure);
        }

        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      if (outputStructure && !isScalarStructure(outputStructure)) {
        const variables: ReferencedVariables = {};
        let expressionName = node.expression.getText();
        let argumentName = node.argumentExpression.getText();

        const trimVariableName = (text: string, quote: '"' | "'"): string =>
          text.slice(1, text.lastIndexOf(quote)) +
          text.slice(text.lastIndexOf(quote) + 1, text.length);

        if (expressionName.startsWith("'")) {
          expressionName = trimVariableName(expressionName, "'");
        } else if (expressionName.startsWith('"')) {
          expressionName = trimVariableName(expressionName, '"');
        }

        if (argumentName.startsWith("'")) {
          argumentName = trimVariableName(argumentName, "'");
        } else if (argumentName.startsWith('"')) {
          argumentName = trimVariableName(argumentName, '"');
        }

        const variableName = expressionName + '.' + argumentName;
        if (isUnionStructure(outputStructure)) {
          variables[variableName] = Object.values(outputStructure.types);
        } else {
          variables[variableName] = [outputStructure];
        }

        return {
          pass: true,
          invalidInput: false,
          invalidOutput: false,
          variables,
        };
      }

      return { pass: true, invalidInput: false, invalidOutput: false };
    },

    visitInput(
      node: ts.PropertyAccessExpression,
      structure: ObjectStructure
    ): StructureType | undefined {
      const { expression, name } = node;
      let outputStructure: StructureType | undefined;

      if (ts.isPropertyAccessExpression(expression)) {
        if (this.visitInput) {
          outputStructure = this.visitInput(expression, structure);
        }
      } else if (ts.isIdentifier(expression)) {
        if (!structure.fields) {
          return undefined;
        }

        return structure.fields[name.getText()];
      }

      if (
        !outputStructure ||
        !isObjectStructure(outputStructure) ||
        !outputStructure.fields
      ) {
        return undefined;
      }

      return outputStructure.fields[name.getText()];
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

      if (inputStructure) {
        node.properties.slice(0, node.properties.length).forEach(property => {
          if (
            ts.isPropertyAssignment(property) &&
            assertID(property.initializer)
          ) {
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
        });
      }

      if (!outputStructure || isScalarStructure(outputStructure)) {
        return mergeResults(...results);
      }

      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
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

        isOutcomeWithCondition
          ? results.push({
              pass: true,
              warnings: [issue],
              invalidInput: false,
              invalidOutput: true,
            })
          : results.push(...results, {
              pass: false,
              errors: [issue],
              invalidInput: false,
              invalidOutput: true,
            });

        return mergeResults(...results);
      }

      const properties = node.properties.slice(0, node.properties.length);
      const structureOfFields = outputStructure.fields;

      if (properties.length === 0 && !structureOfFields) {
        return { pass: true, invalidInput: false, invalidOutput: false };
      }

      if (!structureOfFields) {
        throw new Error('This should not happen!');
      }

      const propertyValues = Object.values(properties);
      const fieldNames = Object.keys(structureOfFields);
      let index = fieldNames.length;

      while (index--) {
        const key = fieldNames[index];
        const value = structureOfFields[key];

        if (!value) {
          throw new Error(`Value with key: ${key} does not exist!`);
        }

        let isFound = false;
        let nodeIndex = propertyValues.length;

        while (nodeIndex--) {
          const property = propertyValues[nodeIndex];
          const nodeKey = property.name;

          if (!nodeKey) {
            throw new Error('This should not happen!');
          }

          if (nodeKey.getText() === key) {
            if (ts.isPropertyAssignment(property)) {
              results.push(
                visitConstruct(
                  property.initializer,
                  value,
                  undefined,
                  isOutcomeWithCondition,
                  RETURN_CONSTRUCTS[property.initializer.kind]
                )
              );

              isFound = true;
              fieldNames.splice(index, 1);
              propertyValues.splice(nodeIndex, 1);
            }
          }
        }

        if (value.required && !isFound) {
          const issue: ValidationIssue = {
            kind: 'missingRequired',
            context: {
              path: getPath(node),
              field: key,
            },
          };

          isOutcomeWithCondition
            ? results.push({
                pass: true,
                warnings: [issue],
                invalidInput: false,
                invalidOutput: true,
              })
            : results.push({
                pass: false,
                errors: [issue],
                invalidInput: false,
                invalidOutput: true,
              });
        }
      }

      if (propertyValues.length > 0) {
        results.push({
          pass: true,
          warnings: [
            {
              kind: 'wrongStructure',
              context: {
                path: getPath(node),
                actual: node.getText(),
                expected: outputStructure,
              },
            },
          ],
          invalidInput: false,
          invalidOutput: false,
        });
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
        node.elements.slice(0, node.elements.length).forEach(element => {
          if (assertID(element))
            results.push(
              visitConstruct(
                element,
                undefined,
                inputStructure,
                isOutcomeWithCondition,
                RETURN_CONSTRUCTS[element.kind]
              )
            );
        });
      }

      if (!outputStructure || isScalarStructure(outputStructure)) {
        return mergeResults(...results);
      }

      if (isNonNullStructure(outputStructure)) {
        outputStructure = outputStructure.value;
      }
      if (!isListStructure(outputStructure)) {
        const issue: ValidationIssue = {
          kind: 'wrongStructure',
          context: {
            path: getPath(node),
            actual: node.getText(),
            expected: outputStructure,
          },
        };

        return isOutcomeWithCondition
          ? mergeResults(...results, {
              pass: true,
              warnings: [issue],
              invalidInput: false,
              invalidOutput: true,
            })
          : mergeResults(...results, {
              pass: false,
              errors: [issue],
              invalidInput: false,
              invalidOutput: true,
            });
      }

      let structureOfTypes: ArrayCollection | undefined;
      let structureOfType: StructureType | undefined;

      if (isUnionStructure(outputStructure.value)) {
        structureOfTypes = outputStructure.value.types;
      } else {
        structureOfType = outputStructure.value;
      }

      const elements = node.elements.slice(0, node.elements.length);

      if (structureOfType) {
        elements.forEach(element => {
          results.push(
            visitConstruct(
              element,
              structureOfType,
              undefined,
              isOutcomeWithCondition,
              RETURN_CONSTRUCTS[element.kind]
            )
          );
        });

        return mergeResults(...results);
      }

      if (!structureOfTypes) {
        throw new Error('This should not happen!');
      }

      const typeValues = Object.values(structureOfTypes);
      let nodeIndex = elements.length;

      while (nodeIndex--) {
        const element = elements[nodeIndex];

        if (assertID(element)) {
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

        typeValues.forEach(value => {
          if (!value) {
            throw new Error('This should not happen!');
          }

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
        });

        if (diff === typeValues.length) {
          results.push({
            pass: false,
            errors: [
              {
                kind: 'wrongStructure',
                context: {
                  path: getPath(node),
                  actual: node.getText(),
                  expected: outputStructure,
                },
              },
            ],
            invalidInput: false,
            invalidOutput: true,
          });
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
