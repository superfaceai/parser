import {
  AssignmentNode,
  CallStatementNode,
  InlineCallNode,
  JessieExpressionNode,
  LiteralNode,
  ObjectLiteralNode,
  PrimitiveLiteralNode,
  StatementConditionNode,
  SubstatementType,
} from '@superindustries/language';

import { LexerTokenKind } from '../../../lexer';
import { JessieExpressionTerminationToken } from '../../../lexer/sublexer/jessie/expression';
import { IdentifierTokenData, StringTokenData } from '../../../lexer/token';
import {
  LexerTokenMatch,
  SyntaxRule,
  SyntaxRuleMutable,
  SyntaxRuleOr,
} from '../../rule';
import { SrcNode, SyntaxRuleSrc } from '../common';

// JESSIE and VALUE //

function terminatorLookahead<R>(
  rule: SyntaxRule<R>,
  ...terminators: ReadonlyArray<JessieExpressionTerminationToken>
) {
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

  return rule
    .followedBy(
      SyntaxRule.lookahead(SyntaxRuleOr.chainOr(...terminatorLookahead))
    )
    .map(([lit, _lookahead]) => lit)
    .peekUnknown();
}

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

export const PRIMITIVE_LITERAL: SyntaxRuleSrc<PrimitiveLiteralNode> = SyntaxRule.literal()
  .or(SyntaxRule.string())
  .map(
    (match): SrcNode<PrimitiveLiteralNode> => {
      const value =
        match.data.kind === LexerTokenKind.LITERAL
          ? match.data.literal
          : match.data.string;

      return {
        kind: 'PrimitiveLiteral',
        value,
        location: match.location,
        span: match.span,
      };
    }
  );

const OBJECT_LITERAL_MUT = new SyntaxRuleMutable<SrcNode<ObjectLiteralNode>>();
const INLINE_CALL_MUT = new SyntaxRuleMutable<SrcNode<InlineCallNode>>();

/**
 * Factory for matching rhs value expressions (after '=').
 */
export function RHS_VALUE_FACTORY(
  ...terminators: ReadonlyArray<JessieExpressionTerminationToken>
): SyntaxRuleSrc<PrimitiveLiteralNode | InlineCallNode | JessieExpressionNode> {
  return terminatorLookahead(PRIMITIVE_LITERAL, ...terminators)
    .or(INLINE_CALL_MUT.peekUnknown())
    .or(JESSIE_EXPRESSION_FACTORY(...terminators));
}

/**
 * Factory for matching rhs literals (slang map or `= <value>`).
 */
export function RHS_LITERAL_FACTORY(
  ...terminators: ReadonlyArray<JessieExpressionTerminationToken>
): SyntaxRuleSrc<LiteralNode> {
  return OBJECT_LITERAL_MUT.or(
    SyntaxRule.operator('=')
      .followedBy(RHS_VALUE_FACTORY(...terminators))
      .map(([_op, value]) => value)
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
  RHS_LITERAL_FACTORY(',', ')')
)
  .andFollowedBy(SyntaxRule.optional(SyntaxRule.operator(',')))
  .map(
    (matches): SrcNode<AssignmentNode> => {
      const [path, value /* maybeComma */] = matches;

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
  RHS_LITERAL_FACTORY('\n', ';', '}')
)
  .andFollowedBy(SyntaxRule.optional(SyntaxRule.operator(';')))
  .map(
    (matches): SrcNode<AssignmentNode> => {
      const [path, value /* maybeSemicolon */] = matches;

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
  RHS_LITERAL_FACTORY('\n', ',', '}')
)
  .andFollowedBy(SyntaxRule.optional(SyntaxRule.operator(',')))
  .map(
    (matches): SrcNode<AssignmentNode> => {
      const [path, value /* maybeComma */] = matches;

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

/**
 * if (<jessie>)
 */
export const STATEMENT_CONDITION: SyntaxRuleSrc<StatementConditionNode> = SyntaxRule.identifier(
  'if'
)
  .followedBy(SyntaxRule.separator('('))
  .andFollowedBy(JESSIE_EXPRESSION_FACTORY(')'))
  .andFollowedBy(SyntaxRule.separator(')'))
  .map(
    (maches): SrcNode<StatementConditionNode> => {
      const [key /* sepStart */, , expression, sepEnd] = maches;

      return {
        kind: 'StatementCondition',
        expression,
        location: key.location,
        span: {
          start: key.span.start,
          end: sepEnd.span.end,
        },
      };
    }
  )
  .peekUnknown();

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
OBJECT_LITERAL_MUT.rule = OBJECT_LITERAL;

const CALL_STATEMENT_HEAD = SyntaxRule.identifier('call')
  .followedBy(SyntaxRule.identifier())
  .andFollowedBy(SyntaxRule.separator('('))
  .andFollowedBy(
    SyntaxRule.optional(SyntaxRule.repeat(ARGUMENT_LIST_ASSIGNMENT))
  )
  .andFollowedBy(SyntaxRule.separator(')'));

export const INLINE_CALL: SyntaxRuleSrc<InlineCallNode> = CALL_STATEMENT_HEAD.map(
  (matches): SrcNode<InlineCallNode> => {
    const [key, name /* sepArgStart */, , maybeArguments, sepArgEnd] = matches;

    return {
      kind: 'InlineCall',
      operationName: name.data.identifier,
      arguments: maybeArguments ?? [],
      location: key.location,
      span: {
        start: key.span.start,
        end: sepArgEnd.span.end,
      },
    };
  }
);
INLINE_CALL_MUT.rule = INLINE_CALL;

/**
 * call name(<...arguments>) <?condition> { <...statements> }
 */
export function CALL_STATEMENT_FACTORY<S extends SubstatementType>(
  substatementRule: SyntaxRuleSrc<S>
): SyntaxRuleSrc<CallStatementNode<S>> {
  return CALL_STATEMENT_HEAD.andFollowedBy(
    SyntaxRule.optional(STATEMENT_CONDITION)
  )
    .andFollowedBy(SyntaxRule.separator('{'))
    .andFollowedBy(SyntaxRule.optional(SyntaxRule.repeat(substatementRule)))
    .andFollowedBy(SyntaxRule.separator('}'))
    .map(
      (matches): SrcNode<CallStatementNode<S>> => {
        const [
          key,
          name,
          ,
          /* sepArgStart */ maybeArguments,
          ,
          /* sepArgEnd */ maybeCondition,
          ,
          /* sepStart */ statements,
          sepEnd,
        ] = matches;

        return {
          kind: 'CallStatement',
          condition: maybeCondition,
          operationName: name.data.identifier,
          arguments: maybeArguments ?? [],
          statements: statements ?? [],
          location: key.location,
          span: {
            start: key.span.start,
            end: sepEnd.span.end,
          },
        };
      }
    );
}

export const STATEMENT_RHS_VALUE: SyntaxRuleSrc<LiteralNode> = OBJECT_LITERAL.peekUnknown()
  .or(RHS_VALUE_FACTORY(';', '}', '\n'))
  .followedBy(SyntaxRule.optional(SyntaxRule.operator(';')))
  .map(
    (matches): SrcNode<LiteralNode> => {
      const [value /* maybeSemicolon */] = matches;

      return value;
    }
  );
