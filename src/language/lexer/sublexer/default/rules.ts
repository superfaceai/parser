import { SyntaxErrorCategory } from '../../../error';
import { ParseResult } from '../../sublexer';
import {
  CommentTokenData,
  IdentifierTokenData,
  LexerScanRule,
  LexerTokenKind,
  LITERALS_BOOL,
  LiteralTokenData,
  OPERATORS,
  OperatorTokenData,
  SEPARATORS,
  SeparatorTokenData,
} from '../../token';
import * as util from '../../util';

function tryParseScannerRules<T>(
  slice: string,
  rules: Record<string, LexerScanRule<T>>
): { value: T; length: number } | undefined {
  let result = undefined;
  for (const [key, [word, predicate]] of Object.entries(rules)) {
    result = util.checkKeywordLiteral<T>(slice, key, word, predicate);
    if (result) {
      break;
    }
  }

  return result;
}

/**
 * Tries to parse a separator token at current position.
 *
 * Returns `undefined` if the current position cannot contain a separator.
 */
export function tryParseSeparator(
  slice: string
): ParseResult<SeparatorTokenData> {
  // Handle EOF
  if (slice.length === 0) {
    return {
      isError: false,
      data: {
        kind: LexerTokenKind.SEPARATOR,
        separator: 'EOF',
      },
      relativeSpan: { start: 0, end: 0 },
    };
  }

  const parsed = tryParseScannerRules(slice, SEPARATORS);
  if (parsed === undefined) {
    return undefined;
  }

  return {
    isError: false,
    data: {
      kind: LexerTokenKind.SEPARATOR,
      separator: parsed.value,
    },
    relativeSpan: { start: 0, end: parsed.length },
  };
}

/**
 * Tries to parse an operator token at current position.
 *
 * Returns `undefined` if the current position cannot contain an operator.
 */
export function tryParseOperator(
  slice: string
): ParseResult<OperatorTokenData> {
  const parsed = tryParseScannerRules(slice, OPERATORS);
  if (parsed === undefined) {
    return undefined;
  }

  return {
    isError: false,
    data: {
      kind: LexerTokenKind.OPERATOR,
      operator: parsed.value,
    },
    relativeSpan: { start: 0, end: parsed.length },
  };
}

function tryParseLiteralBoolean(slice: string): ParseResult<LiteralTokenData> {
  const parsed = tryParseScannerRules(slice, LITERALS_BOOL);
  if (parsed === undefined) {
    return undefined;
  }

  return {
    isError: false,
    data: {
      kind: LexerTokenKind.LITERAL,
      literal: parsed.value,
    },
    relativeSpan: { start: 0, end: parsed.length },
  };
}

function tryParseLiteralNumber(slice: string): ParseResult<LiteralTokenData> {
  let numberLiteralLength = 0;
  let isFloat = false;

  const keywordLiteralBase = util.checkKeywordLiteral(
    slice,
    '0x',
    16,
    _ => true
  ) ??
    util.checkKeywordLiteral(slice, '0b', 2, util.isAny) ??
    util.checkKeywordLiteral(slice, '0o', 8, util.isAny) ?? {
      value: 10,
      length: 0,
    };
  // integer or float after `base` characters
  const numberSlice = slice.slice(keywordLiteralBase.length);
  const startingNumbers = util.countStartingNumbersRadix(
    numberSlice,
    keywordLiteralBase.value
  );
  if (startingNumbers === 0) {
    if (keywordLiteralBase.value !== 10) {
      return {
        isError: true,
        kind: LexerTokenKind.LITERAL,
        detail: 'Expected a number following integer base prefix',
        category: SyntaxErrorCategory.LEXER,
        relativeSpan: { start: 0, end: keywordLiteralBase.length + 1 },
      };
    } else {
      return undefined;
    }
  }
  numberLiteralLength += startingNumbers;

  if (keywordLiteralBase.value === 10) {
    const afterNumberSlice = numberSlice.slice(startingNumbers);
    // Definitely float after decimal separator
    if (util.isDecimalSeparator(afterNumberSlice.charCodeAt(0))) {
      // + 1 for decimal separator
      numberLiteralLength +=
        1 + util.countStartingNumbers(afterNumberSlice.slice(1));
      isFloat = true;
    }
  }

  // parse the number value from string
  let numberValue: number;
  if (isFloat) {
    numberValue = parseFloat(slice.slice(0, numberLiteralLength));
  } else {
    numberValue = parseInt(
      slice.slice(
        keywordLiteralBase.length,
        keywordLiteralBase.length + numberLiteralLength
      ),
      keywordLiteralBase.value
    );
  }
  if (isNaN(numberValue)) {
    throw 'Invalid lexer state. This in an error in the lexer.';
  }

  return {
    isError: false,
    data: {
      kind: LexerTokenKind.LITERAL,
      literal: numberValue,
    },
    relativeSpan: {
      start: 0,
      end: keywordLiteralBase.length + numberLiteralLength,
    },
  };
}

/**
 * Tries to parse a literal token at current position.
 *
 * Returns `undefined` if the current position cannot contain a literal.
 *
 * Returns an error if parsing fails.
 */
export function tryParseLiteral(slice: string): ParseResult<LiteralTokenData> {
  return tryParseLiteralBoolean(slice) ?? tryParseLiteralNumber(slice);
}

/**
 * Tries to parse an identifier token at current position.
 *
 * Returns `undefined` if the current position cannot contain an identifier.
 */
export function tryParseIdentifier(
  slice: string
): ParseResult<IdentifierTokenData> {
  if (!util.isValidIdentififerStartChar(slice.charCodeAt(0))) {
    return undefined;
  }

  const identLength = util.countStartingIdentifierChars(slice);
  if (identLength === 0) {
    return undefined;
  }

  return {
    isError: false,
    data: {
      kind: LexerTokenKind.IDENTIFIER,
      identifier: slice.slice(0, identLength),
    },
    relativeSpan: { start: 0, end: identLength },
  };
}

/**
 * Tries to parse a comment token at current position.
 *
 * Returns `undefined` if the current position cannot contain a comment.
 */
export function tryParseComment(slice: string): ParseResult<CommentTokenData> {
  if (util.isCommentChar(slice.charCodeAt(0))) {
    const commentSlice = slice.slice(1);
    const length = util.countStarting(
      char => !util.isNewline(char),
      commentSlice
    );

    return {
      isError: false,
      data: {
        kind: LexerTokenKind.COMMENT,
        comment: commentSlice.slice(0, length),
      },
      relativeSpan: { start: 0, end: length + 1 },
    };
  } else {
    return undefined;
  }
}
