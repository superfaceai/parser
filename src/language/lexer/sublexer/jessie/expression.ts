import * as ts from 'typescript';

import { ScriptExpressionCompiler } from '../../../../common/script';
import { ProtoError } from '../../../error';
import { mapScriptDiagnostic, mapValidatorDiagnostic } from '../../../jessie';
import {
  JessieSublexerTokenData,
  LexerTokenKind,
  TerminationTokens,
} from '../../token';
import { ParseResult } from '../result';

function processScriptText(
  scriptText: string
): ParseResult<JessieSublexerTokenData> {
  const compiler = new ScriptExpressionCompiler(scriptText);

  let errors: ProtoError[] = compiler.diagnose().map(mapScriptDiagnostic);
  if (errors.length === 0) {
    errors = compiler.validate().map(mapValidatorDiagnostic);
  }
  if (errors.length > 0) {
    return {
      kind: 'error',
      tokenKind: LexerTokenKind.JESSIE_SCRIPT,
      errors,
    };
  }

  const { output, sourceMap } = compiler.transpile();

  return {
    kind: 'match',
    data: {
      kind: LexerTokenKind.JESSIE_SCRIPT,
      sourceScript: scriptText,
      script: output,
      sourceMap,
    },
    relativeSpan: { start: 0, end: scriptText.length },
  };
}

// Static SCANNER to avoid reinitializing it, same thing is done inside TS codebase.
const SCANNER = ts.createScanner(
  ts.ScriptTarget.Latest,
  false,
  ts.LanguageVariant.Standard
);

const TERMINATION_TOKEN_TO_TS_TOKEN: {
  [T in TerminationTokens]: ts.SyntaxKind;
} = {
  ';': ts.SyntaxKind.SemicolonToken,
  ')': ts.SyntaxKind.CloseParenToken,
  '}': ts.SyntaxKind.CloseBraceToken,
  ']': ts.SyntaxKind.CloseBracketToken,
  ',': ts.SyntaxKind.CommaToken,
  '\n': ts.SyntaxKind.NewLineTrivia,
};

/** empty statements are not supported in jessie, so ; is a good fallback */
const FALLBACK_TERMINATOR_TOKENS: ReadonlyArray<TerminationTokens> = [';'];
/** Tokens that are always terminator token */
const HARD_TERMINATOR_TOKENS: ReadonlyArray<ts.SyntaxKind> = [
  ts.SyntaxKind.EndOfFileToken,
  ts.SyntaxKind.SingleLineCommentTrivia,
];

const NESTED_OPEN_TOKENS: ReadonlyArray<ts.SyntaxKind> = [
  ts.SyntaxKind.OpenBraceToken, // {
  ts.SyntaxKind.OpenBracketToken, // [
  ts.SyntaxKind.OpenParenToken, // (
];
const NESTED_CLOSE_TOKENS: ReadonlyArray<ts.SyntaxKind> = [
  ts.SyntaxKind.CloseBraceToken, // }
  ts.SyntaxKind.CloseBracketToken, // ]
  ts.SyntaxKind.CloseParenToken, // )
];

export function tryParseJessieScriptExpression(
  slice: string,
  terminationTokens?: ReadonlyArray<TerminationTokens>
): ParseResult<JessieSublexerTokenData> {
  // need at least one terminator token, so we always fall back to something
  let termTokensMut = terminationTokens;
  if (termTokensMut === undefined || termTokensMut.length === 0) {
    termTokensMut = FALLBACK_TERMINATOR_TOKENS;
  }
  const termTokens = termTokensMut.map(
    tok => TERMINATION_TOKEN_TO_TS_TOKEN[tok]
  );

  // Set the scanner text thus reusing the old scanner instance
  SCANNER.setText(slice);

  // Counts the number of open (), [] and {} pairs.
  let depthCounter = 0;
  // Keeps track of whether we are inside a (nested) template string.
  // The Typescript scanner produces a `}` token for the closing part of the template expression (the `${expr}`).
  // We need to manually detect this case and ask the scanner to rescan it with this in mind.
  let templateStringDepthCounter = 0;

  // Stores position after last valid token.
  let lastTokenEnd = 0;
  for (;;) {
    let token = SCANNER.scan();

    if (templateStringDepthCounter > 0) {
      // When `}` is found and we are inside a template string, issue a rescan.
      // This will either produce the TemplateMiddle token or a TemplateTail token.
      if (token === ts.SyntaxKind.CloseBraceToken) {
        SCANNER.reScanTemplateToken(false);
        token = SCANNER.getToken();
      }

      // End the template token context if tail is found
      if (token === ts.SyntaxKind.TemplateTail) {
        templateStringDepthCounter -= 1;
      }
    }
    if (token === ts.SyntaxKind.TemplateHead) {
      templateStringDepthCounter += 1;
    }

    // Look ahead for a termination token
    if (
      depthCounter === 0 &&
      templateStringDepthCounter === 0 &&
      (termTokens.includes(token) || HARD_TERMINATOR_TOKENS.includes(token))
    ) {
      break;
    }

    lastTokenEnd = SCANNER.getTextPos();
    // Count bracket depth
    if (NESTED_OPEN_TOKENS.includes(token)) {
      depthCounter += 1;
    } else if (NESTED_CLOSE_TOKENS.includes(token)) {
      depthCounter -= 1;
    }
  }
  const scriptText = slice.slice(0, lastTokenEnd);

  return processScriptText(scriptText);
}
