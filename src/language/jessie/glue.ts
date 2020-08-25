import {
  JessieSyntaxProtoError,
  transpileScript,
} from './transpiler/transpiler';
import {
  ForbiddenConstructProtoError,
  validateScript,
} from './validator/validator';

type Success = { output: string; sourceMap: string };

/**
 * Validates and transpiles Jessie script.
 *
 * This functions combines the transpiler and validator in a more efficient way
 */
export function validateAndTranspile(
  input: string
): Success | JessieSyntaxProtoError | ForbiddenConstructProtoError {
  const { output, sourceMap, syntaxProtoError } = transpileScript(input, true);

  if (syntaxProtoError) {
    return syntaxProtoError;
  }

  const subsetErrors = validateScript(input);
  if (subsetErrors.length > 0) {
    return subsetErrors[0]; // TODO
  }

  return { output, sourceMap };
}
