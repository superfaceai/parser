import { LiteralNode } from '@superindustries/language';

import { StructureCollection, ValidationError } from './map-validator';
import { StructureType } from './profile-validator';

export function formatErrors(errors?: ValidationError[]): string {
  if (!errors) {
    return 'Unknown error';
  }

  return errors
    .map(err => {
      const prefix = err.context?.path
        ? `[${err.context.path.join('.')}] `
        : '';
      switch (err.kind) {
        case 'wrongProfileID':
          return `${prefix}Wrong Profile ID: expected ${err.context.expected}, but got ${err.context.actual}`;

        case 'wrongUsecaseName':
          return `${prefix}Wrong Usecase Name: expected ${err.context.expected}, but got ${err.context.actual}`;

        case 'usecaseNotFound':
          return `${prefix}Usecase Not Found: expected ${err.context.expectedUseCase}, but got undefined`;

        case 'resultNotFound':
          return `${prefix}Result Not Found: expected ${err.context.expectedResult}, but got undefined`;

        case 'inputNotFound':
          return `${prefix}Input Not Found: expected ${err.context.expectedInput}, but got undefined`;

        case 'wrongObjectStructure':
          return `${prefix}Wrong Object Structure: expected ${err.context.expected
            .map(val => val.key.join(''))
            .join(', ')}, but got ${
            err.context.actual
              ? Object.keys(err.context.actual).join(', ')
              : 'undefined'
          }`;

        case 'wrongArrayStructure':
          return `${prefix}Wrong Array Structure: expected ${err.context.expected
            .map(val => val.kind)
            .join(', ')}, but got ${
            err.context.actual
              ? Object.values(err.context.actual)
                  .map(val => val?.kind)
                  .join(', ')
              : 'undefined'
          }`;

        case 'wrongStructure':
          return `${prefix}Wrong Structure: expected ${err.context.expected?.kind}, but got ${err.context.actual?.kind}`;

        case 'missingRequired':
          return `${prefix}Missing required field`;

        default:
          throw new Error('Invalid error!');
      }
    })
    .join('\n');
}

/**
 * Compares the node with profile output structure. The arguments should represent the actual nested level.
 * @param node represents LiteralNode
 * @param structure represent Result or Input and their descendent structure
 */
export function compareStructure(
  node: LiteralNode,
  structure: StructureType
): {
  isValid: boolean;
  newInput?: StructureType;
  newCollection?: StructureCollection;
} {
  switch (node.kind) {
    case 'PrimitiveLiteral':
      if (structure.kind === 'PrimitiveStructure') {
        return { isValid: true };
      }
      break;

    case 'ArrayLiteral':
      if (structure.kind === 'ListStructure') {
        // TODO // This is nested in Union not only List !
        if (structure.value?.kind === 'UnionStructure') {
          return { isValid: true, newCollection: structure.value.types };
        }

        return { isValid: true, newInput: structure.value };
      }
      break;

    case 'ObjectLiteral':
      if (structure.kind === 'ObjectStructure') {
        return { isValid: true, newCollection: structure.fields };
      }
      break;

    case 'JessieExpression':
      if (structure.kind === 'ObjectStructure') {
        return { isValid: true, newCollection: structure.fields };
      }
      break;
  }

  return { isValid: false };
}
