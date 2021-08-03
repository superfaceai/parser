import * as ts from 'typescript';

import { validateAndTranspile } from '../../../jessie';
import { JessieSublexerTokenData, LexerTokenKind } from '../../token';
import { ParseResult } from '../result';

function processScriptText(
  scriptText: string
): ParseResult<JessieSublexerTokenData> {
  const SCRIPT_WRAP = {
    start: 'let __jessieValue = ',
    end: ';',
    transpiled: {
      start: 'var __jessieValue = ',
      end: ';',
      varName: '__jessieValue',
    },
  };

  // Diagnose the script text, put it in a position where an expression would be required
  const transRes = validateAndTranspile(
    SCRIPT_WRAP.start + scriptText + SCRIPT_WRAP.end
  );
  if (transRes.kind === 'failure') {
    return {
      kind: 'error',
      tokenKind: LexerTokenKind.JESSIE_SCRIPT,
      // map the errors to get the correct spans
      errors: transRes.errors.map(err => {
        return {
          detail: err.detail,
          hint: err.hint,
          category: err.category,
          relativeSpan: {
            start: err.relativeSpan.start - SCRIPT_WRAP.start.length,
            end: err.relativeSpan.end - SCRIPT_WRAP.start.length,
          },
        };
      }),
    };
  }

  // With some syntax the transpiler creates a polyfill for the function
  // For example for the spread operator `...`
  // Here we detect that case and wrap the output in an immediatelly invoked function expression
  let scriptOutput = transRes.output;
  if (!transRes.output.startsWith(SCRIPT_WRAP.transpiled.start)) {
    scriptOutput = `(function() {\n${scriptOutput}\nreturn ${SCRIPT_WRAP.transpiled.varName};\n})()`;
  } else {
    // strip the prefix and postfix added by the processing here (to force expression position)
    scriptOutput = scriptOutput.slice(
      SCRIPT_WRAP.transpiled.start.length,
      scriptOutput.length - SCRIPT_WRAP.transpiled.end.length
    );
  }

  return {
    kind: 'match',
    data: {
      kind: LexerTokenKind.JESSIE_SCRIPT,
      script: scriptOutput,
      sourceScript: scriptText,
      sourceMap: transRes.sourceMap,
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

/** Supported Jessie termination tokens */
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

/** empty statements are not supported in jessie, so ; is a good fallback */
const FALLBACK_TERMINATOR_TOKENS: ReadonlyArray<JessieExpressionTerminationToken> =
  [';'];
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
  terminationTokens?: ReadonlyArray<JessieExpressionTerminationToken>
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
