import * as ts from 'typescript';

import { SyntaxErrorCategory } from '../../../error';
import { validateAndTranspile } from '../../../jessie';
import { JessieSublexerTokenData, LexerTokenKind } from '../../token';
import { ParseResult } from '../result';

// Static SCANNER to avoid reinitializing it, same thing is done inside TS codebase.
const SCANNER = ts.createScanner(
  ts.ScriptTarget.Latest,
  false,
  ts.LanguageVariant.Standard
);

export type JessieExpressionTerminationToken =
  | ';'
  | ')'
  | '}'
  | ']'
  | ','
  | '\n';
const TERMINATION_TOKEN_TO_TS_TOKEN: {
  [T in JessieExpressionTerminationToken]: ts.SyntaxKind;
} = {
  ';': ts.SyntaxKind.SemicolonToken,
  ')': ts.SyntaxKind.CloseParenToken,
  '}': ts.SyntaxKind.CloseBraceToken,
  ']': ts.SyntaxKind.CloseBracketToken,
  ',': ts.SyntaxKind.CommaToken,
  '\n': ts.SyntaxKind.NewLineTrivia,
};
const FALLBACK_TERMINATOR_TOKENS: ReadonlyArray<JessieExpressionTerminationToken> = [
  ';',
];

export function tryParseJessieScriptExpression(
  slice: string,
  terminationTokens?: ReadonlyArray<JessieExpressionTerminationToken>
): ParseResult<JessieSublexerTokenData> {
  const termTokens = (terminationTokens === undefined ||
  terminationTokens.length === 0
    ? FALLBACK_TERMINATOR_TOKENS
    : terminationTokens
  ).map(tok => TERMINATION_TOKEN_TO_TS_TOKEN[tok]);
  // slang comments start with #
  termTokens.push(ts.SyntaxKind.PrivateIdentifier);

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
    // Termination checks
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
    // always break at highest level if EOF or single line comment is found
    if (
      depthCounter === 0 &&
      templateStringDepthCounter === 0 &&
      (termTokens.includes(token) ||
        token === ts.SyntaxKind.EndOfFileToken ||
        token === ts.SyntaxKind.SingleLineCommentTrivia)
    ) {
      break;
    }

    // Unexpected EOF
    if (token === ts.SyntaxKind.EndOfFileToken) {
      return {
        isError: true,
        kind: LexerTokenKind.JESSIE_SCRIPT,
        relativeSpan: { start: 0, end: lastTokenEnd },
        detail: 'Unexpected EOF',
        category: SyntaxErrorCategory.JESSIE_SYNTAX,
      };
    }

    lastTokenEnd = SCANNER.getTextPos();
    // Count bracket depth
    switch (token) {
      case ts.SyntaxKind.OpenBraceToken: // {
      case ts.SyntaxKind.OpenBracketToken: // [
      case ts.SyntaxKind.OpenParenToken: // (
        depthCounter += 1;
        break;

      case ts.SyntaxKind.CloseBraceToken: // }
      case ts.SyntaxKind.CloseBracketToken: // ]
      case ts.SyntaxKind.CloseParenToken: // )
        depthCounter -= 1;
        break;

      // Ignore others
    }
  }
  const scriptText = slice.slice(0, lastTokenEnd);

  // Diagnose the script text, but put it in a position where an expression would be required
  const SCRIPT_WRAP = {
    start: 'let x = ',
    end: ';',
    transpiled: {
      start: 'var x = ',
      end: ';',
    },
  };

  const transRes = validateAndTranspile(
    SCRIPT_WRAP.start + scriptText + SCRIPT_WRAP.end
  );
  if (!('category' in transRes)) {
    return {
      isError: false,
      data: {
        kind: LexerTokenKind.JESSIE_SCRIPT,
        script: transRes.output.slice(
          SCRIPT_WRAP.transpiled.start.length,
          transRes.output.length - SCRIPT_WRAP.transpiled.end.length
        ),
        sourceScript: scriptText,
        sourceMap: transRes.sourceMap,
      },
      relativeSpan: { start: 0, end: scriptText.length },
    };
  } else {
    return {
      isError: true,
      kind: LexerTokenKind.JESSIE_SCRIPT,
      detail: transRes.detail,
      hint: transRes.hint,
      category: transRes.category,
      relativeSpan: {
        start: transRes.relativeSpan.start - SCRIPT_WRAP.start.length,
        end: transRes.relativeSpan.end - SCRIPT_WRAP.start.length,
      },
    };
  }
}
