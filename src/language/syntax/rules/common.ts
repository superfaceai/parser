import {
  DocumentedNode,
  MapASTNodeBase,
  ProfileASTNodeBase,
} from '@superfaceai/ast';

import { SyntaxRule } from '../rule';
import { extractDocumentation } from '../util';

// HELPER RULES //

export type ASTNodeBase = ProfileASTNodeBase | MapASTNodeBase;
export type LocationInfo = {
  span: NonNullable<ASTNodeBase['span']>;
  location: NonNullable<ASTNodeBase['location']>;
};

export type WithLocationInfo<N> = N extends ASTNodeBase
  ? { [k in keyof N]: WithLocationInfo<N[k]> } & LocationInfo
  : { [k in keyof N]: WithLocationInfo<N[k]> };

export function documentedNode<
  N extends WithLocationInfo<DocumentedNode & ASTNodeBase>
>(rule: SyntaxRule<N>): SyntaxRule<N> {
  return SyntaxRule.optional(SyntaxRule.string())
    .followedBy(rule)
    .map(([maybeDoc, result]): N => {
      if (maybeDoc !== undefined) {
        const doc = extractDocumentation(maybeDoc.data.string);
        result.title = doc?.title;
        result.description = doc?.description;
        result.location = maybeDoc.location;
        result.span.start = maybeDoc.span.start;
      }

      return result;
    });
}
