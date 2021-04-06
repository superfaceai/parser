import {
  checkKeywordLiteral,
  countStarting,
  countStartingNumbersRadix,
  countStartingWithNewlines,
  isAny,
  isBinaryNumber,
  isDecimalNumber,
  isDecimalSeparator,
  isDecoratorChar,
  isHexadecimalNumber,
  isLetter,
  isNewline,
  isNotValidIdentifierChar,
  isOctalNumber,
  isStringLiteralChar,
  isStringLiteralEscapeChar,
  isValidIdentifierChar,
  isValidIdentifierStartChar,
  isWhitespace,
} from './util';

describe('util', () => {
  describe('countStarting', () => {
    it('counts position', () => {
      const predicate = (_: number) => true;
      expect(countStarting(predicate, 'test')).toEqual(4);
    });
  });

  describe('isLetter', () => {
    it('checks if input is letter', () => {
      expect(isLetter(67)).toEqual(true);
      expect(isLetter(98)).toEqual(true);
      expect(isLetter(8)).toEqual(false);
    });
  });

  describe('isBinaryNumber', () => {
    it('checks if input is binary number', () => {
      expect(isBinaryNumber(48)).toEqual(true);
      expect(isBinaryNumber(49)).toEqual(true);
      expect(isLetter(8)).toEqual(false);
    });
  });

  describe('isOctalNumber', () => {
    it('checks if input is octal number', () => {
      expect(isOctalNumber(49)).toEqual(true);
      expect(isOctalNumber(55)).toEqual(true);
      expect(isOctalNumber(8)).toEqual(false);
    });
  });

  describe('isDecimalNumber', () => {
    it('checks if input is decimal number', () => {
      expect(isDecimalNumber(49)).toEqual(true);
      expect(isDecimalNumber(57)).toEqual(true);
      expect(isDecimalNumber(8)).toEqual(false);
    });
  });

  describe('isHexadecimalNumber', () => {
    it('checks if input is hexadecimal number', () => {
      expect(isHexadecimalNumber(48)).toEqual(true);
      expect(isHexadecimalNumber(57)).toEqual(true);
      expect(isHexadecimalNumber(65)).toEqual(true);
      expect(isHexadecimalNumber(70)).toEqual(true);
      expect(isHexadecimalNumber(97)).toEqual(true);
      expect(isHexadecimalNumber(102)).toEqual(true);
      expect(isHexadecimalNumber(8)).toEqual(false);
    });
  });

  describe('countStartingNumbersRadix', () => {
    it('count starting numbers if input is hexadecimal number', () => {
      expect(countStartingNumbersRadix('01', 2)).toEqual(2);
      expect(countStartingNumbersRadix('0test', 8)).toEqual(1);
      expect(countStartingNumbersRadix('9324test', 10)).toEqual(4);
      expect(countStartingNumbersRadix('0AfFtest', 16)).toEqual(4);
      expect(() => countStartingNumbersRadix('test', 12)).toThrow(
        'Radix ${radix} is not supported (supported: 2, 8, 10, 16).'
      );
    });
  });

  describe('isDecimalSeparator', () => {
    it('checks if input is decimal separator', () => {
      expect(isDecimalSeparator(46)).toEqual(true);
      expect(isDecimalSeparator(57)).toEqual(false);
    });
  });

  describe('isValidIdentifierStartChar', () => {
    it('checks if input is valid identifier start char', () => {
      expect(isValidIdentifierStartChar(67)).toEqual(true);
      expect(isValidIdentifierStartChar(95)).toEqual(true);
      expect(isValidIdentifierStartChar(7)).toEqual(false);
    });
  });

  describe('isValidIdentifierChar', () => {
    it('checks if input is valid identifier char', () => {
      expect(isValidIdentifierChar(67)).toEqual(true);
      expect(isValidIdentifierChar(95)).toEqual(true);
      expect(isValidIdentifierChar(7)).toEqual(false);
    });
  });

  describe('isWhitespace', () => {
    it('checks if input is whitespace', () => {
      expect(isWhitespace(9)).toEqual(true);
      expect(isWhitespace(32)).toEqual(true);
      expect(isWhitespace(0xfeff)).toEqual(true);
      expect(isWhitespace(10)).toEqual(true);
      expect(isWhitespace(7)).toEqual(false);
    });
  });

  describe('isNewline', () => {
    it('checks if input is newline', () => {
      expect(isNewline(10)).toEqual(true);
      expect(isNewline(7)).toEqual(false);
    });
  });

  describe('countStartingWithNewlines', () => {
    it('counts starting characters with newlines', () => {
      const predicate = (_: number) => isDecimalNumber(_) || isNewline(_);
      expect(countStartingWithNewlines(predicate, '\n\n\t95')).toEqual({
        count: 2,
        newlines: 2,
        lastNewlineOffset: 1,
      });
    });
  });

  describe('isStringLiteralChar', () => {
    it('checks if input is string literal char', () => {
      expect(isStringLiteralChar(34)).toEqual(true);
      expect(isStringLiteralChar(39)).toEqual(true);
      expect(isStringLiteralChar(7)).toEqual(false);
    });
  });

  describe('isStringLiteralEscapeChar', () => {
    it('checks if input is string literal escape char', () => {
      expect(isStringLiteralEscapeChar(92)).toEqual(true);
      expect(isStringLiteralEscapeChar(7)).toEqual(false);
    });
  });

  describe('isAny', () => {
    it('checks if input is any', () => {
      expect(isAny(64)).toEqual(true);
    });
  });

  describe('isDecoratorChar', () => {
    it('checks if input is decorator char', () => {
      expect(isDecoratorChar(64)).toEqual(true);
      expect(isDecoratorChar(7)).toEqual(false);
    });
  });

  describe('isNotValidIdentifierChar', () => {
    it('checks if input is not valid identifier char', () => {
      expect(isNotValidIdentifierChar(67)).toEqual(false);
      expect(isNotValidIdentifierChar(95)).toEqual(false);
      expect(isNotValidIdentifierChar(7)).toEqual(true);
    });
  });

  describe('checkKeywordLiteral', () => {
    it('checks keyword literal without predicate', () => {
      expect(checkKeywordLiteral('testABC', 'test', 'someRet')).toBeUndefined();
    });

    it('checks keyword literal without starting string', () => {
      expect(checkKeywordLiteral('ABC', 'test', 'someRet')).toBeUndefined();
    });

    it('checks keyword literal with predicate', () => {
      expect(
        checkKeywordLiteral('testABC', 'test', 'someRet', isLetter)
      ).toEqual({ length: 4, value: 'someRet' });
    });
  });
});
