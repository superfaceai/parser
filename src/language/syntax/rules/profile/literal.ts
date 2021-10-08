import {
  AssignmentExampleNode,
  ListLiteralExampleNode,
  LiteralExampleNode,
  ObjectLiteralExampleNode,
} from '@superfaceai/ast';

import { LexerTokenKind } from '../../../lexer/token';
import { SyntaxRule, SyntaxRuleMutable } from '../../rule';
import {
  ASSIGNMENT_PATH_KEY,
  expectTerminated,
  mapAssignmentPath,
  WithLocationInfo,
} from '../common';

export const COMLINK_PRIMITIVE_LITERAL: SyntaxRule<
  WithLocationInfo<LiteralExampleNode>
> = SyntaxRule.literal()
  .or(SyntaxRule.string())
  .map((match): WithLocationInfo<LiteralExampleNode> => {
    const value =
      match.data.kind === LexerTokenKind.LITERAL
        ? match.data.literal
        : match.data.string;

    return {
      kind: 'PrimitiveLiteralExample',
      value,
      location: match.location,
      span: match.span,
    };
  });

const COMLINK_LITERAL_MUT = new SyntaxRuleMutable<
  WithLocationInfo<LiteralExampleNode>
>();

export const COMLINK_OBJECT_LITERAL_ASSIGNMENT: SyntaxRule<
  WithLocationInfo<AssignmentExampleNode>
> = ASSIGNMENT_PATH_KEY.followedBy(
  SyntaxRule.operator('=').forgetFollowedBy(
    expectTerminated(COMLINK_LITERAL_MUT, ',', '\n', '}')
  )
).map(([path, value]): WithLocationInfo<AssignmentExampleNode> => {
  return {
    kind: 'AssignmentExample',
    key: mapAssignmentPath(path),
    value,
    location: path[0].location,
    span: {
      start: path[0].span.start,
      end: value.span.end,
    },
  };
});

export const COMLINK_OBJECT_LITERAL: SyntaxRule<
  WithLocationInfo<ObjectLiteralExampleNode>
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
    ]): WithLocationInfo<ObjectLiteralExampleNode> => {
      return {
        kind: 'ObjectLiteralExample',
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
  WithLocationInfo<ListLiteralExampleNode>
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
    ]): WithLocationInfo<ListLiteralExampleNode> => {
      return {
        kind: 'ListLiteralExample',
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
