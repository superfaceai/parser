import { Location, Span, Source } from './source';

function computeVisualizeBlockSpan(
  body: string,
  innerSpan: Span,
  innerColumn: number
): { start: number; end: number; lineOffset: number } {
  // Find start of the block slice, which is one line before the inner line, or from SOF
  const innerLineStart = innerSpan.start - (innerColumn - 1);

  // Line offset is the offset between the innerLine index and the block start line index
  let lineOffset = 0;
  // This finds the last newline before the innerLine newline or -1
  let start = 0;
  if (innerLineStart !== 0) {
    if (start === -1) {
      start = 0;
    } else {
      start = body.slice(0, innerLineStart - 1).lastIndexOf('\n') + 1;
      lineOffset = -1;
    }
  }

  // Find end of the vis block slice, which is one line after the inner line, or until EOF
  let end = body.length;

  const innerLineEnd = body.indexOf('\n', innerSpan.end);
  if (innerLineEnd !== -1) {
    const nextLineEnd = body.indexOf('\n', innerLineEnd + 1);
    if (nextLineEnd !== -1) {
      end = nextLineEnd;
    }
  }

  return { start, end, lineOffset };
}

function formatLinePrefix(padSize?: number, lineNumber?: number): string {
  const value = lineNumber?.toString() ?? '';

  return `${value.padEnd(padSize ?? 4, ' ')} | `;
}

function generateErrorVisualization(
  lines: string[],
  errorSpan: Span,
  prefixWidth: number,
  firstLineIndex: number,
  startPosition: number
): string {
  let output = '';
  let position = startPosition;
  let currentLine = firstLineIndex;

  for (const line of lines) {
    output += formatLinePrefix(prefixWidth, currentLine);
    output += line + '\n';

    // Check if this line intersects with the error span
    if (
      position <= errorSpan.end &&
      position + line.length >= errorSpan.start
    ) {
      output += formatLinePrefix(prefixWidth);

      // Iterate over the characters of the current line
      // If the character is part of the error span, add ^ underneath
      // If it isn't either add a space or, if the character is tab, add a tab
      for (let i = 0; i < line.length; i += 1) {
        if (i >= errorSpan.start - position && i < errorSpan.end - position) {
          output += '^';
        } else {
          if (line.charAt(i) === '\t') {
            output += '\t';
          } else {
            output += ' ';
          }
        }
      }

      output += '\n';
    }

    position += line.length;

    currentLine += 1;
    // For newline
    position += 1;
  }

  return output;
}

export class SyntaxError {
  /// Input source that is being parsed.
  readonly source: Source;

  /// Location of the error.
  readonly location: Location;
  /// Span of the error.
  readonly span: Span;
  /// Additional message attached to the error.
  readonly detail: string;

  constructor(source: Source, location: Location, span: Span, detail?: string) {
    this.source = source;
    this.location = location;
    this.span = span;
    this.detail = detail ?? 'Invalid or unexpected token';
  }

  format(): string {
    const visBlock = computeVisualizeBlockSpan(
      this.source.body,
      this.span,
      this.location.column
    );

    // Slice of the source that encompasses the token and is
    // delimited by newlines or file boundaries
    const sourceTextSlice = this.source.body.slice(
      visBlock.start,
      visBlock.end
    );
    const sourceTextLines = sourceTextSlice.split('\n');

    // Location within the body plus the offset of the Source metadata.
    const sourceLocation = {
      line: this.location.line + this.source.fileLocationOffset.line,
      column: this.location.column + this.source.fileLocationOffset.column,
    };
    const maxLineNumberLog =
      Math.log10(sourceLocation.line + sourceTextLines.length) + 1;

    // Generate the lines
    const errorLine = `SyntaxError: ${this.detail}`;
    const locationLinePrefix = ' '.repeat(maxLineNumberLog) + '--> ';
    const locationLine = `${locationLinePrefix}${this.source.fileName}:${sourceLocation.line}:${sourceLocation.column}`;

    const outputLines = generateErrorVisualization(
      sourceTextLines,
      this.span,
      maxLineNumberLog,
      sourceLocation.line + visBlock.lineOffset,
      visBlock.start
    );

    return `${errorLine}\n${locationLine}\n${outputLines}\n`;
  }

  get message(): string {
    // TODO
    return this.detail;
  }
}
