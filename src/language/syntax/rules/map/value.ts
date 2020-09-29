import {
  ArrayLiteralNode,
  AssignmentNode,
  JessieExpressionNode,
  LiteralNode,
  ObjectLiteralNode,
} from '@superindustries/language';

import { Lexer, LexerTokenKind } from '../../../lexer';
import { JessieExpressionTerminationToken } from '../../../lexer/sublexer/jessie/expression';
import { IdentifierTokenData, StringTokenData } from '../../../lexer/token';
import { Source } from '../../../source';
import {
  LexerTokenMatch,
  SyntaxRule,
  SyntaxRuleMutable,
  SyntaxRuleOr,
} from '../../rule';
import { SrcNode, SyntaxRuleSrc } from '../common';

// JESSIE and VALUE //

export function JESSIE_EXPRESSION_FACTORY(
  ...terminators: ReadonlyArray<JessieExpressionTerminationToken>
): SyntaxRuleSrc<JessieExpressionNode> {
  return SyntaxRule.jessie(terminators).map(
    (match): SrcNode<JessieExpressionNode> => {
      return {
        kind: 'JessieExpression',
        expression: match.data.script,
        source: match.data.sourceScript,
        sourceMap: match.data.sourceMap,
        location: match.location,
        span: match.span,
      };
    }
  );
}

const OPTIMIZE_JESSIE_TO_PRIMITIVE_RULE = SyntaxRule.separator('SOF')
  .followedBy(SyntaxRule.literal().or(SyntaxRule.string()))
  .andFollowedBy(SyntaxRule.separator('EOF'));

const STRUCTURED_LITERAL_MUT = new SyntaxRuleMutable<
  SrcNode<ArrayLiteralNode | ObjectLiteralNode>
>();

/**
 * Factory for matching and optimizing value expressions.
 */
export function VALUE_EXPRESSION_FACTORY(
  ...terminators: ReadonlyArray<JessieExpressionTerminationToken>
): SyntaxRuleSrc<LiteralNode> {
  const terminatorLookahead: SyntaxRule<unknown>[] = terminators.map(arnold => {
    switch (arnold) {
      case ')':
        return SyntaxRule.separator(')');
      case ']':
        return SyntaxRule.separator(']');
      case '}':
        return SyntaxRule.separator('}');
      case ',':
        return SyntaxRule.operator(',');
      case ';':
        return SyntaxRule.operator(';');
      case '\n':
        return SyntaxRule.newline();
    }
  });
  const structuredLiteral = STRUCTURED_LITERAL_MUT.followedBy(
    SyntaxRule.lookahead(SyntaxRuleOr.chainOr(...terminatorLookahead))
  ).map(([lit, _lookahead]) => lit);

  return structuredLiteral.peekUnknown().or(
    JESSIE_EXPRESSION_FACTORY(...terminators).map(jessie => {
      if (jessie.source === undefined) {
        throw 'Unexpected `JessieExpressionNode.source === undefined`. This is an error in the lexer.';
      }

      const lexer = new Lexer(new Source(jessie.source), undefined, true);
      const optAttempt = OPTIMIZE_JESSIE_TO_PRIMITIVE_RULE.tryMatch(lexer);
      if (optAttempt.kind === 'match') {
        const primitive = optAttempt.match[1].data;
        const value =
          primitive.kind === LexerTokenKind.STRING
            ? primitive.string
            : primitive.literal;

        return {
          kind: 'PrimitiveLiteral',
          value,
          location: jessie.location,
          span: jessie.span,
        };
      }

      return jessie;
    })
  );
}

// ASSIGNMENT //

/**
 * Maps token match array into a string array of the assignment keys.
 */
function mapAssignmentPath(
  path: (
    | LexerTokenMatch<IdentifierTokenData>
    | LexerTokenMatch<StringTokenData>
  )[]
): string[] {
  if (path.length === 0) {
    throw 'Expected at least one element in the assignment path. This in an error in the rule definition.';
  }

  return path.map(p => {
    if (p.data.kind === LexerTokenKind.STRING) {
      return p.data.string;
    } else {
      return p.data.identifier;
    }
  });
}

const ASSIGNMENT_KEY = SyntaxRule.identifier().or(SyntaxRule.string());
export const ASSIGNMENT_PATH_KET = ASSIGNMENT_KEY.followedBy(
  SyntaxRule.optional(
    SyntaxRule.repeat(SyntaxRule.operator('.').followedBy(ASSIGNMENT_KEY))
  )
).map((matches): (
  | LexerTokenMatch<IdentifierTokenData>
  | LexerTokenMatch<StringTokenData>
)[] => {
  const [first, maybeRest] = matches;

  const result = [first];
  if (maybeRest !== undefined) {
    maybeRest.forEach(([_op, key]) => result.push(key));
  }

  return result;
});

/** Assignment with terminating characters: ',' and ')' */
export const ARGUMENT_LIST_ASSIGNMENT: SyntaxRuleSrc<AssignmentNode> = ASSIGNMENT_PATH_KET.followedBy(
  SyntaxRule.operator('=')
)
  .andFollowedBy(VALUE_EXPRESSION_FACTORY(',', ')'))
  .andFollowedBy(SyntaxRule.optional(SyntaxRule.operator(',')))
  .map(
    (matches): SrcNode<AssignmentNode> => {
      const [path /* op */, , value /* maybeComma */] = matches;

      return {
        kind: 'Assignment',
        key: mapAssignmentPath(path),
        value,
        location: path[0].location,
        span: {
          start: path[0].span.start,
          end: value.span.end,
        },
      };
    }
  );

/** Assignment with terminating characters: '\n', ';' and '}' */
export const SET_BLOCK_ASSIGNMENT: SyntaxRuleSrc<AssignmentNode> = ASSIGNMENT_PATH_KET.followedBy(
  SyntaxRule.operator('=')
)
  .andFollowedBy(VALUE_EXPRESSION_FACTORY('\n', ';', '}'))
  .andFollowedBy(SyntaxRule.optional(SyntaxRule.operator(';')))
  .map(
    (matches): SrcNode<AssignmentNode> => {
      const [path /* op */, , value /* maybeSemicolon */] = matches;

      return {
        kind: 'Assignment',
        key: mapAssignmentPath(path),
        value,
        location: path[0].location,
        span: {
          start: path[0].span.start,
          end: value.span.end,
        },
      };
    }
  );

/** Assignment with terminating characters: '\n', ',' and '}' */
export const OBJECT_LITERAL_ASSIGNMENT = ASSIGNMENT_PATH_KET.followedBy(
  SyntaxRule.operator('=')
)
  .andFollowedBy(VALUE_EXPRESSION_FACTORY('\n', ',', '}'))
  .andFollowedBy(SyntaxRule.optional(SyntaxRule.operator(',')))
  .map(
    (matches): SrcNode<AssignmentNode> => {
      const [path /* op */, , value /* maybeComma */] = matches;

      return {
        kind: 'Assignment',
        key: mapAssignmentPath(path),
        value,
        location: path[0].location,
        span: {
          start: path[0].span.start,
          end: value.span.end,
        },
      };
    }
  );

// ATOMS

// export const PRIMITIVE_LITERAL: SyntaxRuleSrc<PrimitiveLiteralNode> = SyntaxRule.literal().or(SyntaxRule.string()).map(
//   (match): SrcNode<PrimitiveLiteralNode> => {
//     const value = match.data.kind === LexerTokenKind.LITERAL ? match.data.literal : match.data.string;

//     return {
//       kind: 'PrimitiveLiteral',
//       value,
//       location: match.location,
//       span: match.span
//     }
//   }
// );

export const ARRAY_LITERAL_ELEMENT = VALUE_EXPRESSION_FACTORY(',', ']');
export const ARRAY_LITERAL: SyntaxRuleSrc<ArrayLiteralNode> = SyntaxRule.separator(
  '['
)
  .followedBy(
    SyntaxRule.optional(
      ARRAY_LITERAL_ELEMENT.followedBy(
        SyntaxRule.optional(
          SyntaxRule.repeat(
            SyntaxRule.operator(',').followedBy(ARRAY_LITERAL_ELEMENT)
          )
        )
      )
    )
  )
  .andFollowedBy(SyntaxRule.optional(SyntaxRule.operator(',')))
  .andFollowedBy(SyntaxRule.separator(']'))
  .map(
    (matches): SrcNode<ArrayLiteralNode> => {
      const [startSep, maybeLiterals /* maybeLastComma */, , endSep] = matches;

      const elements: LiteralNode[] = [];
      if (maybeLiterals !== undefined) {
        const [first, rest] = maybeLiterals;
        elements.push(first);

        if (rest !== undefined) {
          rest.forEach(([_op, element]) => elements.push(element));
        }
      }

      return {
        kind: 'ArrayLiteral',
        elements: elements ?? [],
        location: startSep.location,
        span: {
          start: startSep.span.start,
          end: endSep.span.end,
        },
      };
    }
  );

export const OBJECT_LITERAL: SyntaxRuleSrc<ObjectLiteralNode> = SyntaxRule.separator(
  '{'
)
  .followedBy(SyntaxRule.optional(SyntaxRule.repeat(OBJECT_LITERAL_ASSIGNMENT)))
  .andFollowedBy(SyntaxRule.separator('}'))
  .map(
    (matches): SrcNode<ObjectLiteralNode> => {
      const [sepStart, maybeFields, sepEnd] = matches;

      return {
        kind: 'ObjectLiteral',
        fields: maybeFields ?? [],
        location: sepStart.location,
        span: {
          start: sepStart.span.start,
          end: sepEnd.span.end,
        },
      };
    }
  );

export const STRUCTURED_LITERAL = ARRAY_LITERAL.or(OBJECT_LITERAL);
STRUCTURED_LITERAL_MUT.rule = STRUCTURED_LITERAL;
