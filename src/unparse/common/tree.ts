export type UnparserTokenKind =
  | 'Atom'
  | 'Space'
  | 'Newline'
  | 'Block'
  | 'Condition';
export type UnparserTokenBase = {
  kind: UnparserTokenKind;
};

export type AtomToken = UnparserTokenBase & {
  kind: 'Atom';
  value: string;
};
export type SpaceToken = UnparserTokenBase & {
  kind: 'Space';
  count: number;
};
export type NewlineToken = UnparserTokenBase & {
  kind: 'Newline';
};
export type BlockToken = UnparserTokenBase & {
  kind: 'Block';
  symbols: '{}' | '()' | '[]' | '<>';
  tokens: UnparserToken[];
};
export type ConditionToken = UnparserTokenBase & {
  kind: 'Condition';
  /** Required configuration to enable materialization of this token. */
  condition: string;
  positive: UnparserTokenGroup;
  negative: UnparserTokenGroup;
};

export type UnparserToken =
  | AtomToken
  | SpaceToken
  | NewlineToken
  | BlockToken
  | ConditionToken;
export type UnparserTokenGroup = UnparserToken[];

// UnparserToken factory
export const UnparserToken = {
  /** Produces a token group glued together by spaces.
   *
   * Strings are turned into atoms. Undefined elements are filtered out.
   */
  withSpaces(
    ...values: (UnparserToken | UnparserTokenGroup | string | undefined)[]
  ): UnparserTokenGroup {
    return UnparserToken.addGlue(
      UnparserToken.space(),
      values.map(v => (typeof v === 'string' ? UnparserToken.atom(v) : v))
    );
  },

  if(
    condition: ConditionToken['condition'],
    positive: UnparserTokenGroup | UnparserToken,
    negative?: UnparserTokenGroup | UnparserToken
  ): ConditionToken {
    const neg = negative ?? [];

    return {
      kind: 'Condition',
      condition,
      positive: Array.isArray(positive) ? positive : [positive],
      negative: Array.isArray(neg) ? neg : [neg],
    };
  },

  /** Adds `glue` between tokens or token groups.
   *
   * Undefined elements are filtered out.
   */
  addGlue(
    glue: UnparserToken | UnparserTokenGroup,
    tokens: (UnparserToken | UnparserTokenGroup | undefined)[]
  ): UnparserToken[] {
    const notUndefined = (
      v: UnparserToken | UnparserTokenGroup | undefined
    ): v is UnparserToken | UnparserTokenGroup => v !== undefined;

    const glueGroup = Array.isArray(glue) ? glue : [glue];

    return tokens
      .filter(notUndefined)
      .flatMap<UnparserToken>((tokenGroup, index, arr) => {
        if (index < arr.length - 1) {
          if (Array.isArray(tokenGroup)) {
            return [...tokenGroup, ...glueGroup];
          }

          return [tokenGroup, ...glueGroup];
        }

        return tokenGroup;
      });
  },

  atom(value: string): AtomToken {
    return { kind: 'Atom', value };
  },
  space(count?: number): SpaceToken {
    return { kind: 'Space', count: count ?? 1 };
  },
  newline(): NewlineToken {
    return { kind: 'Newline' };
  },

  genericBlock(
    symbols: BlockToken['symbols'],
    lead: UnparserTokenGroup,
    glue: UnparserTokenGroup,
    trail: UnparserTokenGroup,
    items: UnparserTokenGroup[]
  ): BlockToken {
    return {
      kind: 'Block',
      symbols,
      tokens: [
        ...lead,
        ...items.flatMap<UnparserToken>((itemLine, index, arr) => {
          if (index < arr.length - 1) {
            return [...itemLine, ...glue];
          } else {
            return itemLine;
          }
        }),
        ...trail,
      ],
    };
  },
};

export type UnparserTreeMaterializerConfiguration = {
  identString: string;
  conditionValues: Record<string, boolean>;
};
export class UnparserTreeMaterializer {
  private result = '';
  private depth = 0;
  private lineState: 'start' | 'continue' = 'start';
  /** Number of consecutive spaces since the last token. */
  private spaceCount = 0;

  constructor(
    private readonly configuration: UnparserTreeMaterializerConfiguration
  ) {}

  private resolveCondition(token: ConditionToken): UnparserTokenGroup {
    if (!(token.condition in this.configuration.conditionValues)) {
      throw new Error('UnparserTreeMaterializer: Invalid condition key');
    }

    let result = token.negative;
    if (this.configuration.conditionValues[token.condition]) {
      result = token.positive;
    }

    return result;
  }

  materialize(tree: UnparserToken[]): string {
    // reset all state
    this.result = '';
    this.depth = 0;
    this.lineState = 'start';
    this.spaceCount = 0;

    for (const token of tree) {
      this.materializeRecursive(token);
    }

    return this.result;
  }

  private emit(s: string) {
    switch (this.lineState) {
      case 'start':
        this.lineState = 'continue';
        this.result += this.configuration.identString.repeat(this.depth) + s;
        break;

      case 'continue':
        this.result += s;
        break;
    }
  }

  private materializeRecursive(token: UnparserToken) {
    switch (token.kind) {
      case 'Atom':
        this.emit(token.value);
        this.spaceCount = 0;
        break;

      case 'Space':
        if (this.spaceCount < token.count) {
          this.emit(' '.repeat(token.count - this.spaceCount));
          this.spaceCount = token.count;
        }
        break;

      case 'Newline':
        this.lineState = 'start';
        this.result += '\n';
        this.spaceCount = 0;
        break;

      case 'Block':
        this.emit(token.symbols[0]);
        this.spaceCount = 0;

        this.depth += 1;
        for (const subtoken of token.tokens) {
          this.materializeRecursive(subtoken);
        }
        this.depth -= 1;

        this.emit(token.symbols[1]);
        this.spaceCount = 0;
        break;

      case 'Condition':
        for (const subtoken of this.resolveCondition(token)) {
          this.materializeRecursive(subtoken);
        }
        break;
    }
  }
}
