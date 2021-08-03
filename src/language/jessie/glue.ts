import {
  JessieSyntaxProtoError,
  transpileScript,
} from './transpiler/transpiler';
import {
  ForbiddenConstructProtoError,
  validateScript,
} from './validator/validator';

/**
 * Validates and transpiles Jessie script.
 *
 * This functions combines the transpiler and validator in a more efficient way
 */
export function validateAndTranspile(input: string):
  | { kind: 'success'; output: string; sourceMap: string }
  | {
      kind: 'failure';
      errors: (JessieSyntaxProtoError | ForbiddenConstructProtoError)[];
    } {
  const { output, sourceMap, syntaxProtoError } = transpileScript(input, true);

  if (syntaxProtoError) {
    return { kind: 'failure', errors: [syntaxProtoError] };
  }

  const subsetErrors = validateScript(input);
  if (subsetErrors.length > 0) {
    return { kind: 'failure', errors: subsetErrors };
  }

  return { kind: 'success', output, sourceMap };
}
