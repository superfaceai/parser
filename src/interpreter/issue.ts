import {
  ComlinkLiteralNode,
  ComlinkObjectLiteralNode,
  LiteralNode,
  LocationSpan,
  ObjectLiteralNode,
} from '@superfaceai/ast';

import {
  NonNullStructure,
  ObjectStructure,
  StructureType,
  VersionStructure,
} from './profile-output';

export type ValidationIssueKind =
  | 'wrongScope'
  | 'wrongProfileName'
  | 'wrongProfileVersion'
  | 'mapNotFound'
  | 'extraMapsFound'
  | 'outcomeNotDefined'
  | 'useCaseSlotNotFound'
  | 'wrongStructure'
  | 'wrongInput'
  | 'wrongObjectStructure'
  | 'missingRequired'
  | 'wrongVariableStructure';

export type IssueLocation = {
  kind: string;
  location?: LocationSpan;
};

export type ErrorContext = {
  path: IssueLocation;
};

export interface ValidationIssueBase {
  kind: ValidationIssueKind;
  context: ErrorContext;
}

export interface WrongScopeIssue extends ValidationIssueBase {
  kind: 'wrongScope';
  context: ErrorContext & {
    expected: string | undefined;
    actual: string | undefined;
  };
}

export interface WrongProfileNameIssue extends ValidationIssueBase {
  kind: 'wrongProfileName';
  context: ErrorContext & { expected: string; actual: string };
}

export interface WrongProfileVersionIssue extends ValidationIssueBase {
  kind: 'wrongProfileVersion';
  context: ErrorContext & {
    expected: VersionStructure;
    actual: VersionStructure;
  };
}

export interface MapNotFoundIssue extends ValidationIssueBase {
  kind: 'mapNotFound';
  context: ErrorContext & { expected: string };
}

export interface ExtraMapsFoundIssue extends ValidationIssueBase {
  kind: 'extraMapsFound';
  context: ErrorContext & {
    expected: string[];
    actual: string[];
  };
}

export enum UseCaseSlotType {
  INPUT = 'Input',
  RESULT = 'Result',
  ASYNCRESULT = 'AsyncResult',
  ERROR = 'Error',
}

export interface OutcomeNotDefinedIssue extends ValidationIssueBase {
  kind: 'outcomeNotDefined';
  context: ErrorContext & {
    slot: UseCaseSlotType;
    expected: NonNullStructure;
  };
}

export interface UseCaseSlotNotFoundIssue extends ValidationIssueBase {
  kind: 'useCaseSlotNotFound';
  context: ErrorContext & {
    expected: UseCaseSlotType;
    actual: LiteralNode | ComlinkLiteralNode | string;
  };
}

export interface WrongStructureIssue extends ValidationIssueBase {
  kind: 'wrongStructure';
  context: ErrorContext & {
    expected: StructureType;
    actual: LiteralNode | ComlinkLiteralNode | string;
  };
}

export interface WrongInputIssue extends ValidationIssueBase {
  kind: 'wrongInput';
  context: ErrorContext & {
    expected: StructureType;
    actual: StructureType | string;
  };
}

export interface WrongObjectStructureIssue extends ValidationIssueBase {
  kind: 'wrongObjectStructure';
  context: ErrorContext & {
    expected: ObjectStructure;
    actual: ObjectLiteralNode | ComlinkObjectLiteralNode | string;
  };
}

export interface MissingRequiredIssue extends ValidationIssueBase {
  kind: 'missingRequired';
  context: ErrorContext & { expected: string };
}

export interface WrongVariableStructureIssue extends ValidationIssueBase {
  kind: 'wrongVariableStructure';
  context: ErrorContext & {
    name: string;
    expected: StructureType;
    actual: LiteralNode | string;
  };
}

export type ValidationIssue =
  | WrongScopeIssue
  | WrongProfileNameIssue
  | WrongProfileVersionIssue
  | MapNotFoundIssue
  | ExtraMapsFoundIssue
  | OutcomeNotDefinedIssue
  | UseCaseSlotNotFoundIssue
  | WrongObjectStructureIssue
  | WrongStructureIssue
  | MissingRequiredIssue
  | WrongInputIssue
  | WrongVariableStructureIssue;
