import { DefaultSublexerTokenData } from '../../token';
import { ParseResult } from '../result';
import {
  tryParseComment,
  tryParseIdentifier,
  tryParseLiteral,
  tryParseOperator,
  tryParseSeparator,
} from './rules';
import { tryParseStringLiteral } from './string';

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
