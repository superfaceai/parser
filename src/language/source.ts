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
