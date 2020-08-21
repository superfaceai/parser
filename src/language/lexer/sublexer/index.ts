import { LexerTokenKind, LexerTokenData } from "../token";
import { Span } from "../../source";

/** Error returned internally by the lexer `tryParse*` methods. */
export class ParseError {
  constructor(
    /** Kind of the errored token. */
    readonly kind: LexerTokenKind,
    /** Span of the errored token. */
    readonly span: Span,
    /** Optional detail message. */
    readonly detail?: string
  ) {}
}
  
export type ParseResult<T extends LexerTokenData> =
  | ([T, number] | undefined)
  | ParseError;
  