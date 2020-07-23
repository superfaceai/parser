import { Location, Span } from '../source';
import * as util from './util';

/** Enum describing the different kinds of tokens that the lexer emits. */
export const enum LexerTokenKind {
  SEPARATOR, // SOF/EOF, (), [], {}
  OPERATOR, // :, !, +, -, |, =, @
  LITERAL, // number or boolean
  STRING, // string literals - separate because it makes later stages easier
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
export type OperatorValue = ':' | '+' | '-' | '!' | '|' | '=' | '@';
export const OPERATORS: { [P in OperatorValue]: LexerScanRule<P> } = {
  ':': [':', util.isAny],
  '+': ['+', util.isAny],
  '-': ['-', util.isAny],
  '!': ['!', util.isAny],
  '|': ['|', util.isAny],
  '=': ['=', util.isAny],
  '@': ['@', util.isAny],
};

// Literals
export const LITERALS_BOOL: Record<string, LexerScanRule<boolean>> = {
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
  | IdentifierTokenData
  | CommentTokenData;

export function formatTokenKind(kind: LexerTokenKind): string {
  switch (kind) {
    case LexerTokenKind.SEPARATOR:
      return 'separator';
    case LexerTokenKind.OPERATOR:
      return 'operator';
    case LexerTokenKind.LITERAL:
      return 'literal';
    case LexerTokenKind.STRING:
      return 'string';
    case LexerTokenKind.IDENTIFIER:
      return 'identifier';
    case LexerTokenKind.COMMENT:
      return 'comment';
  }
}
export function formatTokenData(
  data: LexerTokenData
): { kind: string; data: string } {
  switch (data.kind) {
    case LexerTokenKind.SEPARATOR:
      return { kind: 'separator', data: data.separator.toString() };
    case LexerTokenKind.OPERATOR:
      return { kind: 'operator', data: data.operator.toString() };
    case LexerTokenKind.LITERAL:
      return { kind: 'literal', data: data.literal.toString() };
    case LexerTokenKind.STRING:
      return { kind: 'string', data: data.string.toString() };
    case LexerTokenKind.IDENTIFIER:
      return { kind: 'identifier', data: data.identifier.toString() };
    case LexerTokenKind.COMMENT:
      return { kind: 'comment', data: data.comment.toString() };
  }
}

// Token class //

export class LexerToken {
  constructor(
    /** Data of the token. */
    readonly data: LexerTokenData,
    /** Span of the source code which this token covers. */
    readonly span: Span,
    /** Location in the formatted source code of this token. */
    readonly location: Location
  ) {}

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

  toStringDebug(): string {
    return `(${this})@${this.location.line}:${this.location.column}[${this.span.start}; ${this.span.end}]`;
  }

  toString(): string {
    return this[Symbol.toStringTag]();
  }

  [Symbol.toStringTag](): string {
    const fmt = formatTokenData(this.data);

    return `${fmt.kind} \`${fmt.data}\``;
  }
}
