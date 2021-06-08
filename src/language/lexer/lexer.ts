import { SyntaxError, SyntaxErrorCategory } from '../error';
import { computeEndLocation, Location, Source, Span } from '../source';
import { LexerContext, LexerContextType, Sublexer } from './context';
import { tryParseDefault } from './sublexer/default';
import { tryParseJessieScriptExpression } from './sublexer/jessie';
import { ParseResult } from './sublexer/result';
import { LexerToken, LexerTokenData, LexerTokenKind } from './token';
import * as util from './util';

export type LexerTokenKindFilter = { [K in LexerTokenKind]: boolean };
export const DEFAULT_TOKEN_KIND_FILTER: LexerTokenKindFilter = {
  [LexerTokenKind.COMMENT]: true,
  [LexerTokenKind.NEWLINE]: true,
  [LexerTokenKind.IDENTIFIER]: false,
  [LexerTokenKind.LITERAL]: false,
  [LexerTokenKind.OPERATOR]: false,
  [LexerTokenKind.SEPARATOR]: false,
  [LexerTokenKind.STRING]: false,
  [LexerTokenKind.JESSIE_SCRIPT]: false,
  [LexerTokenKind.UNKNOWN]: false,
};

export interface LexerTokenStream<SavedState = unknown>
  extends Generator<LexerToken, undefined, LexerContext | undefined> {
  tokenKindFilter: LexerTokenKindFilter;

  peek(
    ...context: [] | [LexerContext | undefined]
  ): IteratorResult<LexerToken, undefined>;

  /** Saves the stream state to be restored later. */
  save(): SavedState;

  /** Roll back the state of the stream to the given saved state. */
  rollback(token: SavedState): void;
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
export class Lexer implements LexerTokenStream<[LexerToken, boolean]> {
  private readonly sublexers: {
    [C in LexerContextType]: Sublexer<C>;
  };

  /** Last emitted token. */
  private currentToken: LexerToken;

  /** Stores whether the SOF and EOF were yielded. */
  private fileSeparatorYielded = false;

  /** Token kinds to filter from the stream. */
  tokenKindFilter: LexerTokenKindFilter;

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
      { line: 1, column: 1 },
      { start: 0, end: 0 }
    );

    this.tokenKindFilter = tokenKindFilter ?? DEFAULT_TOKEN_KIND_FILTER;
  }

  /** Advances the lexer returning the current token. */
  advance(context?: LexerContext): LexerToken {
    if (this.currentToken.isEOF()) {
      this.fileSeparatorYielded = true;

      return this.currentToken;
    }

    if (this.currentToken.isSOF() && !this.fileSeparatorYielded) {
      this.fileSeparatorYielded = true;

      return this.currentToken;
    }

    this.currentToken = this.lookahead(context);
    this.fileSeparatorYielded = false;

    return this.currentToken;
  }

  /** Returns the next token without advancing the lexer. */
  lookahead(context?: LexerContext): LexerToken {
    // EOF forever
    if (this.currentToken.isEOF()) {
      return this.currentToken;
    }

    // read next token
    let nextToken = this.readNextToken(this.currentToken, context);

    // skip tokens if they are caught by the filter
    while (this.tokenKindFilter[nextToken.data.kind]) {
      // Always break on EOF even if separators are filtered to avoid an infinite loop.
      if (nextToken.isEOF()) {
        break;
      }

      nextToken = this.readNextToken(nextToken, context);
    }

    return nextToken;
  }

  next(context?: LexerContext): IteratorResult<LexerToken, undefined> {
    const tok = this.advance(context);

    // Ensure that EOF is yielded once
    if (tok.isEOF() && this.fileSeparatorYielded) {
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
  save(): [LexerToken, boolean] {
    return [this.currentToken, this.fileSeparatorYielded];
  }

  /**
   * Roll back the state of the lexer to the given saved state.
   *
   * The lexer will continue from this state forward.
   */
  rollback(state: [LexerToken, boolean]): void {
    this.currentToken = state[0];
    this.fileSeparatorYielded = state[1];
  }

  private computeNextTokenPosition(
    lastToken: LexerToken
  ): {
    start: number;
    location: Location;
  } {
    // Count number of non-newline whitespace tokens after the last token.
    const whitespaceAfterToken = util.countStarting(
      ch => !util.isNewline(ch) && util.isWhitespace(ch),
      this.source.body.slice(lastToken.span.end)
    );

    // Compute the start of the **next** token by ignoring whitespace after the last token.
    const start = lastToken.span.end + whitespaceAfterToken;

    // Compute the end location of the last token + whitespace which equals the start location of the next token.
    const location = computeEndLocation(
      this.source.body.slice(lastToken.span.start, start),
      lastToken.location
    );

    return {
      start,
      location,
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
      context = { type: LexerContextType.DEFAULT };
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

    // For errors, there are two spans and two locations here:
    // * the location of the token which produced this error during lexing
    // * the location of the error within that token
    //
    // the entire span of the token is unknown, as the error has happened along the way
    // but we know it covers the error span at least

    // Didn't parse as any known token or produced an error
    if (tokenParseResult.kind === 'nomatch') {
      // here we couldn't match anything, so the token span and the error span (and location) is the same
      const tokenSpan = {
        start,
        end: start + 1,
      };

      const error = new SyntaxError(
        this.source,
        location,
        tokenSpan,
        SyntaxErrorCategory.LEXER,
        'Could not match any token'
      );

      return new LexerToken(
        {
          kind: LexerTokenKind.UNKNOWN,
          error,
        },
        location,
        tokenSpan
      );
    }

    // Produced an error
    if (tokenParseResult.kind === 'error') {
      let category: SyntaxErrorCategory;
      let detail: string | undefined;
      let hint: string | undefined;
      let relativeSpan: Span;

      // Single-error results are easy
      if (tokenParseResult.errors.length === 1) {
        const error = tokenParseResult.errors[0];

        category = error.category;
        detail = error.detail;
        hint = error.hint;
        relativeSpan = error.relativeSpan;
      } else {
        // multi-error results combine all errors and hints into one, the span is the one that covers all the errors
        category = SyntaxErrorCategory.LEXER;
        detail = tokenParseResult.errors
          .map(err => err.detail ?? '')
          .join('; ');
        hint = tokenParseResult.errors.map(err => err.hint ?? '').join('; ');
        relativeSpan = tokenParseResult.errors
          .map(err => err.relativeSpan)
          .reduce((acc, curr) => {
            return {
              start: Math.min(acc.start, curr.start),
              end: Math.max(acc.end, curr.end),
            };
          });
      }

      // here the error span and the token span (and location) are different
      const tokenSpan = {
        start: start,
        end: start + relativeSpan.end,
      };

      const errorSpan = {
        start: start + relativeSpan.start,
        end: start + relativeSpan.end,
      };
      const errorLocation = computeEndLocation(
        this.source.body.slice(tokenSpan.start, errorSpan.start),
        location
      );

      const error = new SyntaxError(
        this.source,
        errorLocation,
        errorSpan,
        category,
        detail,
        hint
      );

      return new LexerToken(
        {
          kind: LexerTokenKind.UNKNOWN,
          error,
        },
        location,
        tokenSpan
      );
    }

    const parsedTokenSpan = {
      start: start + tokenParseResult.relativeSpan.start,
      end: start + tokenParseResult.relativeSpan.end,
    };

    // All is well
    return new LexerToken(tokenParseResult.data, location, parsedTokenSpan);
  }
}
