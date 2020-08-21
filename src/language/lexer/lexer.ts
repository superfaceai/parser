import { SyntaxError } from '../error';
import { Source } from '../source';
import { ParseError, ParseResult } from './sublexer';
import { tryParseDefault } from './sublexer/default';
import { tryParseJessieScriptExpression } from './sublexer/jessie';
import {
  DefaultSublexerTokenData,
  JessieSublexerTokenData,
  LexerToken,
  LexerTokenData,
  LexerTokenKind,
} from './token';
import * as util from './util';

export type LexerTokenKindFilter = { [K in LexerTokenKind]: boolean };
export const DEFAULT_TOKEN_KIND_FILER: LexerTokenKindFilter = {
  [LexerTokenKind.COMMENT]: true,
  [LexerTokenKind.IDENTIFIER]: false,
  [LexerTokenKind.LITERAL]: false,
  [LexerTokenKind.OPERATOR]: false,
  [LexerTokenKind.SEPARATOR]: false,
  [LexerTokenKind.STRING]: false,
  [LexerTokenKind.JESSIE_SCRIPT]: false,
};

export const enum LexerContext {
  /**
   * Default lexer context for parsing the profile and map languages.
   */
  DEFAULT,
  /**
   * Lexer context for parsing Jessie script expressions.
   */
  JESSIE_SCRIPT_EXPRESSION,
}
export type Sublexer<C extends LexerContext> = (
  slice: string
) => ParseResult<SublexerReturnType<C>>;
export type SublexerReturnType<
  C extends LexerContext
> = C extends LexerContext.DEFAULT
  ? DefaultSublexerTokenData
  : C extends LexerContext.JESSIE_SCRIPT_EXPRESSION
  ? JessieSublexerTokenData
  : never;

/**
 * Lexer tokenizes input string into tokens.
 *
 * The lexer generates a stream of tokens, always starting with SEPARATOR SOF and always ending with SEPARATOR EOF.
 * The stream can be consumed by calling `advance`. After each advance, `lookahead` will provide access to the next
 * token without consuming it.
 * After EOF is emitted, all further calls to `advance` and `lookahead` will return the same EOF.
 *
 * An optional `tokenKindFilter` parameter can be provided to filter
 * the tokens returned by `advance` and `lookahead`. By default, this filter skips comment nodes.
 *
 * The advance function also accepts an optional `context` parameter which can be used to control the lexer context
 * for the next token.
 */
export class Lexer {
  private readonly sublexers: {
    [C in LexerContext]: Sublexer<C>;
  };

  /** Last emitted token. */
  private currentToken: LexerToken;
  /** Next token after `currentToken`, stored when `lookahead` is called. */
  private nextToken: LexerToken | undefined;

  /** Indexed from 1 */
  private currentLine: number;
  /** Character offset in the `source.body` at which current line begins. */
  private currentLineStart: number;

  private readonly tokenKindFilter: LexerTokenKindFilter;

  constructor(readonly source: Source, tokenKindFilter?: LexerTokenKindFilter) {
    this.sublexers = {
      [LexerContext.DEFAULT]: tryParseDefault,
      [LexerContext.JESSIE_SCRIPT_EXPRESSION]: tryParseJessieScriptExpression,
    };

    this.currentToken = new LexerToken(
      {
        kind: LexerTokenKind.SEPARATOR,
        separator: 'SOF',
      },
      { start: 0, end: 0 },
      { line: 1, column: 1 }
    );
    this.nextToken = this.currentToken;

    this.currentLine = 1;
    this.currentLineStart = 0;

    this.tokenKindFilter = tokenKindFilter ?? DEFAULT_TOKEN_KIND_FILER;
  }

  /** Advances the lexer returning the current token. */
  advance(context?: LexerContext): LexerToken {
    this.currentToken = this.lookahead(context);
    this.nextToken = undefined;

    return this.currentToken;
  }

  /** Returns the next token without advancing the lexer. */
  lookahead(context?: LexerContext): LexerToken {
    // EOF forever
    if (this.currentToken.isEOF()) {
      return this.currentToken;
    }

    // read next token if not read already
    if (this.nextToken === undefined) {
      this.nextToken = this.readNextToken(this.currentToken, context);
    }
    // skip tokens if they are caught by the filter
    while (this.tokenKindFilter[this.nextToken.data.kind]) {
      this.nextToken = this.readNextToken(this.nextToken, context);
    }

    return this.nextToken;
  }

  /**
   * Returns a generator adaptor that produces generator-compatible values.
   *
   * The generator yields the result of `advance()` until `EOF` token is found, at which point it returns the `EOF` token.
   */
  [Symbol.iterator](): Generator<
    LexerToken,
    undefined,
    LexerContext | undefined
  > {
    // This rule is intended to catch assigning `this` to a variable when an arrow function would suffice
    // Generators cannot be defined using an arrow function and thus don't preserve `this`
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const lexer = this;

    function* generatorClosure(): Generator<
      LexerToken,
      undefined,
      LexerContext | undefined
    > {
      let currentToken = lexer.advance(); // No way to specify context for the first invocation.

      while (!currentToken.isEOF()) {
        const context = yield currentToken;
        currentToken = lexer.advance(context);
      }

      // Yield the EOF once
      yield currentToken;

      return undefined;
    }

    return generatorClosure();
  }

  /** Reads the next token following the `afterToken`. */
  private readNextToken(
    afterToken: LexerToken,
    context?: LexerContext
  ): LexerToken {
    // Compute the start of the next token by ignoring whitespace after last token.
    const start =
      afterToken.span.end +
      this.countStartingWithNewlines(util.isWhitespace, afterToken.span.end);
    const location = {
      line: this.currentLine,
      column: start - this.currentLineStart + 1,
    };

    const slice = this.source.body.slice(start);

    // Call one of the sublexers
    let tokenParseResult: ParseResult<LexerTokenData>;
    switch (context ?? LexerContext.DEFAULT) {
      case LexerContext.DEFAULT:
        tokenParseResult = this.sublexers[LexerContext.DEFAULT](slice);
        break;

      case LexerContext.JESSIE_SCRIPT_EXPRESSION:
        tokenParseResult = this.sublexers[
          LexerContext.JESSIE_SCRIPT_EXPRESSION
        ](slice);
        break;
    }

    // Didn't parse as any known token
    if (tokenParseResult === undefined) {
      throw new SyntaxError(
        this.source,
        location,
        { start, end: start },
        'Could not match any token'
      );
    }

    // Parsing error
    if (tokenParseResult instanceof ParseError) {
      throw new SyntaxError(
        this.source,
        location,
        {
          start: start + tokenParseResult.span.start,
          end: start + tokenParseResult.span.end,
        },
        tokenParseResult.detail
      );
    }

    // Go over the characters the token covers and count newlines, updating the state.
    this.countStartingWithNewlines(
      _ => true,
      start,
      start + tokenParseResult[1]
    );

    // All is well
    return new LexerToken(
      tokenParseResult[0],
      { start, end: start + tokenParseResult[1] },
      location
    );
  }

  /**
   * Returns the count from `countStarting` and updates inner state
   * with the newlines encountered.
   */
  private countStartingWithNewlines(
    predicate: (_: number) => boolean,
    start: number,
    end?: number
  ): number {
    const res = util.countStartingWithNewlines(
      predicate,
      this.source.body.slice(start, end)
    );

    this.currentLine += res.newlines;
    if (typeof res.lastNewlineOffset === 'number') {
      // Plus one because the new line starts after the newline
      this.currentLineStart = start + res.lastNewlineOffset + 1;
    }

    return res.count;
  }
}
