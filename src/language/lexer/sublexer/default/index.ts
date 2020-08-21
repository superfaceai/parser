import { DefaultSublexerTokenData } from '../../token';

import {
  tryParseComment,
  tryParseIdentifier,
  tryParseLiteral,
  tryParseOperator,
  tryParseSeparator,
} from './rules';
import { tryParseStringLiteral } from './string';
import { ParseResult } from '../../sublexer';

export {
  tryParseComment,
  tryParseIdentifier,
  tryParseLiteral,
  tryParseOperator,
  tryParseSeparator,
  tryParseStringLiteral
}

export function tryParseDefault(slice: string): ParseResult<DefaultSublexerTokenData> {
  return tryParseSeparator(slice) ?? tryParseOperator(slice) ?? tryParseLiteral(slice) ?? tryParseStringLiteral(slice) ?? tryParseIdentifier(slice) ?? tryParseComment(slice);
}