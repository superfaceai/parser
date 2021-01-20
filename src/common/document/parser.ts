import { splitLimit } from '../split';
import {
  DocumentId,
  DocumentVersion,
  MapDocumentId,
  ProfileDocumentId,
} from './interfaces';

export type ParseResult<T> =
  | { kind: 'parsed'; value: T }
  | { kind: 'error'; message: string };

const ID_NAME_RE = /^[a-z][a-z0-9_-]*$/;
/**
 * Checks whether the identififer is a lowercase identififer as required for document ids in the spec.
 */
export function isValidDocumentIdentifier(str: string): boolean {
  return ID_NAME_RE.test(str);
}

const VERSION_NUMBER_RE = /^[0-9]+$/;
/**
 * Parses a singular version number or returns undefined.
 */
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
export function parseVersion(version: string): ParseResult<DocumentVersion> {
  const [restVersion, label] = splitLimit(version, '-', 1);
  const [majorStr, minorStr, patchStr] = splitLimit(restVersion, '.', 2);

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
    value: {
      major,
      minor,
      patch,
      label,
    },
  };
}

/** Parses document id.
 *
 * This parses a more general structure that fits both the profile and map id.
 */
export function parseDocumentId(id: string): ParseResult<DocumentId> {
  // parse scope first
  let scope: string | undefined;
  const [splitScope, scopeRestId] = splitLimit(id, '/', 1);
  if (scopeRestId !== undefined) {
    scope = splitScope;
    if (!isValidDocumentIdentifier(scope)) {
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
  const version = parsedVersion?.value;

  const middle = id.split('.');
  for (const m of middle) {
    if (!isValidDocumentIdentifier(m)) {
      return {
        kind: 'error',
        message: `"${m}" is not a valid lowercase identifier`,
      };
    }
  }

  return {
    kind: 'parsed',
    value: {
      scope,
      middle,
      version,
    },
  };
}

/** Parses the id using `parseDocumentId`, checks that the `middle` is a valid `name`. */
export function parseProfileId(id: string): ParseResult<ProfileDocumentId> {
  const baseResult = parseDocumentId(id);
  if (baseResult.kind === 'error') {
    return baseResult;
  }
  const base = baseResult.value;

  if (base.middle.length !== 1) {
    return {
      kind: 'error',
      message: `"${base.middle.join('.')}" is not a valid lowercase identifier`,
    };
  }

  if (base.version === undefined) {
    return {
      kind: 'error',
      message: 'profile id requires a version tag',
    };
  }

  return {
    kind: 'parsed',
    value: {
      scope: base.scope,
      name: base.middle[0],
      version: base.version,
    },
  };
}

/**
 * Parses version label in format `revN`
 */
export function parseRevisionLabel(label: string): ParseResult<number> {
  let value = label.trim();

  if (!value.startsWith('rev')) {
    return {
      kind: 'error',
      message: 'revision label must be in format `revN`',
    };
  }
  value = value.slice(3);

  const revision = parseVersionNumber(value);
  if (revision === undefined) {
    return {
      kind: 'error',
      message:
        'revision label must be in format `revN` where N is a non-negative integer',
    };
  }

  return {
    kind: 'parsed',
    value: revision,
  };
}

/**
 * Parses the id using `parseDocumentId`, checks that the middle portion contains
 * a valid `name`, `provider` and parses the revision tag, if any.
 */
export function parseMapId(id: string): ParseResult<MapDocumentId> {
  const baseResult = parseDocumentId(id);
  if (baseResult.kind === 'error') {
    return baseResult;
  }
  const base = baseResult.value;

  // parse name portion
  const [name, provider, variant] = base.middle;
  if (provider === undefined) {
    return {
      kind: 'error',
      message: 'provider is not a valid lowercase identifier',
    };
  }

  if (base.version === undefined) {
    return {
      kind: 'error',
      message: 'version must be present in map id',
    };
  }
  let revision = undefined;
  if (base.version.label !== undefined) {
    const parseResult = parseRevisionLabel(base.version.label);
    if (parseResult.kind === 'error') {
      return parseResult;
    }

    revision = parseResult.value;
  }

  const version = {
    major: base.version.major,
    minor: base.version.minor,
    revision,
  };

  return {
    kind: 'parsed',
    value: {
      scope: base.scope,
      name,
      provider,
      variant,
      version,
    },
  };
}
