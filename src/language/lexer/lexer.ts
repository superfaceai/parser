import { SyntaxError, SyntaxErrorCategory } from '../error';
import { Location, Source } from '../source';
import { LexerContext, LexerContextType, Sublexer } from './context';
import { tryParseDefault } from './sublexer/default';
import { tryParseJessieScriptExpression } from './sublexer/jessie';
import { ParseResult } from './sublexer/result';
import { LexerToken, LexerTokenData, LexerTokenKind } from './token';
import * as util from './util';

export type LexerTokenKindFilter = { [K in LexerTokenKind]: boolean };
export const DEFAULT_TOKEN_KIND_FILER: LexerTokenKindFilter = {
  [LexerTokenKind.COMMENT]: true,
  [LexerTokenKind.NEWLINE]: true,
  [LexerTokenKind.IDENTIFIER]: false,
  [LexerTokenKind.LITERAL]: false,
  [LexerTokenKind.OPERATOR]: false,
  [LexerTokenKind.SEPARATOR]: false,
  [LexerTokenKind.STRING]: false,
  [LexerTokenKind.JESSIE_SCRIPT]: false,
  [LexerTokenKind.UNKNOWN]: false
};

export type LexerSavedState = [LexerToken, boolean];
export interface LexerTokenStream
  extends Generator<LexerToken, undefined, LexerContext | undefined> {
  
  tokenKindFilter: LexerTokenKindFilter;
  emitUnknown: boolean;

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

  /** Stores whether the SOF and EOF were yielded. */
  private fileSeparatorYielded = false;

  /** Token kinds to filter from the stream. */
  tokenKindFilter: LexerTokenKindFilter;

  /** Whether to emit the `UNKNOWN` token instead of throwing syntax error. */
  emitUnknown: boolean;

  constructor(
    readonly source: Source,
    tokenKindFilter?: LexerTokenKindFilter,
    emitUnknown?: boolean
  ) {
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

    this.tokenKindFilter = tokenKindFilter ?? DEFAULT_TOKEN_KIND_FILER;
    this.emitUnknown = emitUnknown ?? false;
  }

  /** Advances the lexer returning the current token. */
  advance(context?: LexerContext): LexerToken {
    // We use the `nextToken` field to detect first emission on EOF
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
  save(): LexerSavedState {
    return [this.currentToken, this.fileSeparatorYielded];
  }
  /**
   * Roll back the state of the lexer to the given saved state.
   *
   * The lexer will continue from this state forward.
   */
  rollback(state: LexerSavedState): void {
    this.currentToken = state[0];
    this.fileSeparatorYielded = state[1];
  }

  private computeNextTokenPosition(
    lastToken: LexerToken
  ): {
    start: number;
    location: Location;
  } {
    // Count number of newlines inside the last token to correctly compute the position
    const lastTokenBody = Array.from(
      this.source.body.slice(lastToken.span.start, lastToken.span.end)
    );
    const [newlinesInToken, lastNewlineOffset] = lastTokenBody.reduce(
      (acc: [newlines: number, offset: number | undefined], char, index) => {
        if (char === '\n') {
          acc[0] += 1;
          acc[1] = index;
        }

        return acc;
      },
      [0, undefined]
    );

    // Count number of non-newline whitespace tokens after the last token.
    const whitespaceAfterToken = util.countStarting(
      ch => !util.isNewline(ch) && util.isWhitespace(ch),
      this.source.body.slice(lastToken.span.end)
    );

    // Compute the start of the next token by ignoring whitespace after the last token.
    const start = lastToken.span.end + whitespaceAfterToken;

    // Line is just offset by the number of newlines counted.
    const line = lastToken.location.line + newlinesInToken;

    // When no newlines are encountered, column is simply an offset from the last token `column` by the length of the last token plus number of whitespaces skipped.
    let column = lastToken.location.column + (start - lastToken.span.start);
    if (lastNewlineOffset !== undefined) {
      // When some newlines were encountered, the offset of the last newline from the slice start is stored in `lastNewlineOffset`
      // `column` is then the distance between the position *after* the last newline and `start` plus 1 because it is 1-based
      column = start - (lastToken.span.start + lastNewlineOffset + 1) + 1; // the ones cancel out but they are left here for clarity
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

    const parsedTokenSpan = {
      start: start + (tokenParseResult?.relativeSpan.start ?? 0),
      end: start + (tokenParseResult?.relativeSpan.end ?? 1),
    };

    // Didn't parse as any known token or produced an error
    if (tokenParseResult === undefined || tokenParseResult.isError) {
      const category = tokenParseResult?.category ?? SyntaxErrorCategory.LEXER;
      const detail = tokenParseResult?.detail ?? 'Could not match any token';
      const hint = tokenParseResult?.hint;
      
      const error = new SyntaxError(
        this.source,
        location,
        parsedTokenSpan,
        category,
        detail,
        hint
      );

      if (this.emitUnknown) {
        return new LexerToken(
          {
            kind: LexerTokenKind.UNKNOWN,
            error
          },
          location,
          parsedTokenSpan
        )
      }

      throw error;
    }

    // All is well
    return new LexerToken(tokenParseResult.data, location, parsedTokenSpan);
  }
}
