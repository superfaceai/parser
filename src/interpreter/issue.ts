import { AssignmentNode, LiteralNode } from '@superfaceai/ast';

import {
  ArrayCollection,
  ObjectCollection,
  ObjectStructure,
  StructureType,
} from './profile-output';

export type ErrorContext = { path?: string[] };
export type ValidationIssue =
  | {
      kind: 'wrongProfileID';
      context: ErrorContext & { expected: string; actual: string };
    }
  | {
      kind: 'mapNotFound';
      context: ErrorContext & { expected: string };
    }
  | {
      kind: 'extraMapsFound';
      context: ErrorContext & {
        expected: string[];
        actual: string[];
      };
    }
  | {
      kind: 'operationNotFound';
      context: ErrorContext & { expected: string };
    }
  | {
      kind: 'resultNotDefined';
      context: ErrorContext & { expectedResult: StructureType | undefined };
    }
  | {
      kind: 'errorNotDefined';
      context: ErrorContext & { expectedError: StructureType | undefined };
    }
  | {
      kind: 'resultNotFound';
      context: ErrorContext & { actualResult: LiteralNode };
    }
  | {
      kind: 'errorNotFound';
      context: ErrorContext & { actualError: LiteralNode };
    }
  | {
      kind: 'inputNotFound';
      context: ErrorContext & { actual: string };
    }
  | {
      kind: 'argumentsNotFound';
      context: ErrorContext & { actual: string };
    }
  | {
      kind: 'wrongObjectStructure';
      context: ErrorContext & {
        expected: ObjectCollection;
        actual: AssignmentNode[];
      };
    }
  | {
      kind: 'wrongArrayStructure';
      context: ErrorContext & {
        expected: ArrayCollection;
        actual: LiteralNode[];
      };
    }
  | {
      kind: 'wrongStructure';
      context: ErrorContext & {
        expected: StructureType;
        actual: LiteralNode | StructureType | string;
      };
    }
  | {
      kind: 'missingRequired';
      context: ErrorContext & { field: string };
    }
  | {
      kind: 'wrongInput';
      context: ErrorContext & {
        expected: ObjectStructure;
        actual: string;
      };
    }
  | {
      kind: 'wrongArgument';
      context: ErrorContext & {
        expected: Record<string, LiteralNode>;
        actual: string;
      };
    }
  | {
      kind: 'wrongVariableStructure';
      context: ErrorContext & {
        name: string;
        expected: StructureType;
        actual: LiteralNode | string;
      };
    }
  | {
      kind: 'variableNotDefined';
      context: ErrorContext & { name: string };
    };

