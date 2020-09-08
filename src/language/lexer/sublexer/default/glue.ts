import { DefaultSublexerTokenData, LexerTokenKind, LiteralTokenData, NewlineTokenData } from '../../token';
import { isNewline } from '../../util';
import { ParseResult } from '../result';
import { tryParseNumberLiteral } from './number';
import {
  tryParseBooleanLiteral,
  tryParseComment,
  tryParseIdentifier,
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

export function tryParseNewline(slice: string): ParseResult<NewlineTokenData> {
  if (isNewline(slice.charCodeAt(0))) {
    return {
      isError: false,
      data: { kind: LexerTokenKind.NEWLINE },
      relativeSpan: { start: 0, end: 1 }
    }
  } else {
    return undefined;
  }
}

export function tryParseDefault(
  slice: string
): ParseResult<DefaultSublexerTokenData> {
  return (
    tryParseNewline(slice) ??
    tryParseSeparator(slice) ??
    tryParseOperator(slice) ??
    tryParseLiteral(slice) ??
    tryParseStringLiteral(slice) ??
    tryParseIdentifier(slice) ??
    tryParseComment(slice)
  );
}
