import { LexerTokenStream } from "../lexer";
import { RuleResult, SyntaxRule } from "./rule";

export type ParserFeature = 
  | 'nested_object_literals'
  | 'shorthand_http_request_slots'
;
export const PARSER_FEATURES: {
  [P in ParserFeature]: boolean
} = {
  'nested_object_literals': false,
  'shorthand_http_request_slots': false
};

/**
 * Returns an array of all features.
 */
export function allFeatures(): ParserFeature[] {
  return Object.keys(PARSER_FEATURES) as ParserFeature[]
}

function isFeature(input: string): input is ParserFeature {
  return input in PARSER_FEATURES;
}
export function parseEnvFeatures() {
  process.env['SLANG_FEATURES']?.split(',').forEach(
    (ft) => {
      let feature = ft.trim();
      const disable = feature.startsWith('!');
      if (disable) {
        feature = feature.slice(1);
      }

      if (isFeature(feature)) {
        PARSER_FEATURES[feature] = !disable;
      }
    }
  )
}

export class SyntaxRuleFeatureSubstitute<E, D> extends SyntaxRule<E | D> {
  private lastExecutionFeatureState: boolean;
  
  /**
   * If at runtime feature `feature` is enabled, acts as `enabled`, otherwise
   * acts as `disabled`.
   */
  constructor(
    readonly feature: ParserFeature,
    readonly enabled: SyntaxRule<E>,
    readonly disabled: SyntaxRule<D>
  ) {
    super()

    this.lastExecutionFeatureState = PARSER_FEATURES[this.feature];
  }

  tryMatch(
    tokens: LexerTokenStream
  ): RuleResult<E | D> {
    this.lastExecutionFeatureState = PARSER_FEATURES[this.feature];

    if (this.lastExecutionFeatureState) {
      return this.enabled.tryMatch(tokens);
    } else {
      return this.disabled.tryMatch(tokens);
    }
  }

  [Symbol.toStringTag](): string {
    if (this.lastExecutionFeatureState) {
      return this.enabled.toString();
    } else {
      return this.disabled.toString();
    }
  }
}

/**
 * Combined two rules using `or` if feature is enabled.
 */
export class SyntaxRuleFeatureOr<E, B> extends SyntaxRule<E | B> {
  private lastExecutionFeatureState: boolean;
  private readonly orRule: SyntaxRule<E | B>;
  
  /**
   * If at runtime feature `feature` is enabled, acts as `base.or(enabled)`, otherwise
   * acts as `base`.
   */
  constructor(
    readonly feature: ParserFeature,
    readonly enabled: SyntaxRule<E>,
    readonly base: SyntaxRule<B>
  ) {
    super()

    this.lastExecutionFeatureState = PARSER_FEATURES[this.feature];
    this.orRule = base.or(enabled);
  }

  tryMatch(
    tokens: LexerTokenStream
  ): RuleResult<E | B> {
    this.lastExecutionFeatureState = PARSER_FEATURES[this.feature];

    if (this.lastExecutionFeatureState) {
      return this.orRule.tryMatch(tokens);
    } else {
      return this.base.tryMatch(tokens);
    }
  }

  [Symbol.toStringTag](): string {
    if (this.lastExecutionFeatureState) {
      return this.orRule.toString();
    } else {
      return this.base.toString();
    }
  }
}