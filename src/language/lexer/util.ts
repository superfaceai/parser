/// Counts starting characters from `str` as long as `predicate` returns true.
///
/// Returns number of characters at the start of the string that match predicate.
///
/// This function is basically a find over the input string with the predicate.
export function countStarting(
  predicate: (_: number) => boolean,
  str: string
): number {
  let position = 0;
  let code = str.charCodeAt(position);
  while (!isNaN(code) && predicate(code)) {
    position += 1;
    code = str.charCodeAt(position);
  }

  return position;
}

export function isLetter(char: number): boolean {
  // A-Z, a-z
  return (char >= 65 && char <= 90) || (char >= 97 && char <= 122);
}
export const countStartingLetters = countStarting.bind(undefined, isLetter);

export function isValidIdentifierChar(char: number): boolean {
  // _
  return char === 95 || isLetter(char);
}
export const countStartingIdentifierChars = countStarting.bind(
  undefined,
  isValidIdentifierChar
);

export function isBinaryNumber(char: number): boolean {
  // 0, 1
  return char === 48 || char === 49;
}
export function isOctalNumber(char: number): boolean {
  // 0-7
  return char >= 48 && char <= 55;
}
export function isDecimalNumber(char: number): boolean {
  // 0-9
  return char >= 48 && char <= 57;
}
export function isHexadecimalNumber(char: number): boolean {
  // 0-9, A-F, a-f
  return (
    (char >= 48 && char <= 57) ||
    (char >= 65 && char <= 70) ||
    (char >= 97 && char <= 102)
  );
}
export const countStartingNumbers = countStarting.bind(
  undefined,
  isDecimalNumber
);
export function countStartingNumbersRadix(str: string, radix: number): number {
  switch (radix) {
    case 2:
      return countStarting(isBinaryNumber, str);

    case 8:
      return countStarting(isOctalNumber, str);

    case 10:
      return countStarting(isDecimalNumber, str);

    case 16:
      return countStarting(isHexadecimalNumber, str);

    default:
      throw 'Radix ${radix} is not supported (supported: 2, 8, 10, 16).';
  }
}

export function isDecimalSeparator(char: number): boolean {
  return char === 46;
}

export function isWhitespace(char: number): boolean {
  // tab, space, BOM, newline
  return char === 9 || char === 32 || char === 0xfeff || char === 10;
}
export function isNewline(char: number): boolean {
  return char === 10;
}

/// Same as count starting, but also counts number of newlines counted and returns
/// the offset of last counted newline.
export function countStartingWithNewlines(
  predicate: (_: number) => boolean,
  str: string
): { count: number; newlines: number; lastNewlineOffset?: number } {
  let newlines = 0;
  let lastNewlineOffset = undefined;
  let position = 0;

  // Use a closure that mutates environment
  // Its hacky but it avoid duplicating the body of `countStarting`
  // In general, this would be a short-circuiting fold over the input string.
  const count = countStarting(char => {
    // Returning false ends `countStarting`.
    if (!predicate(char)) {
      return false;
    }

    // Newline passed the predicate so count it in.
    if (isNewline(char)) {
      newlines += 1;
      lastNewlineOffset = position;
    }

    position += 1;

    return true;
  }, str);

  return {
    count,
    newlines,
    lastNewlineOffset,
  };
}

export function isStringLiteralChar(char: number): boolean {
  // "
  return char === 34;
}
export function isDecoratorChar(char: number): boolean {
  // @
  return char === 64;
}
export function isDocChar(char: number): boolean {
  // '
  return char === 39;
}
export const countStartingDocChars = countStarting.bind(undefined, isDocChar);

export function isCommentChar(char: number): boolean {
  // #
  return char === 35;
}

/// Checks if the following characters match the specified keyword and are followed
/// by a character matching an optional predicate.
///
/// If the predicate is not specified, the default predicate is `!isValidIdentifierChar`
export function checkKeywordLiteral<T>(
  str: string,
  keyword: string,
  ret: T,
  charAfterPredicate?: (_: number) => boolean
): { value: T; length: number } | null {
  if (str.startsWith(keyword)) {
    const checkPredicate =
      charAfterPredicate ??
      ((char: number): boolean => !isValidIdentifierChar(char));
    const charAfter = str.charCodeAt(keyword.length);
    if (!checkPredicate(charAfter)) {
      return null;
    }

    return {
      value: ret,
      length: keyword.length,
    };
  } else {
    return null;
  }
}
