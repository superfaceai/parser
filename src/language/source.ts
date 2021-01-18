/**
 * Human-readable location of a token inside source code.
 *
 * Both `line` and `column` are indexed from 1.
 */
export type Location = {
  line: number;
  column: number;
};

/** Span of one node inside source code. */
export type Span = {
  start: number;
  end: number;
};

/** Source text with additionaly metadata. */
export class Source {
  /** Actual text of the source. */
  body: string;
  /** Name of the file to display in errors. */
  fileName: string;
  /** Offset from the start of the file the body covers. */
  fileLocationOffset: Location;

  constructor(body: string, fileName?: string, fileLocationOffset?: Location) {
    this.body = body;

    this.fileName = fileName ?? '[input]';
    this.fileLocationOffset = fileLocationOffset ?? { line: 0, column: 0 };
  }
}

/**
 * Computes the location of the end of the slice given the starting location.
 *
 * The final location is affected by newlines contained in the `slice`.
 */
export function computeEndLocation(
  slice: string,
  startLocation: Location
): Location {
  const charArray = Array.from(slice);
  const [newlines, newlineOffset] = charArray.reduce(
    (acc: [newlines: number, offset: number | undefined], char, index) => {
      if (char === '\n') {
        acc[0] += 1;
        acc[1] = index;
      }

      return acc;
    },
    [0, undefined]
  );

  let column;
  if (newlineOffset === undefined) {
    // If no newlines were found the new column is just the old column plus the slice length
    column = startLocation.column + slice.length;
  } else {
    column = slice.length - newlineOffset;
  }

  return {
    line: startLocation.line + newlines,
    column,
  };
}
