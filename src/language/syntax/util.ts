import {
  LexerContext,
  LexerToken,
  LexerTokenKind,
  LexerTokenStream,
} from '../lexer';
import {
  DEFAULT_TOKEN_KIND_FILER,
  LexerSavedState,
  LexerTokenKindFilter,
} from '../lexer/lexer';

/**
 * LexerTokenStream implementation that takes tokens from an array instead of a Lexer.
 *
 * This is mostly used in tests.
 */
export class ArrayLexerStream implements LexerTokenStream {
  private index: number;

  tokenKindFilter: LexerTokenKindFilter;
  emitUnknown: boolean;

  constructor(private readonly array: ReadonlyArray<LexerToken>) {
    this.index = 0;
    this.tokenKindFilter = DEFAULT_TOKEN_KIND_FILER;
    this.emitUnknown = false;
  }

  next(context?: LexerContext): IteratorResult<LexerToken, undefined> {
    if (this.index >= this.array.length) {
      return {
        done: true,
        value: undefined,
      };
    }

    const token = this.array[this.index];
    let result: IteratorResult<LexerToken, undefined> = {
      done: false,
      value: token,
    };

    this.index += 1;
    if (this.tokenKindFilter[token.data.kind]) {
      // Recurse
      result = this.next(context);
    }

    return result;
  }
  peek(context?: LexerContext): IteratorResult<LexerToken, undefined> {
    const originalIndex = this.index;
    const result = this.next(context);
    this.index = originalIndex;

    return result;
  }

  save(): LexerSavedState {
    if (this.index > 0) {
      return [this.array[this.index - 1], false];
    } else {
      return [
        new LexerToken(
          {
            kind: LexerTokenKind.SEPARATOR,
            separator: 'SOF',
          },
          { line: 0, column: 0 },
          { start: -1, end: -1 }
        ),
        false,
      ];
    }
  }
  rollback(state: LexerSavedState): void {
    this.index = this.array.indexOf(state[0]) + 1;
  }

  return(value: undefined): IteratorResult<LexerToken, undefined> {
    return {
      done: true,
      value,
    };
  }
  throw(e: unknown): IteratorResult<LexerToken, undefined> {
    throw e;
  }
  [Symbol.iterator](): Generator<
    LexerToken,
    undefined,
    LexerContext | undefined
  > {
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
