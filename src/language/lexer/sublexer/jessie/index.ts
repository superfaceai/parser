import { ParseResult, ParseError } from "../../sublexer";
import { JessieSublexerTokenData, LexerTokenKind } from "../../token";

import * as ts from 'typescript';

// Static SCANNER to avoid reinitializing it, same thing is done inside TS library
const SCANNER = ts.createScanner(
	ts.ScriptTarget.Latest,
	true,
	ts.LanguageVariant.Standard
)

function diagnoseJs(script: string): ts.Diagnostic[] {
	// Diagnose the code using The Hacks™ because TS API is weird
	const diagnostics: ts.Diagnostic[] = []
	ts.transpile(script, {
		allowJs: true,
		declaration: false,
		sourceMap: false,
		target: ts.ScriptTarget.Latest,
		noEmit: true
	}, undefined, diagnostics)

	return diagnostics;
}

export function tryParseJessieScriptExpression(slice: string): ParseResult<JessieSublexerTokenData> {
	// Set the scanner text thus reusing the old scanner instance
	SCANNER.setText(slice)

	// Counts the number of open (, [ and { pairs
	let depthCounter = 0
	// Stores position after last valid token
	let lastTokenEnd = 0
	while (true) {
		// Termination checks
		const token = SCANNER.scan()

		// Look ahead for a semicolon, } or (
		if (
			depthCounter === 0
			&&
			(
				token === ts.SyntaxKind.SemicolonToken
				|| token === ts.SyntaxKind.CloseBraceToken
				|| token === ts.SyntaxKind.CloseParenToken
			)
		) {
			break;
		}

		// Unexpected EOF
		if (token === ts.SyntaxKind.EndOfFileToken) {
			return new ParseError(
				LexerTokenKind.JESSIE_SCRIPT,
				{ start: 0, end: lastTokenEnd },
				'Unexpected EOF'
			);
		}

		lastTokenEnd = SCANNER.getTextPos()
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
	const scriptText = slice.slice(0, lastTokenEnd)
	
	// Diagnose the script text, but put it in a position where an expression would be required
	const fakeScriptStart = 'const x = ';
	const fakeScriptEnd = ';';
	const diagnostics = diagnoseJs(fakeScriptStart + scriptText + fakeScriptEnd)
	if (diagnostics.length > 0) {
		const firstDiag = diagnostics[0]

		const errorStart = (firstDiag.start ?? fakeScriptStart.length) - fakeScriptStart.length
		let detail = firstDiag.messageText
		if (typeof detail === 'object') {
			detail = detail.messageText
		}

		return new ParseError(
			LexerTokenKind.JESSIE_SCRIPT,
			{ start: errorStart, end: errorStart + (firstDiag.length ?? 1) },
			detail
		)
	}

	return [
		{
			kind: LexerTokenKind.JESSIE_SCRIPT,
			script: scriptText
		},
		scriptText.length
	]
}