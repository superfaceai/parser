import { Source } from "../source";
import { ProfileDocumentNode } from "@superindustries/language";
import { Lexer } from "../lexer/lexer";
import { BufferedIterator } from "./util";

import { PROFILE_DOCUMENT } from './rules/profile';

export function parseProfile(source: Source): ProfileDocumentNode {
	const lexer = new Lexer(source)
	const buf = new BufferedIterator(lexer[Symbol.iterator]())

	const result = PROFILE_DOCUMENT.tryMatch(buf)

	if (result.kind === 'nomatch') {
		throw 'TODO'
	}

	return result.match;
}