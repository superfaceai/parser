import {
  ComlinkAssignmentNode,
  ComlinkListLiteralNode,
  ComlinkLiteralNode,
  ComlinkObjectLiteralNode,
  ComlinkPrimitiveLiteralNode,
} from '@superfaceai/ast';

import { LexerTokenKind } from '../../../lexer/token';
import { SyntaxRule, SyntaxRuleMutable } from '../../rule';
import {
  ASSIGNMENT_PATH_KEY,
  computeLocationSpan,
  documentedNode,
  expectTerminated,
  mapAssignmentPath,
  WithLocation,
} from '../common';

export const COMLINK_PRIMITIVE_LITERAL: SyntaxRule<
  WithLocation<ComlinkPrimitiveLiteralNode>
> = SyntaxRule.literal()
  .or(SyntaxRule.string())
  .map((match): WithLocation<ComlinkPrimitiveLiteralNode> => {
    const value =
      match.data.kind === LexerTokenKind.LITERAL
        ? match.data.literal
        : match.data.string;

    return {
      kind: 'ComlinkPrimitiveLiteral',
      value,
      location: match.location,
    };
  });

const COMLINK_LITERAL_MUT = new SyntaxRuleMutable<
  WithLocation<ComlinkLiteralNode>
>();

export const COMLINK_OBJECT_LITERAL_ASSIGNMENT: SyntaxRule<
  WithLocation<ComlinkAssignmentNode>
> = documentedNode(
  ASSIGNMENT_PATH_KEY.followedBy(
    SyntaxRule.operator('=').forgetFollowedBy(
      expectTerminated(COMLINK_LITERAL_MUT, ',', '\n', '}')
    )
  ).map(([path, value]): WithLocation<ComlinkAssignmentNode> => {
    return {
      kind: 'ComlinkAssignment',
      key: mapAssignmentPath(path),
      value,
      location: computeLocationSpan(...path, value),
    };
  })
);

export const COMLINK_OBJECT_LITERAL: SyntaxRule<
  WithLocation<ComlinkObjectLiteralNode>
> = SyntaxRule.separator('{')
  .followedBy(
    SyntaxRule.optional(SyntaxRule.repeat(COMLINK_OBJECT_LITERAL_ASSIGNMENT))
  )
  .andFollowedBy(SyntaxRule.separator('}'))
  .map(
    ([
      sepStart,
      maybeFields,
      sepEnd,
    ]): WithLocation<ComlinkObjectLiteralNode> => {
      return {
        kind: 'ComlinkObjectLiteral',
        fields: maybeFields ?? [],
        location: computeLocationSpan(sepStart, sepEnd),
      };
    }
  );

export const COMLINK_LIST_LITERAL: SyntaxRule<
  WithLocation<ComlinkListLiteralNode>
> = SyntaxRule.separator('[')
  .followedBy(
    SyntaxRule.optional(
      SyntaxRule.repeat(expectTerminated(COMLINK_LITERAL_MUT, ',', '\n', ']'))
    )
  )
  .andFollowedBy(SyntaxRule.separator(']'))
  .map(
    ([sepStart, maybeItems, sepEnd]): WithLocation<ComlinkListLiteralNode> => {
      return {
        kind: 'ComlinkListLiteral',
        items: maybeItems ?? [],
        location: computeLocationSpan(sepStart, sepEnd),
      };
    }
  );

export const COMLINK_LITERAL = COMLINK_PRIMITIVE_LITERAL.or(
  COMLINK_OBJECT_LITERAL
).or(COMLINK_LIST_LITERAL);
COMLINK_LITERAL_MUT.rule = COMLINK_LITERAL;
