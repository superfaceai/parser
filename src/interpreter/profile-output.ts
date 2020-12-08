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
 * @interface PrimitiveStructure represents structure of primitive type
 */
export interface PrimitiveStructure extends Structure {
  kind: 'PrimitiveStructure';
  type: 'string' | 'number' | 'boolean';
}

/**
 * @interface EnumStructure represent structure of enum type
 */
export interface EnumStructure extends Structure {
  kind: 'EnumStructure';
  enums: (string | number | boolean)[];
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
export interface ObjectStructure extends Structure {
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
export interface ScalarStructure extends Structure {
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
export interface UseCaseStructure {
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
export interface ProfileOutput {
  profileId: string;
  usecases: UseCaseStructure[];
}

// TODO: decide which notation to use
export type ObjectCollection = Record<string, StructureType | undefined>;
export type ArrayCollection = {
  [P in number]?: Exclude<StructureType, UnionStructure>;
};
