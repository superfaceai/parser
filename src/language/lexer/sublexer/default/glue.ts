import { DefaultSublexerTokenData, LiteralTokenData } from '../../token';
import { ParseResult } from '../result';
import { tryParseNumberLiteral } from './number';
import {
  tryParseComment,
  tryParseIdentifier,
  tryParseBooleanLiteral,
  tryParseOperator,
  tryParseSeparator,
} from './rules';
import { tryParseStringLiteral } from './string';

/**
 * Tries to parse a literal token at current position.
 *
 * Returns `undefined` if the current position cannot contain a literal.
 *
 * Returns an error if parsing fails.
 */
export function tryParseLiteral(slice: string): ParseResult<LiteralTokenData> {
  return tryParseBooleanLiteral(slice) ?? tryParseNumberLiteral(slice);
}

export function tryParseDefault(
  slice: string
): ParseResult<DefaultSublexerTokenData> {
  return (
    tryParseSeparator(slice) ??
    tryParseOperator(slice) ??
    tryParseLiteral(slice) ??
    tryParseStringLiteral(slice) ??
    tryParseIdentifier(slice) ??
    tryParseComment(slice)
  );
}
