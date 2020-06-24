import type { Source } from '../source';

/**
 * Produces a GraphQLError representing a syntax error, containing useful
 * descriptive information about the syntax error's position in the source.
 */
export function syntaxError(
  _source: Source,
  _position: number,
  description: string
): Error {
  // return new GraphQLError(`Syntax Error: ${description}`, undefined, source, [
  //   position,
  // ]);
  return new Error(`Syntax Error: ${description}`);
}
