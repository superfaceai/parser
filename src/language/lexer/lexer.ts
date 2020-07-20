import { SyntaxError } from '../error';
import { Source } from '../source';
import * as rules from './rules';
import { LexerToken, LexerTokenKind } from './token';
import * as util from './util';

/**
 * Lexer tokenizes input string into tokens.
 *
 * The lexer generates a stream of tokens, always starting with SEPARATOR SOF and always ending with SEPARATOR EOF.
 * The stream can be consumed by calling `advance`. After each advance, `lookahead` will provide access to the next
 * token without consuming it and will update the current tokens `next` field as well.
 * After EOF is emitted, all further calls to `advance` and `lookahead` will return the same EOF.
 */
export class Lexer {
  private currentToken: LexerToken;
  private nextToken: LexerToken | null;

  /** Indexed from 1 */
  private currentLine: number;
  // Character offset in the source.body at which current line begins.
  private currentLineStart: number;

  constructor(readonly source: Source) {
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
  }

  /** Advances the lexer returning the current token. */
  advance(): LexerToken {
    this.currentToken = this.lookahead();
    this.nextToken = null;

    return this.currentToken;
  }

  /** Returns the next token without advancing the lexer. */
  lookahead(): LexerToken {
    // EOF forever
    if (this.currentToken.isEOF()) {
      return this.currentToken;
    }

    // read next token if not read already
    if (this.nextToken === null) {
      this.nextToken = this.readNextToken();
    }

    return this.nextToken;
  }

  /**
   * Returns a generator adaptor that produces generator-compatible values.
   *
   * The generator yields the result of `advance()` until `EOF` token is found, at which point it returns the `EOF` token.
   */
  [Symbol.iterator](): Generator<LexerToken, LexerToken> {
    // This rule is intended to catch assigning this to a variable when an arrow function would suffice
    // Generators cannot be defined using an arrow function and thus don't preserve `this`
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const lexer = this;

    function* generatorClosure(): Generator<LexerToken, LexerToken> {
      let currentToken = lexer.advance();

      while (!currentToken.isEOF()) {
        yield currentToken;
        currentToken = lexer.advance();
      }

      return currentToken;
    }

    return generatorClosure();
  }

  /** Reads the next token following the `currentToken`. */
  private readNextToken(): LexerToken {
    // Compute the start of the next token by ignoring whitespace after last token.
    const start =
      this.currentToken.span.end +
      this.countStartingWithNewlines(
        util.isWhitespace,
        this.currentToken.span.end
      );
    const location = {
      line: this.currentLine,
      column: start - this.currentLineStart + 1,
    };

    const slice = this.source.body.slice(start);

    const tokenParseResult =
      rules.tryParseSeparator(slice) ??
      rules.tryParseOperator(slice) ??
      rules.tryParseLiteral(slice) ??
      rules.tryParseStringLiteral(slice) ??
      rules.tryParseDecorator(slice) ??
      rules.tryParseIdentifier(slice) ??
      rules.tryParseComment(slice);

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
    if (tokenParseResult instanceof rules.ParseError) {
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
