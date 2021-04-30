import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';

import { SyntaxError } from '../error';
import { Lexer } from '../lexer/lexer';
import { Source } from '../source';
import { RuleResult, SyntaxRule } from './rule';
import * as map from './rules/map';
import { profile } from './rules/profile';

function parseRuleResult<N>(
  rule: SyntaxRule<N>,
  source: Source,
  skipSOF?: boolean
): RuleResult<N> {
  const lexer = new Lexer(source);
  if (skipSOF === true) {
    lexer.next();
  }

  return rule.tryMatch(lexer);
}

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
  const result = parseRuleResult(rule, source, skipSOF);

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
  return parseRule(profile.PROFILE_DOCUMENT, source);
}

/**
 * Attempts to parse the source using rules that strictly adhere to the specification.
 */
export function parseMap(source: Source): MapDocumentNode {
  return parseRule(map.MAP_DOCUMENT, source);
}
