import {
  AssignmentNode,
  ComlinkAssignmentNode,
  ComlinkLiteralNode,
  LiteralNode,
} from '@superfaceai/ast';

import {
  ObjectCollection,
  ObjectStructure,
  StructureType,
  VersionStructure,
} from './profile-output';

export enum ValidationIssueSlot {
  INPUT = 'input',
  RESULT = 'result',
  ASYNCRESULT = 'asyncResult',
  ERROR = 'error',
}

export type ErrorContext = { path?: string[] };
export type ValidationIssue =
  | {
      kind: 'wrongScope';
      context: ErrorContext & {
        expected: string | undefined;
        actual: string | undefined;
      };
    }
  | {
      kind: 'wrongProfileName';
      context: ErrorContext & { expected: string; actual: string };
    }
  | {
      kind: 'wrongProfileVersion';
      context: ErrorContext & {
        expected: VersionStructure;
        actual: VersionStructure;
      };
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
      kind: 'wrongObjectStructure';
      context: ErrorContext & {
        expected: ObjectCollection;
        actual: AssignmentNode[] | ComlinkAssignmentNode[] | string;
      };
    }
  | {
      kind: 'wrongStructure';
      context: ErrorContext & {
        expected: StructureType;
        actual: LiteralNode | ComlinkLiteralNode | StructureType | string;
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
      kind: 'wrongVariableStructure';
      context: ErrorContext & {
        name: string;
        expected: StructureType;
        actual: LiteralNode | string;
      };
    }
  | {
      kind: 'useCaseSlotNotFound';
      context: ErrorContext & {
        slot: ValidationIssueSlot;
        actual: ComlinkLiteralNode;
      };
    };
