const ID_NAME_RE = /^[a-z][a-z0-9_-]*$/;
export function isLowercaseIdentifier(str: string): boolean {
  return ID_NAME_RE.test(str);
}

/**
 * Splits string at delimiter, stopping at maxSplits splits.
 *
 * The last element of the array contains the rest of the string.
 *
 * Example:
 * ```
 * splitLimit('1.2.3.4', '.', 2) // ['1', '2', '3.4']
 * // Note that this is **not** the same as:
 * str.split(delimiter, 3) // ['1', '2', '3']
 * ```
 */
function splitLimit(
  str: string,
  delimiter: string,
  maxSplits: number
): string[] {
  const result: string[] = [];

  let current = str;
  while (result.length < maxSplits) {
    const i = current.indexOf(delimiter);
    if (i === -1) {
      break;
    }

    result.push(current.slice(0, i));
    current = current.slice(i + 1);
  }

  result.push(current);

  return result;
}

export type ParseVersionResult =
  | {
      kind: 'parsed';
      major: number;
      minor?: number;
      patch?: number;
      label?: string;
    }
  | {
      kind: 'error';
      message: string;
    };
const VERSION_NUMBER_RE = /^[0-9]+$/;
function parseVersionNumber(str: string): number | undefined {
  const value = str.trim();
  if (!VERSION_NUMBER_RE.test(value)) {
    return undefined;
  }

  return parseInt(value, 10);
}
/**
 * Parses version in format `major.minor.patch-label`
 */
export function parseVersion(version: string): ParseVersionResult {
  const [majorStr, minorStr, restStr] = splitLimit(version, '.', 2);

  let patchStr: string | undefined = undefined;
  let label: string | undefined = undefined;
  if (restStr !== undefined) {
    [patchStr, label] = splitLimit(restStr, '-', 1);
  }

  const major = parseVersionNumber(majorStr);
  if (major === undefined) {
    return { kind: 'error', message: 'major component is not a valid number' };
  }

  let minor = undefined;
  if (minorStr !== undefined) {
    minor = parseVersionNumber(minorStr);
    if (minor === undefined) {
      return {
        kind: 'error',
        message: 'minor component is not a valid number',
      };
    }
  }

  let patch = undefined;
  if (patchStr !== undefined) {
    patch = parseVersionNumber(patchStr);
    if (patch === undefined) {
      return {
        kind: 'error',
        message: 'patch component is not a valid number',
      };
    }
  }

  return {
    kind: 'parsed',
    major,
    minor,
    patch,
    label,
  };
}

/**
 * Parses document name.
 *
 * This function parses both profile and map names and returns a corresponding result.
 */
export type ParseDocumentIdentifierResult =
  | {
      kind: 'parsed';
      scope?: string;
      name: string;
      version?: {
        major: number;
        minor: number;
        patch: number;
        label?: string;
      };
    }
  | {
      kind: 'error';
      message: string;
    };
function parseDocumentId(id: string): ParseDocumentIdentifierResult {
  // parse scope first
  let scope: string | undefined;
  const [splitScope, scopeRestId] = splitLimit(id, '/', 1);
  if (scopeRestId !== undefined) {
    scope = splitScope;
    if (!isLowercaseIdentifier(scope)) {
      return {
        kind: 'error',
        message: 'scope is not a valid lowercase identifier',
      };
    }

    // strip the scope
    id = scopeRestId;
  }

  let parsedVersion;
  const [versionRestId, splitVersion] = splitLimit(id, '@', 1);
  if (splitVersion !== undefined) {
    parsedVersion = parseVersion(splitVersion);

    if (parsedVersion.kind === 'error') {
      return {
        kind: 'error',
        message: 'could not parse version: ' + parsedVersion.message,
      };
    }

    // strip the version
    id = versionRestId;
  }

  const name = id;

  // unpack version
  let version = undefined;
  if (parsedVersion !== undefined) {
    version = {
      major: parsedVersion.major,
      minor: parsedVersion.minor ?? 0,
      patch: parsedVersion.patch ?? 0,
      label: parsedVersion.label,
    };
  }

  return {
    kind: 'parsed',
    scope,
    name,
    version,
  };
}

export type ParseProfileIdResult =
  | {
      kind: 'parsed';
      scope?: string;
      name: string;
      version?: {
        major: number;
        minor: number;
        patch: number;
      };
    }
  | { kind: 'error'; message: string };
export function parseProfileId(id: string): ParseProfileIdResult {
  const baseResult = parseDocumentId(id);

  if (baseResult.kind === 'error') {
    return baseResult;
  }

  if (!isLowercaseIdentifier(baseResult.name)) {
    return {
      kind: 'error',
      message: 'name is not a valid lowercase identifier',
    };
  }

  let version = undefined;
  if (baseResult.version !== undefined) {
    version = {
      major: baseResult.version.major,
      minor: baseResult.version.minor,
      patch: baseResult.version.patch,
    };
  }

  return {
    kind: 'parsed',
    scope: baseResult.scope,
    name: baseResult.name,
    version,
  };
}

type ParseRevisionLabelResult =
  | { kind: 'parsed'; revision: number }
  | { kind: 'error'; message: string };
/**
 * Parses version label in format `revN`
 */
export function parseRevisionLabel(label: string): ParseRevisionLabelResult {
  let value = label.trim();

  if (!value.startsWith('rev')) {
    return { kind: 'error', message: 'label must be in format `revN`' };
  }
  value = value.slice(3);

  const revision = parseVersionNumber(value);
  if (revision === undefined) {
    return {
      kind: 'error',
      message:
        'label must be in format `revN` where N is a non-negative integer',
    };
  }

  return {
    kind: 'parsed',
    revision,
  };
}

export type ParseMapIdResult =
  | {
      kind: 'parsed';
      scope?: string;
      name: string;
      provider: string;
      variant?: string;
      version?: {
        major: number;
        minor: number;
        patch: number;
        revision?: number;
      };
    }
  | { kind: 'error'; message: string };
export function parseMapId(id: string): ParseMapIdResult {
  const baseResult = parseDocumentId(id);

  if (baseResult.kind === 'error') {
    return baseResult;
  }

  // parse name portion
  const [name, provider, variant] = splitLimit(baseResult.name, '.', 2);
  if (!isLowercaseIdentifier(name)) {
    return {
      kind: 'error',
      message: 'name is not a valid lowercase identifier',
    };
  }
  if (provider !== undefined && !isLowercaseIdentifier(provider)) {
    return {
      kind: 'error',
      message: 'provider is not a valid lowercase identifier',
    };
  }
  if (variant !== undefined && !isLowercaseIdentifier(variant)) {
    return {
      kind: 'error',
      message: 'variant is not a valid lowercase identifier',
    };
  }

  let version = undefined;
  if (baseResult.version !== undefined) {
    let revision = undefined;
    if (baseResult.version.label !== undefined) {
      const parsedRevision = parseRevisionLabel(baseResult.version.label);

      if (parsedRevision.kind === 'error') {
        return {
          kind: 'error',
          message: 'could not parse revision: ' + parsedRevision.message,
        };
      }

      revision = parsedRevision.revision;
    }

    version = {
      major: baseResult.version.major,
      minor: baseResult.version.minor,
      patch: baseResult.version.patch,
      revision,
    };
  }

  return {
    kind: 'parsed',
    scope: baseResult.scope,
    name,
    provider,
    variant,
    version,
  };
}
