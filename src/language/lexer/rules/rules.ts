import { Span } from '../../source';
import {
  CommentTokenData,
  DECORATORS,
  DecoratorTokenData,
  IdentifierTokenData,
  LexerScanRule,
  LexerTokenData,
  LexerTokenKind,
  LITERALS_BOOL,
  LiteralTokenData,
  OPERATORS,
  OperatorTokenData,
  SEPARATORS,
  SeparatorTokenData,
} from '../token';
import * as util from '../util';

/// Error returned internally by the lexer `tryParse*` methods.
export class ParseError {
  /// Kind of the errored token.
  readonly kind: LexerTokenKind;
  /// Span of the errored token.
  readonly span: Span;
  /// Optional detail message.
  readonly detail?: string;

  constructor(kind: LexerTokenKind, span: Span, detail?: string) {
    this.kind = kind;
    this.span = span;
    this.detail = detail;
  }
}

export type ParseResult<T extends LexerTokenData> =
  | ([T, number] | null)
  | ParseError;

function tryParseScannerRules<T>(
  slice: string,
  rules: { [x: string]: LexerScanRule<T> }
): { value: T; length: number } | null {
  let result = null;
  for (const [key, [word, predicate]] of Object.entries(rules)) {
    result = util.checkKeywordLiteral<T>(slice, key, word, predicate) ?? null;
    if (result ?? false) {
      break;
    }
  }

  return result;
}

/// Tries to parse a separator token at current position.
///
/// Returns `null` if the current position cannot contain a separator.
export function tryParseSeparator(
  slice: string
): ParseResult<SeparatorTokenData> {
  // Handle EOF
  if (slice.length === 0) {
    return [
      {
        kind: LexerTokenKind.SEPARATOR,
        separator: 'EOF',
      },
      0,
    ];
  }

  const parsed = tryParseScannerRules(slice, SEPARATORS);
  if (parsed === null) {
    return null;
  }

  return [
    {
      kind: LexerTokenKind.SEPARATOR,
      separator: parsed.value,
    },
    parsed.length,
  ];
}

/// Tries to parse an operator token at current position.
///
/// Returns `null` if the current position cannot contain an operator.
export function tryParseOperator(
  slice: string
): ParseResult<OperatorTokenData> {
  const parsed = tryParseScannerRules(slice, OPERATORS);
  if (parsed === null) {
    return null;
  }

  return [
    {
      kind: LexerTokenKind.OPERATOR,
      operator: parsed.value,
    },
    parsed.length,
  ];
}

function tryParseLiteralBoolean(slice: string): ParseResult<LiteralTokenData> {
  const parsed = tryParseScannerRules(slice, LITERALS_BOOL);
  if (parsed === null) {
    return null;
  }

  return [
    {
      kind: LexerTokenKind.LITERAL,
      literal: parsed.value,
    },
    parsed.length,
  ];
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
      return new ParseError(
        LexerTokenKind.LITERAL,
        { start: 0, end: keywordLiteralBase.length + 1 },
        'Expected a number following integer base prefix'
      );
    } else {
      return null;
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

  return [
    {
      kind: LexerTokenKind.LITERAL,
      literal: numberValue,
    },
    keywordLiteralBase.length + numberLiteralLength,
  ];
}

/// Tries to parse a literal token at current position.
///
/// Returns `null` if the current position cannot contain a literal.
///
/// Returns an error if parsing fails.
export function tryParseLiteral(slice: string): ParseResult<LiteralTokenData> {
  return tryParseLiteralBoolean(slice) ?? tryParseLiteralNumber(slice);
}

/// Tries to parse a decorator token at current position.
///
/// Returns `null` if the current position cannot contain a decorator.
///
/// Returns an error if parsing fails.
export function tryParseDecorator(
  slice: string
): ParseResult<DecoratorTokenData> {
  if (!util.isDecoratorChar(slice.charCodeAt(0))) {
    return null;
  }

  const parsed = tryParseScannerRules(slice.slice(1), DECORATORS);
  if (parsed === null) {
    return new ParseError(
      LexerTokenKind.DECORATOR,
      { start: 0, end: 2 },
      `Expected one of [${Object.keys(DECORATORS).join(', ')}]`
    );
  }

  return [
    {
      kind: LexerTokenKind.DECORATOR,
      decorator: parsed.value,
    },
    // + 1 for decorator char
    1 + parsed.length,
  ];
}

/// Tries to parse an identifier token at current position.
///
/// Returns `null` if the current position cannot contain an identifier.
export function tryParseIdentifier(
  slice: string
): ParseResult<IdentifierTokenData> {
  const identLength = util.countStartingIdentifierChars(slice);
  if (identLength === 0) {
    return null;
  }

  return [
    {
      kind: LexerTokenKind.IDENTIFIER,
      identifier: slice.slice(0, identLength),
    },
    identLength,
  ];
}

/// Tries to parse a comment token at current position.
///
/// Returns `null` if the current position cannot contain a comment.
export function tryParseComment(slice: string): ParseResult<CommentTokenData> {
  if (util.isCommentChar(slice.charCodeAt(0))) {
    const commentSlice = slice.slice(1);
    const length = util.countStarting(
      char => !util.isNewline(char),
      commentSlice
    );

    return [
      {
        kind: LexerTokenKind.COMMENT,
        comment: commentSlice.slice(0, length),
      },
      length + 1,
    ];
  } else {
    return null;
  }
}
