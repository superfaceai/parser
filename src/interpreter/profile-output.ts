export type StructureKind =
  | 'PrimitiveStructure'
  | 'EnumStructure'
  | 'NonNullStructure'
  | 'ListStructure'
  | 'ObjectStructure'
  | 'UnionStructure'
  | 'ScalarStructure';

/**
 * @interface Structure represents skeleton for other structures
 */
export interface Structure {
  kind: StructureKind;
  required?: boolean;
}

/**
 * @interface DocumentedStructure represents documentable structures
 */
export type DocumentedStructure = {
  title?: string;
  description?: string;
};

/**
 * @interface PrimitiveStructure represents structure of primitive type
 */
export interface PrimitiveStructure extends Structure, DocumentedStructure {
  kind: 'PrimitiveStructure';
  type: 'string' | 'number' | 'boolean';
}

/**
 * @interface EnumStructure represent structure of enum type
 */
export interface EnumStructure extends Structure, DocumentedStructure {
  kind: 'EnumStructure';
  enums: ({
    name?: string | undefined;
    value: string | number | boolean;
  } & DocumentedStructure)[];
}

/**
 * @interface NonNullStructure represent structure of type that is !required
 */
export interface NonNullStructure extends Structure {
  kind: 'NonNullStructure';
  value: Exclude<StructureType, UnionStructure>;
}

/**
 * @interface ListStructure represent structure of []list type
 */
export interface ListStructure extends Structure {
  kind: 'ListStructure';
  value: StructureType;
}

/**
 * @interface ObjectStructure represent structure of {}object type
 */
export interface ObjectStructure extends Structure, DocumentedStructure {
  kind: 'ObjectStructure';
  fields: ObjectCollection;
}

/**
 * @interface UnionStructure represent structure of |union type
 */
export interface UnionStructure extends Structure {
  kind: 'UnionStructure';
  types: ArrayCollection;
}

/**
 * @interface ScalarStructure represent any structure
 */
export interface ScalarStructure extends Structure, DocumentedStructure {
  kind: 'ScalarStructure';
}

/**
 * @type DocumentedStructureType - represents all documented structures
 */
export type DocumentedStructureType =
  | PrimitiveStructure
  | EnumStructure
  | ObjectStructure
  | ScalarStructure;

/**
 * @type StructureType - represents all structures
 */
export type StructureType =
  | DocumentedStructureType
  | NonNullStructure
  | ListStructure
  | UnionStructure;

/**
 * @interface UseCaseStructure - represents usecase structure
 */
export interface UseCaseStructure extends DocumentedStructure {
  useCaseName: string;
  input?: ObjectStructure;
  result?: StructureType;
  async?: StructureType;
  error?: StructureType;
}

/**
 *  @interface VersionStructure - represents version of the profile or of map linking to a profile
 *  version = @1.0.0-rev100
 */
export interface VersionStructure {
  major: number;
  minor: number;
  patch?: number;
  label?: string;
}

/**
 * @interface ProfileHeaderStructure - represents profile header node
 */
export interface ProfileHeaderStructure extends DocumentedStructure {
  name: string;
  scope?: string;
  version: VersionStructure;
}

/**
 * @interface ProfileOutput - represent profile structure
 */
export interface ProfileOutput extends DocumentedStructure {
  header: ProfileHeaderStructure;
  usecases: UseCaseStructure[];
}

export type ObjectCollection = Record<string, StructureType>;
export type ArrayCollection = Exclude<StructureType, UnionStructure>[];

export function assertDefinedStructure(
  structure: StructureType | undefined
): asserts structure is StructureType {
  if (structure === undefined) {
    throw new Error('Structure is undefined');
  }
}
