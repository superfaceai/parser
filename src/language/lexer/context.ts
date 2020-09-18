import { JessieExpressionTerminationToken } from './sublexer/jessie/expression';
import { ParseResult } from './sublexer/result';
import { DefaultSublexerTokenData, JessieSublexerTokenData } from './token';

export const enum LexerContextType {
  /**
   * Default lexer context for parsing the profile and map languages.
   */
  DEFAULT,
  /**
   * Lexer context for parsing Jessie script expressions.
   */
  JESSIE_SCRIPT_EXPRESSION,
}
export type Sublexer<C extends LexerContextType> = (
  slice: string,
  ...context: SublexerParamsType<C>
) => ParseResult<SublexerReturnType<C>>;

export type SublexerParamsType<
  C extends LexerContextType
> = C extends LexerContextType.DEFAULT
  ? []
  : C extends LexerContextType.JESSIE_SCRIPT_EXPRESSION
  ? [LexerJessieContext['terminationTokens']]
  : never;
export type SublexerReturnType<
  C extends LexerContextType
> = C extends LexerContextType.DEFAULT
  ? DefaultSublexerTokenData
  : C extends LexerContextType.JESSIE_SCRIPT_EXPRESSION
  ? JessieSublexerTokenData
  : never;

type LexerDefaultContext = { type: LexerContextType.DEFAULT };
type LexerJessieContext = {
  type: LexerContextType.JESSIE_SCRIPT_EXPRESSION;
  terminationTokens?: ReadonlyArray<JessieExpressionTerminationToken>;
};
export type LexerContext = (LexerDefaultContext | LexerJessieContext);
