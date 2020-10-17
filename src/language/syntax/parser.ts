import {
  MapDocumentNode,
  ProfileDocumentNode,
} from '@superindustries/language';

import { SyntaxError } from '../error';
import { Lexer } from '../lexer/lexer';
import { Source } from '../source';
import { SyntaxRule } from './rule';
import { mapExtended, mapStrict } from './rules/map';
import { PROFILE_DOCUMENT } from './rules/profile';

/**
 * Attempts to match `rule` onto `source`.
 *
 * If `skipSOF === true`, the first token of the newly created lexer token stream (the SOF token)
 * is skipped.
 */
export function parseRule<N>(
  rule: SyntaxRule<N>,
  source: Source,
  skipSOF?: boolean
): N {
  const lexer = new Lexer(source);
  if (skipSOF === true) {
    lexer.next();
  }

  const result = rule.tryMatch(lexer);

  if (result.kind === 'nomatch') {
    const error = SyntaxError.fromSyntaxRuleNoMatch(source, result);

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(error.format());
    }

    throw error;
  }

  return result.match;
}

export function parseProfile(source: Source): ProfileDocumentNode {
  return parseRule(PROFILE_DOCUMENT, source);
}

/**
 * Attempts to parse the source using rules that strictly adhere to the specification.
 */
export function parseMap(source: Source): MapDocumentNode {
  return parseRule(mapStrict.MAP_DOCUMENT, source);
}

/**
 * Attempts to parse the source using rules that may have parser-specific extensions.
 */
export function parseMapExtended(source: Source): MapDocumentNode {
  return parseRule(mapExtended.MAP_DOCUMENT, source);
}
