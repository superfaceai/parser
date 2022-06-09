import { BlockToken, UnparserToken, UnparserTokenGroup } from '../common/tree';

export const UnparserTokenMap = {
  ...UnparserToken,

  setBlock(...items: UnparserTokenGroup[]): BlockToken {
    const newline = UnparserToken.if(
      'setBlockNewlines',
      UnparserToken.newline()
    );
    const spaceLeadTrail = UnparserToken.if(
      'setBlockSpaceLeadTrail',
      UnparserToken.space()
    );

    return UnparserToken.genericBlock(
      '{}',
      [spaceLeadTrail, newline],
      [
        UnparserToken.if('setBlockSemicolonGlue', UnparserToken.atom(';')),
        UnparserToken.if('setBlockSpaceGlue', UnparserToken.space()),
        newline,
      ],
      [
        UnparserToken.if('setBlockSemicolonTrail', UnparserToken.atom(';')),
        newline,
        spaceLeadTrail,
      ],
      items
    );
  },

  statementBlock(...items: UnparserTokenGroup[]): BlockToken {
    const newline = UnparserToken.newline();

    return UnparserToken.genericBlock(
      '{}',
      [newline],
      [newline, newline],
      [newline],
      items
    );
  },

  callBlock(...items: UnparserTokenGroup[]): BlockToken {
    const newline = UnparserToken.if(
      'callBlockNewlines',
      UnparserToken.newline()
    );
    const spaceLeadTrail = UnparserToken.if(
      'callBlockSpaceLeadTrail',
      UnparserToken.space()
    );

    return UnparserToken.genericBlock(
      '()',
      [spaceLeadTrail, newline],
      [
        UnparserToken.if('callBlockCommaGlue', UnparserToken.atom(',')),
        UnparserToken.if('callBlockSpaceGlue', UnparserToken.space()),
        newline,
      ],
      [
        UnparserToken.if('callBlockCommaTrail', UnparserToken.atom(',')),
        newline,
        spaceLeadTrail,
      ],
      items
    );
  },

  objectBlock(...items: UnparserTokenGroup[]): BlockToken {
    const newline = UnparserToken.if(
      'objectBlockNewlines',
      UnparserToken.newline()
    );
    const spaceLeadTrail = UnparserToken.if(
      'objectBlockSpaceLeadTrail',
      UnparserToken.space()
    );

    return UnparserToken.genericBlock(
      '{}',
      [spaceLeadTrail, newline],
      [
        UnparserToken.if('objectBlockCommaGlue', UnparserToken.atom(',')),
        UnparserToken.if('objectBlockSpaceGlue', UnparserToken.space()),
        newline,
      ],
      [
        UnparserToken.if('objectBlockCommaTrail', UnparserToken.atom(',')),
        newline,
        spaceLeadTrail,
      ],
      items
    );
  },

  conditionBlock(condition: UnparserTokenGroup): BlockToken {
    const newline = UnparserToken.if(
      'conditionBlockNewlines',
      UnparserToken.newline()
    );
    const spaceLeadTrail = UnparserToken.if(
      'conditionBlockSpaceLeadTrail',
      UnparserToken.space()
    );

    return UnparserToken.genericBlock(
      '()',
      [spaceLeadTrail, newline],
      [],
      [newline, spaceLeadTrail],
      [condition]
    );
  },

  foreachBlock(foreach: UnparserTokenGroup): BlockToken {
    const newline = UnparserToken.if(
      'foreachBlockNewlines',
      UnparserToken.newline()
    );
    const spaceLeadTrail = UnparserToken.if(
      'foreachBlockSpaceLeadTrail',
      UnparserToken.space()
    );

    return UnparserToken.genericBlock(
      '()',
      [spaceLeadTrail, newline],
      [],
      [newline, spaceLeadTrail],
      [foreach]
    );
  },
};
