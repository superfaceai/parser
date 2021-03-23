import {
  DocumentedNode,
  MapASTNodeBase,
  ProfileASTNodeBase,
} from '@superfaceai/ast';

import { SyntaxRule } from '../rule';
import { extractDocumentation } from '../util';

// HELPER RULES //

export type ASTNodeBase = ProfileASTNodeBase | MapASTNodeBase;
export type SrcNodeLocationInfo = {
  span: NonNullable<ASTNodeBase['span']>;
  location: NonNullable<ASTNodeBase['location']>;
};

// Node that has `span` and `location` non-optional.
export type SrcNode<N> = N & {
  span: NonNullable<ASTNodeBase['span']>;
  location: NonNullable<ASTNodeBase['location']>;
};
/** Syntax rule returning `N` with `SrcNode` properties `location` and `span`. */
export type SyntaxRuleSrc<N> = SyntaxRule<SrcNode<N>>;

export function documentedNode<N extends SrcNode<DocumentedNode & ASTNodeBase>>(
  rule: SyntaxRule<N>
): SyntaxRule<N> {
  return SyntaxRule.optional(SyntaxRule.string())
    .followedBy(rule)
    .map(
      ([maybeDoc, result]): N => {
        if (maybeDoc !== undefined) {
          const doc = extractDocumentation(maybeDoc.data.string);
          result.title = doc?.title;
          result.description = doc?.description;
          result.location = maybeDoc.location;
          result.span.start = maybeDoc.span.start;
        }

        return result;
      }
    );
}
