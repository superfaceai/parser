import { extractVersion, VERSION as AST_VERSION } from '@superfaceai/ast';

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
function parseVersion(input: string): FullVersion {
  let version: FullVersion;
  try {
    const extracted = extractVersion(input);
    if (extracted.minor === undefined || extracted.patch === undefined) {
      console.error(
        `Version "${input}" missing minor or patch version. Defaulting missing parts to 0.`
      );
      version = {
        major: extracted.major,
        minor: extracted.minor ?? 0,
        patch: extracted.patch ?? 0,
        label: extracted.label,
      };
    } else {
      version = extracted as FullVersion;
    }
  } catch (err) {
    console.error(`Unable to parse version "${input}". Defaulting to 0.0.0.`);
    version = {
      major: 0,
      minor: 0,
      patch: 0,
    };
  }

  return version;
}

export const PARSED_VERSION: FullVersion = parseVersion(VERSION);
export const PARSED_AST_VERSION: FullVersion = parseVersion(AST_VERSION);
