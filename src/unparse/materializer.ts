import { UnparserToken, UnparserTree } from './tree';

export type UnparserMaterializationConfiguration = {
  indentString: string;
  trailingTerminators: boolean;
  setBlockStyle: 'collapsed' | 'expanded' | 'expanded+semicolons';
  callBlockStyle: 'collapsed' | 'expanded' | 'expanded+commas';
};

/** Boolean algebra-compatible representation of the condition configuration.
* 
* Beware that this configuration can have internal inconsistencies which could
* produce invalid code.
* 
* Usually a block is composed like this:
* ```
* {
*   <lead>
*   <item> <glue>
*   <item> <glue>
*   <item>
*   <trail>
* }
* ```
*/
type TokenConditionConfiguration = {
  /** Lead, glue and trail items with newlines. */
  setBlockNewlines: boolean;
  /** Lead and trail items with spaces. */
  setBlockSpaceLeadTrail: boolean;
  /** Glue items with spaces. */
  setBlockSpaceGlue: boolean;
  /** Glue items with semicolons. Must be true if `!setBlockNewlines`. */
  setBlockSemicolonGlue: boolean;
  /** Trail the last item with a semicolon. */
  setBlockSemicolonTrail: boolean;

  /** Lead, glue and trail items with newlines. */
  callBlockNewlines: boolean;
  /** Lead and trail items with spaces. */
  callBlockSpaceLeadTrail: boolean;
  /** Glue items with spaces. */
  callBlockSpaceGlue: boolean;
  /** Glue items with commas. Must be true if `!callBlockBlockNewlines`. */
  callBlockCommaGlue: boolean;
  /** Trail the last item with a comma. */
  callBlockCommaTrail: boolean;
};
export type UnparserTokenConditionValueNames = keyof TokenConditionConfiguration;

type InnerConfiguration = {
  identString: string;
  conditions: TokenConditionConfiguration,
};
class UnparserTreeMaterializer {
  static transformConfigurationIntoBooleans(configuration: UnparserMaterializationConfiguration): InnerConfiguration {
    const setBlockExpand = configuration.setBlockStyle === 'expanded' || configuration.setBlockStyle === 'expanded+semicolons';
    const setBlockSemicolons = configuration.setBlockStyle === 'collapsed' || configuration.setBlockStyle === 'expanded+semicolons';

    const callBlockExpand = configuration.callBlockStyle === 'expanded' || configuration.callBlockStyle === 'expanded+commas';
    const callBlockCommas = configuration.callBlockStyle === 'collapsed' || configuration.callBlockStyle === 'expanded+commas';
    
    return {
      identString: configuration.indentString,
      conditions: {
        setBlockNewlines: setBlockExpand,
        setBlockSpaceLeadTrail: !setBlockExpand,
        setBlockSpaceGlue: !setBlockExpand,
        setBlockSemicolonGlue: setBlockSemicolons,
        setBlockSemicolonTrail: setBlockSemicolons && configuration.trailingTerminators,

        callBlockNewlines: callBlockExpand,
        callBlockSpaceLeadTrail: false,
        callBlockSpaceGlue: !callBlockExpand,
        callBlockCommaGlue: callBlockCommas,
        callBlockCommaTrail: callBlockCommas && configuration.trailingTerminators
      }
    };
  }

  private readonly configuration: InnerConfiguration;
  private result = '';
  private depth = 0;
  private lineState: 'start' | 'continue' = 'start';
  
  constructor(
    private readonly tree: UnparserTree,
    configuration: UnparserMaterializationConfiguration
  ) {
    this.configuration = UnparserTreeMaterializer.transformConfigurationIntoBooleans(configuration);
  }

  private resolveCondition(condition: UnparserToken['condition'] | undefined): boolean {
    // non-existent conditions are always fulfilled
    if (condition === undefined) {
      return true;
    }

    return this.configuration.conditions[condition];
  }

  materialize(): string {
    // reset all state
    this.result = '';
    this.depth = 0;
    this.lineState = 'start';

    for (const token of this.tree) {
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
    // ignore this token and don't change any state
    if (!this.resolveCondition(token.condition)) {
      return;
    }    

    switch (token.kind) {
      case 'Atom':
        this.emit(token.value);
        break;

      case 'Space':
        this.result += ' ';
      break;

      case 'Newline':
        this.lineState = 'start';
        this.result += '\n';
        break;

      case 'Block':
        this.emit(token.symbols[0]);
        
        this.depth += 1;
        for (const subtoken of token.tokens) {
          this.materializeRecursive(subtoken);
        }
        this.depth -= 1;

        this.emit(token.symbols[1]);
        break;
    }
  }
}

export function materializeTree(tree: UnparserTree, configuration: UnparserMaterializationConfiguration): string {
  const materializer = new UnparserTreeMaterializer(tree, configuration);

  return materializer.materialize();
}
