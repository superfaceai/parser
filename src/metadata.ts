import { splitLimit, parseVersionNumber, VERSION as AST_VERSION } from '@superfaceai/ast';

import createDebug from 'debug';
const metadataDebug = createDebug('superface-parser:metadata');

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-var-requires
const packageJson = require('../package.json');
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
export const VERSION: string = packageJson.version;

type FullVersion = {
  major: number;
  minor: number;
  patch: number;
  label?: string;
};
export function parseMetadataVersion(input: string): FullVersion {
  let version: FullVersion = {
    major: 0,
    minor: 0,
    patch: 0,
    label: undefined
  };

  const plusInInput = input.indexOf('+');
  if (plusInInput !== -1) {
    version.label = input.slice(plusInInput + 1);

    return version;
  }

  const [verStr, label] = splitLimit(input, '-', 1);
  const [majorStr, minorStr, patchStr] = splitLimit(verStr, '.', 2);

  try {
    version.major = parseVersionNumber(majorStr);
  } catch {
    metadataDebug(`Major version "${majorStr}" is not a valid number`);
  }

  if (minorStr !== undefined) {
    try {
      version.minor = parseVersionNumber(minorStr);
    } catch {
      metadataDebug(`Minor version "${minorStr}" is not a valid number`);
    }
  }

  if (patchStr !== undefined) {
    try {
      version.patch = parseVersionNumber(patchStr);
    } catch {
      metadataDebug(`Patch version "${patchStr}" is not a valid number`);
    }
  }

  version.label = label;

  return version;
}

export const PARSED_VERSION: FullVersion = parseMetadataVersion(VERSION);
export const PARSED_AST_VERSION: FullVersion = parseMetadataVersion(AST_VERSION);
