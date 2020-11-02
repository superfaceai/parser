import {
  DocumentedNode,
  MapASTNodeBase,
  ProfileASTNodeBase,
} from '@superfaceai/language';

import { SyntaxRule } from '../rule';
import { extractDocumentation } from '../util';

// HELPER RULES //

type ASTNodeBase = ProfileASTNodeBase | MapASTNodeBase;

// Node that has `span` and `location` non-optional.
export type SrcNode<N extends ASTNodeBase> = N & {
  span: NonNullable<N['span']>;
  location: NonNullable<N['location']>;
};
export type SyntaxRuleSrc<N extends ASTNodeBase> = SyntaxRule<SrcNode<N>>;

export function documentedNode<
  N extends SrcNode<DocumentedNode & ASTNodeBase>,
  R extends SyntaxRule<N>
>(rule: R): SyntaxRule<N> {
  return SyntaxRule.optional(SyntaxRule.string())
    .followedBy(rule)
    .map(
      (matches): N => {
        const [maybeDoc, result] = matches;
        if (maybeDoc !== undefined) {
          const doc = extractDocumentation(maybeDoc.data.string);
          result.title = doc.title;
          result.description = doc.description;
          result.location = maybeDoc.location;
          result.span.start = maybeDoc.span.start;
        }

        return result;
      }
    );
}
