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
  documentedNode,
  expectTerminated,
  mapAssignmentPath,
  WithLocationInfo,
} from '../common';

export const COMLINK_PRIMITIVE_LITERAL: SyntaxRule<
  WithLocationInfo<ComlinkPrimitiveLiteralNode>
> = SyntaxRule.literal()
  .or(SyntaxRule.string())
  .map((match): WithLocationInfo<ComlinkPrimitiveLiteralNode> => {
    const value =
      match.data.kind === LexerTokenKind.LITERAL
        ? match.data.literal
        : match.data.string;

    return {
      kind: 'ComlinkPrimitiveLiteral',
      value,
      location: match.location,
      span: match.span,
    };
  });

const COMLINK_LITERAL_MUT = new SyntaxRuleMutable<
  WithLocationInfo<ComlinkLiteralNode>
>();

export const COMLINK_OBJECT_LITERAL_ASSIGNMENT: SyntaxRule<
  WithLocationInfo<ComlinkAssignmentNode>
> = documentedNode(
  ASSIGNMENT_PATH_KEY.followedBy(
    SyntaxRule.operator('=').forgetFollowedBy(
      expectTerminated(COMLINK_LITERAL_MUT, ',', '\n', '}')
    )
  ).map(([path, value]): WithLocationInfo<ComlinkAssignmentNode> => {
    return {
      kind: 'ComlinkAssignment',
      key: mapAssignmentPath(path),
      value,
      location: path[0].location,
      span: {
        start: path[0].span.start,
        end: value.span.end,
      },
    };
  })
);

export const COMLINK_OBJECT_LITERAL: SyntaxRule<
  WithLocationInfo<ComlinkObjectLiteralNode>
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
    ]): WithLocationInfo<ComlinkObjectLiteralNode> => {
      return {
        kind: 'ComlinkObjectLiteral',
        fields: maybeFields ?? [],
        location: sepStart.location,
        span: {
          start: sepStart.span.start,
          end: sepEnd.span.end,
        },
      };
    }
  );

export const COMLINK_LIST_LITERAL: SyntaxRule<
  WithLocationInfo<ComlinkListLiteralNode>
> = SyntaxRule.separator('[')
  .followedBy(
    SyntaxRule.optional(
      SyntaxRule.repeat(expectTerminated(COMLINK_LITERAL_MUT, ',', '\n', ']'))
    )
  )
  .andFollowedBy(SyntaxRule.separator(']'))
  .map(
    ([
      sepStart,
      maybeItems,
      sepEnd,
    ]): WithLocationInfo<ComlinkListLiteralNode> => {
      return {
        kind: 'ComlinkListLiteral',
        items: maybeItems ?? [],
        location: sepStart.location,
        span: {
          start: sepStart.span.start,
          end: sepEnd.span.end,
        },
      };
    }
  );

export const COMLINK_LITERAL = COMLINK_PRIMITIVE_LITERAL.or(
  COMLINK_OBJECT_LITERAL
).or(COMLINK_LIST_LITERAL);
COMLINK_LITERAL_MUT.rule = COMLINK_LITERAL;
