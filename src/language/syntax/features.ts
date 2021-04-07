import { LexerTokenStream } from '../lexer';
import { RuleResult, SyntaxRule, SyntaxRuleOr } from './rule';

export type ParserFeature =
  | 'nested_object_literals'
  | 'shorthand_http_request_slots'
  | 'multiple_security_schemes';
export const PARSER_FEATURES: {
  [P in ParserFeature]: boolean;
} = {
  nested_object_literals: false,
  shorthand_http_request_slots: false,
  multiple_security_schemes: false,
};

export function isFeature(input: string): input is ParserFeature {
  return input in PARSER_FEATURES;
}
export function parseEnvFeatures(): void {
  process.env['SLANG_FEATURES']?.split(',').forEach(ft => {
    let feature = ft.trim();
    const disable = feature.startsWith('!');
    if (disable) {
      feature = feature.slice(1);
    }

    if (isFeature(feature)) {
      PARSER_FEATURES[feature] = !disable;
    }
  });
}

/**
 * Returns an array of all features.
 */
export function allFeatures(): ParserFeature[] {
  return Object.keys(PARSER_FEATURES) as ParserFeature[];
}

export class SyntaxRuleFeatureSubstitute<B, E> extends SyntaxRule<B | E> {
  /** Remember the last execution feature state so we can correctly report it in errors even after features are toggled off. */
  private lastExecutionFeatureState: boolean;

  /**
   * If at runtime feature `feature` is enabled, acts as `enabled`, otherwise acts as `base`.
   */
  constructor(
    readonly base: SyntaxRule<B>,
    readonly feature: ParserFeature,
    readonly enabled: SyntaxRule<E>
  ) {
    super();

    this.lastExecutionFeatureState = PARSER_FEATURES[this.feature];
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<B | E> {
    this.lastExecutionFeatureState = PARSER_FEATURES[this.feature];

    if (this.lastExecutionFeatureState) {
      return this.enabled.tryMatch(tokens);
    } else {
      return this.base.tryMatch(tokens);
    }
  }

  [Symbol.toStringTag](): string {
    if (this.lastExecutionFeatureState) {
      return this.enabled.toString();
    } else {
      return this.base.toString();
    }
  }
}

/**
 * Combined two rules using `or` if feature is enabled.
 */
export class SyntaxRuleFeatureOr<B, E> extends SyntaxRule<B | E> {
  /** Remember the last execution feature state so we can correctly report it in errors even after features are toggled off. */
  private lastExecutionFeatureState: boolean;
  /** Precache the or rule so we don't construct it on each `tryMatch` and `toString` */
  private readonly orRule: SyntaxRule<B | E>;

  /**
   * If at runtime feature `feature` is enabled, acts as `base.or(enabled)`, otherwise
   * acts as `base`.
   */
  constructor(
    readonly base: SyntaxRule<B>,
    readonly feature: ParserFeature,
    ...enabled: SyntaxRule<E>[]
  ) {
    super();

    this.orRule = SyntaxRuleOr.chainOr<B | E>(base, ...enabled);
    this.lastExecutionFeatureState = PARSER_FEATURES[this.feature];
  }

  tryMatch(tokens: LexerTokenStream): RuleResult<E | B> {
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
