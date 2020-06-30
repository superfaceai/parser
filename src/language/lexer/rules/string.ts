import { LexerTokenKind, StringTokenData } from '../token';
import * as util from '../util';
import { ParseError, ParseResult } from './rules';

function resolveStringLiteralEscape(
  slice: string
): { length: number; value: string } | null {
  const firstChar = slice.charCodeAt(0);

  let result;
  switch (firstChar) {
    case 34:
      result = '"';
      break;

    case 39:
      result = "'";
      break;

    case 92:
      result = '\\';
      break;

    case 110:
      result = '\n';
      break;

    case 114:
      result = '\r';
      break;

    case 116:
      result = '\t';
      break;

    default:
      return null;
  }

  return {
    value: result,
    length: 1,
  };
}

/// Tries to parse a string literal token at current position.
///
/// Returns `null` if the current position cannot contain a string literal.
///
/// Returns an error if parsing fails.
export function tryParseStringLiteral(
  slice: string
): ParseResult<StringTokenData> {
  const firstChar = slice.charCodeAt(0);
  if (!util.isStringLiteralChar(firstChar)) {
    return null;
  }

  let startingQuoteChars = util.countStarting(
    char => char === firstChar,
    slice
  );

  // Special case where the string is empty ('' or "")
  if (startingQuoteChars === 2) {
    return [
      {
        kind: LexerTokenKind.STRING,
        string: '',
      },
      2,
    ];
  }
  // Special case where a triple-quoted string is empty ('''''' or """""")
  if (startingQuoteChars >= 6) {
    return [
      {
        kind: LexerTokenKind.STRING,
        string: '',
      },
      6,
    ];
  }

  // In case there are 4 or 5 quote chars in row, we treat the 4th and 5th as part of the string itself.
  if (startingQuoteChars > 3) {
    startingQuoteChars = 3;
  }

  /// non-block strings allow escaping characters, so the predicate must different
  let nonquotePredicate: (_: number) => boolean;
  if (startingQuoteChars === 1) {
    nonquotePredicate = (char: number): boolean =>
      char !== firstChar && !util.isStringLiteralEscapeChar(char);
  } else {
    nonquotePredicate = (char: number): boolean => char !== firstChar;
  }

  // Now parse the body of the string
  let resultString = '';
  let restSlice = slice.slice(startingQuoteChars);
  let eatenChars = startingQuoteChars;

  // Closure to reduce repeating
  const eatChars = (count: number, add?: boolean | string): void => {
    if (typeof add === 'boolean') {
      resultString += restSlice.slice(0, count);
    } else if (typeof add === 'string') {
      resultString += add;
    }

    restSlice = restSlice.slice(count);
    eatenChars += count;
  };

  for (;;) {
    // Eat all nonquote chars and update the count
    const nonquoteChars = util.countStarting(nonquotePredicate, restSlice);
    eatChars(nonquoteChars);

    // Now we hit either:
    // * Quote chars
    // * Escape chars (only in line strings)
    // * EOF
    const nextChar = restSlice.charCodeAt(0);
    if (isNaN(nextChar)) {
      return new ParseError(
        LexerTokenKind.STRING,
        { start: 0, end: eatenChars },
        'Unexpected EOF'
      );
    } else if (util.isStringLiteralEscapeChar(nextChar)) {
      // Eat the backslash
      eatChars(1, false);

      const escapeResult = resolveStringLiteralEscape(restSlice);
      if (escapeResult === null) {
        return new ParseError(
          LexerTokenKind.STRING,
          { start: 0, end: eatenChars + 1 },
          'Invalid escape sequence'
        );
      }

      eatChars(escapeResult.length, escapeResult.value);
    } else if (nextChar === firstChar) {
      const quoteChars = util.countStarting(
        char => char === firstChar,
        restSlice
      );

      // Check for string literal end
      if (quoteChars >= startingQuoteChars) {
        // Make sure to only eat matching number of quote chars at the end
        eatenChars += startingQuoteChars;
        break;
      }

      // Just some quote chars inside the literal, moving on
      eatChars(quoteChars);
    } else {
      throw 'Invalid lexer state. This in an error in the lexer.';
    }
  }

  // TODO: transform in case it's a block string

  return [
    {
      kind: LexerTokenKind.STRING,
      string: resultString,
    },
    eatenChars,
  ];
}
