import * as ts from 'typescript';

// import { ALLOWED_SYNTAX } from '../language/jessie/validator/constructs';
import { StructureType } from './profile-validator';

export interface VisitConstruct<T extends ts.Node = ts.Node> {
  predicate(node: T, input: StructureType): boolean;
}

export const RETURN_CONSTRUCTS: {
  [kind in ts.SyntaxKind]?: VisitConstruct;
} = {
  [ts.SyntaxKind.StringLiteral]: {
    predicate: (_node: ts.StringLiteral, input: StructureType): boolean => {
      if (input.kind === 'PrimitiveStructure') {
        return input.type === 'string';
      }

      return false;
    },
  },
  [ts.SyntaxKind.NumericLiteral]: {
    predicate: (_node: ts.NumericLiteral, input: StructureType): boolean => {
      if (input.kind === 'PrimitiveStructure') {
        return input.type === 'number';
      }

      return false;
    },
  },
  [ts.SyntaxKind.TrueKeyword | ts.SyntaxKind.FalseKeyword]: {
    predicate: (_node: ts.BooleanLiteral, input: StructureType): boolean => {
      if (input.kind === 'PrimitiveStructure') {
        return input.type === 'boolean' || input.type === 'number';
      }

      return false;
    },
  },
  [ts.SyntaxKind.BinaryExpression]: {
    predicate: (node: ts.BinaryExpression, input: StructureType): boolean => {
      if (input.kind === 'PrimitiveStructure' && input.type === 'boolean') {
        return false;
      }

      // in case NaN could be returned (TODO: booleans only can't use %)
      if (node.operatorToken.getText() !== '+') {
        if (
          node.left.kind !== ts.SyntaxKind.NumericLiteral ||
          node.right.kind !== ts.SyntaxKind.NumericLiteral
        ) {
          return false;
        }
      }

      const left = RETURN_CONSTRUCTS[node.left.kind]?.predicate(
        node.left,
        input
      );
      const right = RETURN_CONSTRUCTS[node.right.kind]?.predicate(
        node.right,
        input
      );

      if (!left && !right) {
        return false;
      }

      return true;
    },
  },
  [ts.SyntaxKind.PrefixUnaryExpression]: {
    predicate: (_node: ts.UnaryExpression, _input: StructureType): boolean => {
      return true;
    },
  },
  [ts.SyntaxKind.Identifier]: {
    predicate: (node: ts.Identifier, input: StructureType): boolean => {
      if (node.parent.kind === ts.SyntaxKind.CallExpression) {
        // in case jessie expression consists of call statements such as
        // String(42) or Boolean(1) or Number(24)
        if (
          input.kind === 'PrimitiveStructure' &&
          node.text.toLowerCase() === input.type
        ) {
          return true;
        }
      }

      return false;
    },
  },
  [ts.SyntaxKind.PropertyAccessExpression]: {
    predicate: (
      node: ts.PropertyAccessExpression,
      input: StructureType
    ): boolean => {
      if (node.parent.kind === ts.SyntaxKind.CallExpression) {
        if (
          input.kind === 'PrimitiveStructure' &&
          input.type === 'string' &&
          (node.name.getText() === 'toString' ||
            node.name.getText() === 'join' ||
            node.name.getText() === 'toLocaleString')
        ) {
          return true;
        }
        if (
          input.kind === 'PrimitiveStructure' &&
          input.type === 'boolean' &&
          (node.name.getText() === 'isArray' ||
            node.name.getText() === 'every' ||
            node.name.getText() === 'some')
        ) {
          return true;
        }
        if (
          input.kind === 'PrimitiveStructure' &&
          input.type === 'number' &&
          (node.name.getText() === 'findIndex' ||
            node.name.getText() === 'indexOf' ||
            node.name.getText() === 'lastIndexOf')
        ) {
          return true;
        }
        if (
          input.kind === 'ListStructure' &&
          (node.name.getText() === 'map' ||
            node.name.getText() === 'entries' ||
            node.name.getText() === 'keys' ||
            node.name.getText() === 'values' ||
            node.name.getText() === 'concat' ||
            node.name.getText() === 'filter' ||
            node.name.getText() === 'slice' ||
            node.name.getText() === 'splice' ||
            node.name.getText() === 'getOwnPropertyNames' ||
            node.name.getText() === 'getOwnPropertySymbols')
        ) {
          return true;
        }
      }

      if (
        input.kind === 'PrimitiveStructure' &&
        input.type === 'number' &&
        node.name.getText() === 'length'
      ) {
        return true;
      }

      return false;
    },
  },
  [ts.SyntaxKind.CallExpression]: {
    predicate: (node: ts.CallExpression, input: StructureType): boolean => {
      const method = RETURN_CONSTRUCTS[node.expression.kind]?.predicate(
        node.expression,
        input
      );

      return method ?? false;
    },
  },
};
