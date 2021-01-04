import {
  EnumStructure,
  ListStructure,
  NonNullStructure,
  ObjectStructure,
  PrimitiveStructure,
  ScalarStructure,
  StructureType,
  UnionStructure,
} from './profile-output';

export function isScalarStructure(
  structure: StructureType
): structure is ScalarStructure {
  return structure.kind === 'ScalarStructure';
}

export function isNonNullStructure(
  structure: StructureType
): structure is NonNullStructure {
  return structure.kind === 'NonNullStructure';
}

export function isUnionStructure(
  structure: StructureType
): structure is UnionStructure {
  return structure.kind === 'UnionStructure';
}

export function isPrimitiveStructure(
  structure: StructureType
): structure is PrimitiveStructure {
  return structure.kind === 'PrimitiveStructure';
}

export function isEnumStructure(
  structure: StructureType
): structure is EnumStructure {
  return structure.kind === 'EnumStructure';
}

export function isListStructure(
  structure: StructureType
): structure is ListStructure {
  return structure.kind === 'ListStructure';
}

export function isObjectStructure(
  structure: StructureType
): structure is ObjectStructure {
  return structure.kind === 'ObjectStructure';
}

export function isBooleanStructure(
  primitiveStructure: PrimitiveStructure
): boolean {
  return primitiveStructure.type === 'boolean';
}

export function isNumberStructure(
  primitiveStructure: PrimitiveStructure
): boolean {
  return primitiveStructure.type === 'number';
}

export function isStringStructure(
  primitiveStructure: PrimitiveStructure
): boolean {
  return primitiveStructure.type === 'string';
}
