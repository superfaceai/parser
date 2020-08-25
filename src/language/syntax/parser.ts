import { ProfileDocumentNode } from '@superindustries/language';

import { SyntaxError } from '../error';
import { Lexer } from '../lexer/lexer';
import { Source } from '../source';
import { PROFILE_DOCUMENT } from './rules/profile';
import { SyntaxRule } from './rules/rule';

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
    throw SyntaxError.fromSyntaxRuleNoMatch(source, result);
  }

  return result.match;
}

export function parseProfile(source: Source): ProfileDocumentNode {
  return parseRule(PROFILE_DOCUMENT, source);
}
