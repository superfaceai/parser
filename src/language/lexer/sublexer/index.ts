import { ProtoError } from '../../error';
import { Span } from '../../source';
import { LexerTokenData, LexerTokenKind } from '../token';

type ParseResultMatch<T extends LexerTokenData> = {
  readonly isError: false;
  readonly data: T;
  readonly relativeSpan: Span;
};
type ParseResultNomatch = undefined;
type ParseResultError = ProtoError & {
  readonly isError: true;
  readonly kind: LexerTokenKind;
};

export type ParseResult<T extends LexerTokenData> =
  | ParseResultMatch<T>
  | ParseResultNomatch
  | ParseResultError;
