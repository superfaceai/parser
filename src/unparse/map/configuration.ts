import { UnparserTreeMaterializerConfiguration } from '../common/tree';

export type MapUnparserConfiguration = {
  /** String used for one level of indentation. */
  indentString: string;
  /** Whether to add trailing terminators (commas, semicolons). */
  trailingTerminators: boolean;
  /** Collapsed set blocks are on one line only and semicolons are mandatory. Expanded are on multiple lines with optional semicolons. */
  setBlockStyle: 'collapsed' | 'expanded' | 'expanded+semicolons';
  /** Call blocks appear in operation calls as the list of arguments between parens.
   *
   * Collapsed call blocks are on one line only and commas are mandatory. Expanded are on multiple lines with optional commas.
   */
  callBlockStyle: 'collapsed' | 'expanded' | 'expanded+commas';
  /** Collapsed object blocks are on one line only and commas are mandatory. Expanded are on multiple lines with optional commas. */
  objectBlockStyle: 'collapsed' | 'expanded' | 'expanded+commas';

  /** Whether to emit http call `default` selector. Non-default selectors are always emitted. */
  httpCallDefaultService: 'never' | 'always';
  /** Whether to emit http call `security none` selector. Non-default selectors are always emitted. */
  httpCallDefaultSecurity: 'never' | 'always';
};
export const DEFAULT_MAP_UNPARSER_CONFIGURATION: MapUnparserConfiguration = {
  indentString: '  ',
  trailingTerminators: false,
  setBlockStyle: 'expanded',
  callBlockStyle: 'collapsed',
  objectBlockStyle: 'expanded',
  httpCallDefaultService: 'never',
  httpCallDefaultSecurity: 'never',
};

export function transformMapUnparserConfiguration(
  config: MapUnparserConfiguration
): UnparserTreeMaterializerConfiguration {
  const setBlockExpand =
    config.setBlockStyle === 'expanded' ||
    config.setBlockStyle === 'expanded+semicolons';
  const setBlockSemicolons =
    config.setBlockStyle === 'collapsed' ||
    config.setBlockStyle === 'expanded+semicolons';

  const callBlockExpand =
    config.callBlockStyle === 'expanded' ||
    config.callBlockStyle === 'expanded+commas';
  const callBlockCommas =
    config.callBlockStyle === 'collapsed' ||
    config.callBlockStyle === 'expanded+commas';

  const objectBlockExpand =
    config.objectBlockStyle === 'expanded' ||
    config.objectBlockStyle === 'expanded+commas';
  const objectBlockCommas =
    config.objectBlockStyle === 'collapsed' ||
    config.objectBlockStyle === 'expanded+commas';

  return {
    identString: config.indentString,
    conditionValues: {
      setBlockNewlines: setBlockExpand,
      setBlockSpaceLeadTrail: !setBlockExpand,
      setBlockSpaceGlue: !setBlockExpand,
      setBlockSemicolonGlue: setBlockSemicolons,
      setBlockSemicolonTrail: setBlockSemicolons && config.trailingTerminators,

      callBlockNewlines: callBlockExpand,
      callBlockSpaceLeadTrail: false,
      callBlockSpaceGlue: !callBlockExpand,
      callBlockCommaGlue: callBlockCommas,
      callBlockCommaTrail: callBlockCommas && config.trailingTerminators,

      objectBlockNewlines: objectBlockExpand,
      objectBlockSpaceLeadTrail: !objectBlockExpand,
      objectBlockSpaceGlue: !objectBlockExpand,
      objectBlockCommaGlue: objectBlockCommas,
      objectBlockCommaTrail: objectBlockCommas && config.trailingTerminators,

      conditionBlockNewlines: false,
      conditionBlockSpaceLeadTrail: false,

      foreachBlockNewlines: false,
      foreachBlockSpaceLeadTrail: false,

      httpCallDefaultService: config.httpCallDefaultService === 'always',
      httpCallDefaultSecurity: config.httpCallDefaultSecurity === 'always',
    },
  };
}
