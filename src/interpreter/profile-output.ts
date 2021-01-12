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
export interface DocumentedStructure {
  title?: string;
  description?: string;
}

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
  enums: ({ value: string | number | boolean } & DocumentedStructure)[];
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
  value: Exclude<StructureType, EnumStructure>;
}

/**
 * @interface ObjectStructure represent structure of {}object type
 */
export interface ObjectStructure extends Structure, DocumentedStructure {
  kind: 'ObjectStructure';
  fields?: ObjectCollection;
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
 * @type StructureType - represents all structures
 */
export type StructureType =
  | PrimitiveStructure
  | EnumStructure
  | NonNullStructure
  | ListStructure
  | ObjectStructure
  | UnionStructure
  | ScalarStructure;

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
 * @interface ProfileOutput - represent profile structure
 * @property profileId - profile id
 * @property usecase (opt.) - contains structure of input, result, error and other components
 */
export interface ProfileOutput extends DocumentedStructure {
  profileId: string;
  usecases: UseCaseStructure[];
}

export type ObjectCollection = Record<string, StructureType>;
export type ArrayCollection = Record<
  number,
  Exclude<StructureType, UnionStructure>
>;
