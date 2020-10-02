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
import { ParseResult } from '../result';

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

export function tryParseBooleanLiteral(
  slice: string
): ParseResult<LiteralTokenData> {
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
