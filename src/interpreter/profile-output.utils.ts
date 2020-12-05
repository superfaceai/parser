import {
  AnyStructure,
  EnumStructure,
  ListStructure,
  NonNullStructure,
  ObjectStructure,
  PrimitiveStructure,
  StructureType,
  UnionStructure,
} from './profile-output';

export function isAnyStructure(
  structure: StructureType
): structure is AnyStructure {
  return structure.kind === 'AnyStructure';
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

export function assertBoolean(primitiveStructure: PrimitiveStructure): boolean {
  return primitiveStructure.type === 'boolean';
}

export function assertNumber(primitiveStructure: PrimitiveStructure): boolean {
  return primitiveStructure.type === 'number';
}

export function assertString(primitiveStructure: PrimitiveStructure): boolean {
  return primitiveStructure.type === 'string';
}
