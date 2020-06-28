import { Location, Span } from '../source';

/// Enum describing the different kinds of tokens that the lexer emits.
export const enum LexerTokenKind {
  SEPARATOR, // SOF/EOF, (), [], {}
  OPERATOR, // :, +, -
  LITERAL, // number, string or boolean, though boolean literals are basically just keywords
  DECORATOR, // @safe, @unsafe, @idempotent
  KEYWORD, // usecase, field, map, Number, String, Boolean
  IDENTIFIER, // a-z A-Z _
  DOC, // ' and '''
  COMMENT, // line comments (# foo)
}

export type SeparatorFile = 'SOF' | 'EOF';
export type SeparatorParen = '(' | ')';
export type SeparatorBracket = '[' | ']';
export type SeparatorBrace = '{' | '}';
export type SeparatorValue =
  | SeparatorFile
  | SeparatorParen
  | SeparatorBracket
  | SeparatorBrace;

export type OperatorValue = ':' | '+' | '-';
export type LiteralValue = number | boolean | string;
export type DecoratorValue = 'safe' | 'unsafe' | 'idempotent';
export type KeywordValue =
  | 'usecase'
  | 'field'
  | 'map'
  | 'Number'
  | 'String'
  | 'Boolean';
export type IdentifierValue = string;
export type DocValue = string;
export type CommentValue = string;

export interface LexerTokenData {
  kind: LexerTokenKind;
}
export function formatTokenData(data: LexerTokenDataType): string {
  switch (data.kind) {
    case LexerTokenKind.SEPARATOR:
      return `SEP ${data.separator}`;
    case LexerTokenKind.OPERATOR:
      return `OP ${data.operator}`;
    case LexerTokenKind.LITERAL:
      return `LIT ${data.literal}`;
    case LexerTokenKind.DECORATOR:
      return `DEC ${data.decorator}`;
    case LexerTokenKind.KEYWORD:
      return `KEY ${data.keyword}`;
    case LexerTokenKind.IDENTIFIER:
      return `ID ${data.identifier}`;
    case LexerTokenKind.DOC:
      return `DOC ${data.doc}`;
    case LexerTokenKind.COMMENT:
      return `COM ${data.comment}`;
  }
}

export interface SeparatorTokenData extends LexerTokenData {
  kind: LexerTokenKind.SEPARATOR;
  separator: SeparatorValue;
}
export interface OperatorTokenData extends LexerTokenData {
  kind: LexerTokenKind.OPERATOR;
  operator: OperatorValue;
}
export interface LiteralTokenData extends LexerTokenData {
  kind: LexerTokenKind.LITERAL;
  literal: LiteralValue;
}
export interface DecoratorTokenData extends LexerTokenData {
  kind: LexerTokenKind.DECORATOR;
  decorator: DecoratorValue;
}
export interface KeywordTokenData extends LexerTokenData {
  kind: LexerTokenKind.KEYWORD;
  keyword: KeywordValue;
}
export interface IdentifierTokenData extends LexerTokenData {
  kind: LexerTokenKind.IDENTIFIER;
  identifier: IdentifierValue;
}
export interface DocTokenData extends LexerTokenData {
  kind: LexerTokenKind.DOC;
  doc: DocValue;
}
export interface CommentTokenData extends LexerTokenData {
  kind: LexerTokenKind.COMMENT;
  comment: CommentValue;
}

export type LexerTokenDataType =
  | SeparatorTokenData
  | OperatorTokenData
  | LiteralTokenData
  | DecoratorTokenData
  | KeywordTokenData
  | IdentifierTokenData
  | DocTokenData
  | CommentTokenData;
export class LexerToken {
  /// Data of the token.
  readonly data: LexerTokenDataType;

  /// Span of the source code which this token covers.
  readonly span: Span;
  /// Location in the formatted source code of this token.
  readonly location: Location;

  /// Tokens form a doubly-linked list.
  readonly last: LexerToken | null;
  next: LexerToken | null;

  constructor(
    data: LexerTokenDataType,
    span: Span,
    location: Location,
    last: LexerToken | null
  ) {
    this.data = data;
    this.span = span;
    this.location = location;
    this.last = last;
    this.next = null;
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
