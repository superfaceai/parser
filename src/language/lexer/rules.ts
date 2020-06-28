import { Span } from '../source';
import {
  LexerTokenKind,
  LexerTokenData,
  SeparatorTokenData,
  SeparatorValue,
  OperatorTokenData,
  DecoratorTokenData,
  DecoratorValue,
  LiteralTokenData,
  OperatorValue,
  KeywordTokenData,
  KeywordValue,
  IdentifierTokenData,
  CommentTokenData,
  DocTokenData,
} from './token';
import * as util from './util';

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

type ParseResult<T extends LexerTokenData> = ([T, number] | null) | ParseError;

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

  const charCode = slice.charCodeAt(0);
  let separator: SeparatorValue;
  switch (charCode) {
    case 40: // (
      separator = '(';
      break;
    case 41: // )
      separator = ')';
      break;
    case 91: // [
      separator = '[';
      break;
    case 93: // ]
      separator = ']';
      break;
    case 123: // {
      separator = '{';
      break;
    case 125: // }
      separator = '}';
      break;

    default:
      return null;
  }

  return [
    {
      kind: LexerTokenKind.SEPARATOR,
      separator,
    },
    1,
  ];
}

/// Tries to parse an operator token at current position.
///
/// Returns `null` if the current position cannot contain an operator.
export function tryParseOperator(
  slice: string
): ParseResult<OperatorTokenData> {
  const charCode = slice.charCodeAt(0);

  let operatorValue: OperatorValue;
  switch (charCode) {
    case 58: // :
      operatorValue = ':';
      break;

    case 43:
      operatorValue = '+';
      break;

    case 45: // -
      operatorValue = '-';
      break;

    default:
      return null;
  }

  return [
    {
      kind: LexerTokenKind.OPERATOR,
      operator: operatorValue,
    },
    operatorValue.length,
  ];
}

function tryParseLiteralBoolean(slice: string): ParseResult<LiteralTokenData> {
  const keywordLiteralBool =
    util.checkKeywordLiteral(slice, 'true', true) ??
    util.checkKeywordLiteral(slice, 'false', false);
  if (keywordLiteralBool !== null) {
    return [
      {
        kind: LexerTokenKind.LITERAL,
        literal: keywordLiteralBool.value,
      },
      keywordLiteralBool.length,
    ];
  }

  return null;
}

function tryParseLiteralString(slice: string): ParseResult<LiteralTokenData> {
  if (!util.isStringLiteralChar(slice.charCodeAt(0))) {
    return null;
  }

  const stringSlice = slice.slice(1);
  const literalStringLength = util.countStarting(
    char => !util.isStringLiteralChar(char),
    stringSlice
  );

  const nextChar = stringSlice.charCodeAt(literalStringLength);
  if (isNaN(nextChar)) {
    return new ParseError(
      LexerTokenKind.LITERAL,
      { start: 0, end: literalStringLength + 1 },
      'Unexpected EOF'
    );
  }
  if (!util.isStringLiteralChar(nextChar)) {
    throw 'Invalid lexer state. This in an error in the lexer.';
  }

  return [
    {
      kind: LexerTokenKind.LITERAL,
      literal: stringSlice.slice(0, literalStringLength),
    },
    1 + literalStringLength + 1,
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
    util.checkKeywordLiteral(slice, '0b', 2, _ => true) ??
    util.checkKeywordLiteral(slice, '0o', 8, _ => true) ?? {
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
  return (
    tryParseLiteralBoolean(slice) ??
    tryParseLiteralString(slice) ??
    tryParseLiteralNumber(slice)
  );
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
  const decoratorSlice = slice.slice(1);

  const decoratorKeyword =
    util.checkKeywordLiteral<DecoratorValue>(decoratorSlice, 'safe', 'safe') ??
    util.checkKeywordLiteral<DecoratorValue>(
      decoratorSlice,
      'unsafe',
      'unsafe'
    ) ??
    util.checkKeywordLiteral<DecoratorValue>(
      decoratorSlice,
      'idempotent',
      'idempotent'
    );
  if (decoratorKeyword === null) {
    return new ParseError(
      LexerTokenKind.DECORATOR,
      { start: 0, end: 2 },
      `Expected one of [safe, unsafe, idempotent]`
    );
  }

  return [
    {
      kind: LexerTokenKind.DECORATOR,
      decorator: decoratorKeyword.value,
    },
    decoratorKeyword.length + 1,
  ];
}

/// Tries to parse a keyword token at current position.
///
/// Returns `null` if the current position cannot contain a keyword.
export function tryParseKeyword(slice: string): ParseResult<KeywordTokenData> {
  const keyword =
    util.checkKeywordLiteral<KeywordValue>(slice, 'usecase', 'usecase') ??
    util.checkKeywordLiteral<KeywordValue>(slice, 'field', 'field') ??
    util.checkKeywordLiteral<KeywordValue>(slice, 'map', 'map') ??
    util.checkKeywordLiteral<KeywordValue>(slice, 'Number', 'Number') ??
    util.checkKeywordLiteral<KeywordValue>(slice, 'String', 'String') ??
    util.checkKeywordLiteral<KeywordValue>(slice, 'Boolean', 'Boolean');
  if (keyword === null) {
    return null;
  }

  return [
    {
      kind: LexerTokenKind.KEYWORD,
      keyword: keyword.value,
    },
    keyword.length,
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

/// Tries to parse a doc token at current position.
///
/// Returns `null` if the current position cannot contain a doc.
///
/// Returns an error if parsing fails.
export function tryParseDoc(slice: string): ParseResult<DocTokenData> {
  const startingDocChars = util.countStartingDocChars(slice);
  // TODO: Limit to only single and triple groups?

  if (startingDocChars === 0) {
    return null;
  }

  let eatenChars = startingDocChars;
  let docSliceRest = slice.slice(startingDocChars);
  while (true) {
    const nondocChars = util.countStarting(
      char => !util.isDocChar(char),
      docSliceRest
    );
    docSliceRest = docSliceRest.slice(nondocChars);
    eatenChars += nondocChars;

    const docChars = util.countStartingDocChars(docSliceRest);
    if (docChars >= startingDocChars) {
      eatenChars += startingDocChars;
      break;
    } else {
      docSliceRest = docSliceRest.slice(docChars);
      eatenChars += docChars;
    }

    if (docSliceRest.length === 0) {
      return new ParseError(
        LexerTokenKind.DOC,
        { start: 0, end: eatenChars },
        'Unexpected EOF'
      );
    }
  }

  return [
    {
      kind: LexerTokenKind.DOC,
      doc: slice.slice(startingDocChars, eatenChars - startingDocChars),
    },
    eatenChars,
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
