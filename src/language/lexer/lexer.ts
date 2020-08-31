import { SyntaxError, SyntaxErrorCategory } from '../error';
import { Location, Source } from '../source';
import { LexerContext, LexerContextType, Sublexer } from './context'
import { tryParseDefault } from './sublexer/default';
import { tryParseJessieScriptExpression } from './sublexer/jessie';
import { ParseResult } from './sublexer/result';
import {
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

export type LexerSavedState = LexerToken;
export interface LexerTokenStream
  extends Generator<LexerToken, undefined, LexerContext | undefined> {
  peek(
    ...context: [] | [LexerContext | undefined]
  ): IteratorResult<LexerToken, undefined>;

  /** Saves the stream state to be restored later. */
  save(): LexerSavedState;

  /** Roll back the state of the stream to the given saved state. */
  rollback(token: LexerSavedState): void;
}

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
export class Lexer implements LexerTokenStream {
  private readonly sublexers: {
    [C in LexerContextType]: Sublexer<C>;
  };

  /** Last emitted token. */
  private currentToken: LexerToken;
  /** Next token after `currentToken`, stored when `lookahead` is called. */
  private nextToken: LexerToken | undefined;

  private readonly tokenKindFilter: LexerTokenKindFilter;

  constructor(readonly source: Source, tokenKindFilter?: LexerTokenKindFilter) {
    this.sublexers = {
      [LexerContextType.DEFAULT]: tryParseDefault,
      [LexerContextType.JESSIE_SCRIPT_EXPRESSION]: tryParseJessieScriptExpression,
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

    this.tokenKindFilter = tokenKindFilter ?? DEFAULT_TOKEN_KIND_FILER;
  }

  /** Advances the lexer returning the current token. */
  advance(context?: LexerContext): LexerToken {
    // We use the `nextToken` field to detect first emission on EOF
    if (this.currentToken.isEOF()) {
      this.nextToken = this.currentToken;

      return this.currentToken;
    }

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

  next(context?: LexerContext): IteratorResult<LexerToken, undefined> {
    const tok = this.advance(context);

    // Ensure that EOF is yielded once
    if (tok.isEOF() && this.nextToken?.isEOF()) {
      return {
        done: true,
        value: undefined,
      };
    }

    return {
      done: false,
      value: tok,
    };
  }
  return(value?: undefined): IteratorResult<LexerToken, undefined> {
    return {
      done: true,
      value,
    };
  }
  throw(e?: unknown): IteratorResult<LexerToken, undefined> {
    throw e;
  }
  [Symbol.iterator](): Generator<
    LexerToken,
    undefined,
    LexerContext | undefined
  > {
    return this;
  }

  peek(context?: LexerContext): IteratorResult<LexerToken, undefined> {
    const tok = this.lookahead(context);

    if (tok.isEOF() && this.currentToken.isEOF()) {
      return {
        done: true,
        value: undefined,
      };
    }

    return {
      done: false,
      value: tok,
    };
  }
  /** Saves the lexer state to be restored later. */
  save(): LexerSavedState {
    return this.currentToken;
  }
  /**
   * Roll back the state of the lexer to the given saved state.
   *
   * The lexer will continue from this state forward.
   */
  rollback(token: LexerSavedState): void {
    this.currentToken = token;
    this.nextToken = undefined;
  }

  private computeNextTokenPosition(
    lastToken: LexerToken
  ): {
    start: number;
    location: Location;
  } {
    // Count number of whitespace and newlines after the last token.
    const whitespaceAfterToken = util.countStartingWithNewlines(
      util.isWhitespace,
      this.source.body.slice(lastToken.span.end)
    );

    // Compute the start of the next token by ignoring whitespace after the last token.
    const start = lastToken.span.end + whitespaceAfterToken.count;

    // Line is just offset by the number of newlines counted.
    const line = lastToken.location.line + whitespaceAfterToken.newlines;

    // When no newlines are encountered, it is simply an offset from the last token `column` by the width of the last token plus number of whitespace skipped
    let column = lastToken.location.column + (start - lastToken.span.start);
    if (whitespaceAfterToken.lastNewlineOffset !== undefined) {
      // When some newlines were encountered, the offset of the last newline from the slice start is stored in `lastNewlineOffset`
      // `column` is then the distance between `start` and the position after (the inner + 1) the last newline
      // Since column is 1-based, the outer + 1 is added (which actually negates the inner one, but is here for clarity)
      column =
        start -
        (lastToken.span.end + whitespaceAfterToken.lastNewlineOffset + 1) +
        1;
    }

    return {
      start,
      location: {
        line,
        column,
      },
    };
  }

  /** Reads the next token following the `afterPosition`. */
  private readNextToken(
    lastToken: LexerToken,
    context?: LexerContext
  ): LexerToken {
    const { start, location } = this.computeNextTokenPosition(lastToken);

    const slice = this.source.body.slice(start);

    // Call one of the sublexers
    let tokenParseResult: ParseResult<LexerTokenData>;
    if (context === undefined) {
      context = { type: LexerContextType.DEFAULT }
    }
    switch (context.type) {
      case LexerContextType.DEFAULT:
        tokenParseResult = this.sublexers[LexerContextType.DEFAULT](slice);
        break;

      case LexerContextType.JESSIE_SCRIPT_EXPRESSION:
        tokenParseResult = this.sublexers[
          LexerContextType.JESSIE_SCRIPT_EXPRESSION
        ](slice, context.terminationTokens);
        break;
    }

    // Didn't parse as any known token
    if (tokenParseResult === undefined) {
      throw new SyntaxError(
        this.source,
        location,
        { start, end: start },
        SyntaxErrorCategory.LEXER,
        'Could not match any token'
      );
    }

    const parsedTokenSpan = {
      start: start + tokenParseResult.relativeSpan.start,
      end: start + tokenParseResult.relativeSpan.end,
    };

    // Parsing error
    if (tokenParseResult.isError) {
      throw new SyntaxError(
        this.source,
        location,
        parsedTokenSpan,
        tokenParseResult.category,
        tokenParseResult.detail,
        tokenParseResult.hint
      );
    }

    // All is well
    return new LexerToken(tokenParseResult.data, parsedTokenSpan, location);
  }
}
