import type { UnparserTokenConditionValueNames } from './materializer'

export type UnparserTokenKind =
  | 'Atom'
  | 'Space'
  | 'Newline'
  | 'Block'
;
export type UnparserTokenBase = {
  kind: UnparserTokenKind;

  /** Required configuration to enable materialization of this token. */
  condition?: UnparserTokenConditionValueNames;
};

export type AtomToken = UnparserTokenBase & {
  kind: 'Atom';
  value: string;
};
export type SpaceToken = UnparserTokenBase & {
  kind: 'Space';
};
export type NewlineToken = UnparserTokenBase & {
  kind: 'Newline';
};
export type BlockToken = UnparserTokenBase & {
  kind: 'Block';
  symbols: '{}' | '()' | '[]' | '<>';
  tokens: UnparserToken[];
};

export type UnparserToken = AtomToken | SpaceToken | NewlineToken | BlockToken;
export type UnparserTree = UnparserToken[];

// UnparserToken factory
export const UnparserToken = {
  addGlue(glue: UnparserToken, tokens: UnparserToken[]): UnparserToken[] {
    return tokens.flatMap<UnparserToken>(
      (token, index, arr) => {
        if (index < arr.length - 1) {
          return [token, glue];
        } else {
          return [token];
        }
      }
    );
  },
  
  atom(value: string, condition?: UnparserTokenBase['condition']): AtomToken {
    return { kind: 'Atom', value, condition };
  },
  space(condition?: UnparserTokenBase['condition']): SpaceToken {
    return { kind: 'Space', condition };
  },
  newline(condition?: UnparserTokenBase['condition']): NewlineToken {
    return { kind: 'Newline', condition };
  },

  spacedAtoms(...values: string[]): UnparserToken[] {
    return UnparserToken.addGlue(
      UnparserToken.space(),
      values.map(v => UnparserToken.atom(v))
    );
  },
  
  genericBlock(
    symbols: BlockToken['symbols'],
    lead: UnparserToken[],
    glue: UnparserToken[],
    trail: UnparserToken[],
    items: UnparserToken[][]
  ): BlockToken {
    return {
      kind: 'Block',
      symbols,
      tokens: [
        ...lead,
        ...items.flatMap<UnparserToken>(
          (itemLine, index, arr) => {
            if (index < arr.length - 1) {
              return [...itemLine, ...glue];
            } else {
              return itemLine;
            }
          }
        ),
        ...trail
      ]
    }
  },

  setBlock(...items: UnparserToken[][]): BlockToken {
    const newline = UnparserToken.newline('setBlockNewlines');
    const spaceLeadTrail = UnparserToken.space('setBlockSpaceLeadTrail');
    
    return UnparserToken.genericBlock(
      '{}',
      [spaceLeadTrail, newline],
      [UnparserToken.atom(';', 'setBlockSemicolonGlue'), UnparserToken.space('setBlockSpaceGlue'), newline],
      [UnparserToken.atom(';', 'setBlockSemicolonTrail'), newline, spaceLeadTrail],
      items
    );
  },

  statementBlock(...items: UnparserToken[][]): BlockToken {
    const newline = UnparserToken.newline();
    
    return UnparserToken.genericBlock(
      '{}',
      [newline],
      [newline, newline],
      [newline],
      items
    );
  },

  callBlock(...items: UnparserToken[][]): BlockToken {
    const expandNewline = UnparserToken.newline('callBlockNewlines');
    const spaceLeadTrail = UnparserToken.space('callBlockSpaceLeadTrail');
    
    return UnparserToken.genericBlock(
      '()',
      [spaceLeadTrail, expandNewline],
      [UnparserToken.atom(',', 'callBlockCommaGlue'), UnparserToken.space('callBlockSpaceGlue'), expandNewline],
      [UnparserToken.atom(',', 'callBlockCommaTrail'), expandNewline, spaceLeadTrail],
      items
    );
  }
}
