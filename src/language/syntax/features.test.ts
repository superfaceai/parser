import {
  allFeatures,
  parseEnvFeatures,
  PARSER_FEATURES,
  SyntaxRuleFeatureOr,
  SyntaxRuleFeatureSubstitute,
} from './features';
import { SyntaxRuleOperator, SyntaxRuleSeparator } from './rule';

describe('features', () => {
  describe('allFeatures', () => {
    it('returns all features', () => {
      expect(allFeatures()).toEqual([
        'nested_object_literals',
        'shorthand_http_request_slots',
        'multiple_security_schemes',
      ]);
    });
  });

  describe('parseEnvFeatures', () => {
    const orginalSlangFeatures = process.env['SLANG_FEATURES'];

    afterAll(() => {
      process.env['SLANG_FEATURES'] = orginalSlangFeatures;
    });
    it('parses env features', () => {
      const input = '!test, !multiple_security_schemes, nested_object_literals';
      process.env['SLANG_FEATURES'] = input;

      parseEnvFeatures();
      expect(PARSER_FEATURES).toEqual({
        multiple_security_schemes: false,
        nested_object_literals: true,
        shorthand_http_request_slots: false,
      });
    });
  });
  describe('SyntaxRuleFeatureSubstitute', () => {
    it('returns base rule', () => {
      PARSER_FEATURES['nested_object_literals'] = false;
      const instance = new SyntaxRuleFeatureSubstitute(
        new SyntaxRuleSeparator('EOF'),
        'nested_object_literals',
        new SyntaxRuleOperator(':')
      );
      expect(instance[Symbol.toStringTag]()).toEqual('`EOF`');
    });

    it('returns enabled rule', () => {
      PARSER_FEATURES['nested_object_literals'] = true;
      const instance = new SyntaxRuleFeatureSubstitute(
        new SyntaxRuleSeparator('EOF'),
        'nested_object_literals',
        new SyntaxRuleOperator(':')
      );
      expect(instance[Symbol.toStringTag]()).toEqual('`:`');
    });
  });

  describe('SyntaxRuleFeatureOr', () => {
    it('returns base rule', () => {
      PARSER_FEATURES['nested_object_literals'] = false;
      const instance = new SyntaxRuleFeatureOr(
        new SyntaxRuleSeparator('EOF'),
        'nested_object_literals',
        new SyntaxRuleOperator(':')
      );
      expect(instance[Symbol.toStringTag]()).toEqual('`EOF`');
    });

    it('returns or rule', () => {
      PARSER_FEATURES['nested_object_literals'] = true;
      const instance = new SyntaxRuleFeatureOr(
        new SyntaxRuleSeparator('EOF'),
        'nested_object_literals',
        new SyntaxRuleOperator(':')
      );
      expect(instance[Symbol.toStringTag]()).toEqual('`EOF` or `:`');
    });
  });
});
