import { ProfileDocumentNode } from '@superindustries/language';

import { Lexer } from '../lexer/lexer';
import { Source } from '../source';
import { PROFILE_DOCUMENT } from './rules/profile';
import { BufferedIterator } from './util';
import { SyntaxError } from '../error';
import { SyntaxRule } from './rules/rule';

export function parseRule<N>(rule: SyntaxRule<N>, source: Source): N {
  const lexer = new Lexer(source);
  const buf = new BufferedIterator(lexer[Symbol.iterator]());

  const result = rule.tryMatch(buf);

  if (result.kind === 'nomatch') {
    throw SyntaxError.fromSyntaxRuleNoMatch(source, result);
  }

  return result.match;
}

export function parseProfile(source: Source): ProfileDocumentNode {
  return parseRule(PROFILE_DOCUMENT, source);
}
