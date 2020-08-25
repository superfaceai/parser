import { LexerContext, LexerToken, LexerTokenKind, LexerTokenStream } from "../lexer";

/**
 * LexerTokenStream implementation that takes tokens from an array instead of a Lexer.
 * 
 * This is mostly used in tests.
*/
export class ArrayLexerStream implements LexerTokenStream {
  private index: number;

  constructor(private readonly array: ReadonlyArray<LexerToken>) {
    this.index = 0;
  }

  next(_?: LexerContext): IteratorResult<LexerToken, undefined> {
    const token = this.array[this.index];

    if (token === undefined) {
      return {
        done: true,
        value: undefined
      }
    } else {
      this.index += 1;
      return {
        done: false,
        value: token
      }
    }
  }
  peek(_?: LexerContext): IteratorResult<LexerToken, undefined> {
    const token = this.array[this.index + 1];

    if (token === undefined) {
      return {
        done: true,
        value: undefined
      }
    } else {
      return {
        done: false,
        value: token
      }
    }
  }

  save(): LexerToken {
    if (this.index > 0) {
      return this.array[this.index - 1];
    } else {
      return new LexerToken(
        {
          kind: LexerTokenKind.SEPARATOR,
          separator: 'SOF'
        },
        { start: -1, end: -1 },
        { line: 0, column: 0 }
      )
    }
  }
  rollback(token: LexerToken): void {
    this.index = this.array.indexOf(token) + 1;
  }
  
  return(value: undefined): IteratorResult<LexerToken, undefined> {
    return {
      done: true,
      value
    }
  }
  throw(e: any): IteratorResult<LexerToken, undefined> {
    throw e;
  }
  [Symbol.iterator](): Generator<LexerToken, undefined, LexerContext | undefined> {
    return this;
  }
}

/**
 * Attempts to extract documentation title and description from string value.
 *
 * Empty string returns an empty object.
 *
 * String with only one line return that line as the title.
 *
 * String with at least two lines returns the first line as the title and the rest as the description.
 */
export function extractDocumentation(
  input?: string
): { title?: string; description?: string } {
  if (input === undefined) {
    return {};
  }

  const lines = input.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) {
    return {};
  }

  if (lines.length === 1) {
    return {
      title: input,
    };
  }

  const firstNewline = input?.indexOf('\n');

  return {
    title: input?.slice(0, firstNewline),
    description: input.slice(firstNewline + 1).trim(),
  };
}
