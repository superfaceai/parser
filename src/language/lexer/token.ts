import { Location, Span } from '../source';
import * as util from './util';

/// Enum describing the different kinds of tokens that the lexer emits.
export const enum LexerTokenKind {
  SEPARATOR, // SOF/EOF, (), [], {}
  OPERATOR, // :, !, +, -
  LITERAL, // number or boolean
  STRING, // string literals - separate because it makes later stages easier
  DECORATOR, // @safe, @unsafe, @idempotent
  IDENTIFIER, // a-z A-Z _
  COMMENT, // line comments (# foo)
}

export type LexerScanRule<T> = [T, (_: number) => boolean];

// Separators
export type SeparatorFile = 'SOF' | 'EOF';
export type SeparatorParen = '(' | ')';
export type SeparatorBracket = '[' | ']';
export type SeparatorBrace = '{' | '}';
export type SeparatorValue =
  | SeparatorFile
  | SeparatorParen
  | SeparatorBracket
  | SeparatorBrace;
export const SEPARATORS: {
  [P in SeparatorParen | SeparatorBracket | SeparatorBrace]: LexerScanRule<P>;
} = {
  '(': ['(', util.isAny],
  ')': [')', util.isAny],
  '[': ['[', util.isAny],
  ']': [']', util.isAny],
  '{': ['{', util.isAny],
  '}': ['}', util.isAny],
};

// Operators
export type OperatorValue = ':' | '+' | '-' | '!' | '|';
export const OPERATORS: { [P in OperatorValue]: LexerScanRule<P> } = {
  ':': [':', util.isAny],
  '+': ['+', util.isAny],
  '-': ['-', util.isAny],
  '!': ['!', util.isAny],
  '|': ['|', util.isAny],
};

// Literals
export const LITERALS_BOOL: {
  [x: string]: LexerScanRule<boolean>;
} = {
  true: [true, util.isNotValidIdentifierChar],
  false: [false, util.isNotValidIdentifierChar],
};
export type LiteralValue = number | boolean;
export type StringValue = string;

// Decorators
export type DecoratorValue = 'safe' | 'unsafe' | 'idempotent';
export const DECORATORS: { [P in DecoratorValue]: LexerScanRule<P> } = {
  safe: ['safe', util.isNotValidIdentifierChar],
  unsafe: ['unsafe', util.isNotValidIdentifierChar],
  idempotent: ['idempotent', util.isNotValidIdentifierChar],
};

export type IdentifierValue = string;
export type CommentValue = string;

// Token datas //

export interface SeparatorTokenData {
  kind: LexerTokenKind.SEPARATOR;
  separator: SeparatorValue;
}
export interface OperatorTokenData {
  kind: LexerTokenKind.OPERATOR;
  operator: OperatorValue;
}
export interface LiteralTokenData {
  kind: LexerTokenKind.LITERAL;
  literal: LiteralValue;
}
export interface StringTokenData {
  kind: LexerTokenKind.STRING;
  string: StringValue;
}
export interface DecoratorTokenData {
  kind: LexerTokenKind.DECORATOR;
  decorator: DecoratorValue;
}
export interface IdentifierTokenData {
  kind: LexerTokenKind.IDENTIFIER;
  identifier: IdentifierValue;
}
export interface CommentTokenData {
  kind: LexerTokenKind.COMMENT;
  comment: CommentValue;
}

export type LexerTokenData =
  | SeparatorTokenData
  | OperatorTokenData
  | LiteralTokenData
  | StringTokenData
  | DecoratorTokenData
  | IdentifierTokenData
  | CommentTokenData;

export function formatTokenData(data: LexerTokenData): string {
  switch (data.kind) {
    case LexerTokenKind.SEPARATOR:
      return `SEP ${data.separator}`;
    case LexerTokenKind.OPERATOR:
      return `OP ${data.operator}`;
    case LexerTokenKind.LITERAL:
      return `LIT ${data.literal}`;
    case LexerTokenKind.STRING:
      return `STR ${data.string}`;
    case LexerTokenKind.DECORATOR:
      return `DEC ${data.decorator}`;
    case LexerTokenKind.IDENTIFIER:
      return `ID ${data.identifier}`;
    case LexerTokenKind.COMMENT:
      return `COM ${data.comment}`;
  }
}

// Token class //

export class LexerToken {
  /// Data of the token.
  readonly data: LexerTokenData;

  /// Span of the source code which this token covers.
  readonly span: Span;
  /// Location in the formatted source code of this token.
  readonly location: Location;

  constructor(data: LexerTokenData, span: Span, location: Location) {
    this.data = data;
    this.span = span;
    this.location = location;
  }

  isSOF(): boolean {
    return (
      this.data.kind == LexerTokenKind.SEPARATOR &&
      this.data.separator === 'SOF'
    );
  }

  isEOF(): boolean {
    return (
      this.data.kind == LexerTokenKind.SEPARATOR &&
      this.data.separator === 'EOF'
    );
  }

  formatDebug(): string {
    return `(${formatTokenData(this.data)})@${this.location.line}:${
      this.location.column
    }[${this.span.start}; ${this.span.end}]`;
  }
}
