import { Location, Span } from '../source';
import * as util from './util';

/** Enum describing the different kinds of tokens that the lexer emits. */
export const enum LexerTokenKind {
  SEPARATOR, // SOF/EOF, (), [], {}
  OPERATOR, // :, !, +, -, |, =, @, ,, ;
  LITERAL, // number or boolean
  STRING, // string literals - separate because it makes later stages easier
  IDENTIFIER, // a-z A-Z _ 0-9
  COMMENT, // line comments (# foo)
  JESSIE_SCRIPT, // Jessie script
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
export type OperatorValue = ':' | '+' | '-' | '!' | '|' | '=' | '@' | ',' | ';';
export const OPERATORS: { [P in OperatorValue]: LexerScanRule<P> } = {
  ':': [':', util.isAny],
  '+': ['+', util.isAny],
  '-': ['-', util.isAny],
  '!': ['!', util.isAny],
  '|': ['|', util.isAny],
  '=': ['=', util.isAny],
  '@': ['@', util.isAny],
  ',': [',', util.isAny],
  ';': [';', util.isAny],
};

// Literals
export const LITERALS_BOOL: Record<string, LexerScanRule<boolean>> = {
  true: [true, util.isNotValidIdentifierChar],
  false: [false, util.isNotValidIdentifierChar],
};
export type LiteralValue = number | boolean;
export type StringValue = string;

export type IdentifierValue = string;
export type CommentValue = string;

export type JessieScriptValue = string;

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
export interface JessieScriptTokenData {
  kind: LexerTokenKind.JESSIE_SCRIPT;
  script: JessieScriptValue;
  sourceMap: string;
}

export type DefaultSublexerTokenData =
  | SeparatorTokenData
  | OperatorTokenData
  | LiteralTokenData
  | StringTokenData
  | IdentifierTokenData
  | CommentTokenData;
export type JessieSublexerTokenData = JessieScriptTokenData;

export type LexerTokenData = DefaultSublexerTokenData | JessieSublexerTokenData;

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
    case LexerTokenKind.JESSIE_SCRIPT:
      return 'jessie script';
  }
}
export function formatTokenData(
  data: LexerTokenData
): { kind: string; data: string } {
  const kind = formatTokenKind(data.kind);
  switch (data.kind) {
    case LexerTokenKind.SEPARATOR:
      return { kind, data: data.separator.toString() };
    case LexerTokenKind.OPERATOR:
      return { kind, data: data.operator.toString() };
    case LexerTokenKind.LITERAL:
      return { kind, data: data.literal.toString() };
    case LexerTokenKind.STRING:
      return { kind, data: data.string.toString() };
    case LexerTokenKind.IDENTIFIER:
      return { kind, data: data.identifier.toString() };
    case LexerTokenKind.COMMENT:
      return { kind, data: data.comment.toString() };
    case LexerTokenKind.JESSIE_SCRIPT:
      return { kind, data: data.script.toString() };
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
    return `(${this.toString()})@${this.location.line}:${
      this.location.column
    }[${this.span.start}; ${this.span.end}]`;
  }

  toString(): string {
    return this[Symbol.toStringTag]();
  }

  [Symbol.toStringTag](): string {
    const fmt = formatTokenData(this.data);

    return `${fmt.kind} \`${fmt.data}\``;
  }
}
