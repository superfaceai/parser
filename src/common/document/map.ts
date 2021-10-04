import { splitLimit } from '@superfaceai/ast';

import { tryParseVersionNumber } from './parser';
import { VersionRange } from './version';

/**
 * Class representing map version, every property except patch and label is required
 * Defeerence between this class and DocumenVersion is in optionality of properties - DocumentVersion is more abstract structire
 */
export class MapVersion {
  public static fromVersionRange(input: VersionRange): MapVersion {
    if (input.minor === undefined) {
      throw new Error(
        `Invalid profile version: ${input.toString()} - minor version is required`
      );
    }

    return new MapVersion(input.major, input.minor, input.patch, input.label);
  }

  public static fromString(input: string): MapVersion {
    const [restVersion, label] = splitLimit(input, '-', 1);
    const [majorStr, minorStr, patchStr] = splitLimit(restVersion, '.', 2);

    let patch;
    const major = tryParseVersionNumber(majorStr);
    if (major === undefined) {
      throw new Error(
        `Invalid map version: ${input} - major component: ${majorStr} is not a valid number`
      );
    }
    const minor = tryParseVersionNumber(minorStr);
    if (minor === undefined) {
      throw new Error(
        `Invalid map version: ${input} - minor component: ${minorStr} is not a valid number`
      );
    }
    if (patchStr) {
      patch = tryParseVersionNumber(patchStr);
      if (patch === undefined) {
        throw new Error(
          `Invalid map version: ${input} - patch component: ${patchStr} is not a valid number`
        );
      }
    }

    return new MapVersion(major, minor, patch, label);
  }

  public static fromParameters(params: {
    major: number;
    minor: number;
    //TODO: get rid of patch?
    patch?: number;
    //TODO: revision instead of label?
    label?: string;
  }): MapVersion {
    return new MapVersion(
      params.major,
      params.minor,
      params.patch,
      params.label
    );
  }

  toString(): string {
    let str = `${this.major}.${this.minor}`;

    if (this.patch !== undefined) {
      str += `.${this.patch}`;
    }

    return this.label ? `${str}-${this.label}` : str;
  }

  private constructor(
    public readonly major: number,
    public readonly minor: number,
    //TODO get rid of patch??

    public readonly patch?: number,
    //TODO use revision??

    public readonly label?: string
  ) {}
}

/**
 * Represents default value of profile version in ProfileId instance
 */
export const DEFAULT_MAP_VERSION = MapVersion.fromParameters({
  major: 1,
  minor: 0,
  patch: 0,
});

/**
 * Represents default value of mapp version in string format
 */
export const DEFAULT_MAP_VERSION_STR = '1.0.';

/**
 * Class representing map id
 */
export class MapId {
  public readonly profile: { scope?: string; name: string; id: string };
  //TODO: do we want to update DocumentVersion to something similar to ProfileVersion class? It would problably decrease the confucion
  //In map id version has to contain major and minor property, others are optional
  public readonly version: MapVersion;
  public readonly provider: string;
  public readonly variant?: string;

  //TODO: fromId

  public static fromParameters(params: {
    profile: {
      name: string;
      scope?: string;
    };
    version: MapVersion;
    provider: string;
    variant?: string;
  }): MapId {
    return new MapId(
      params.profile,
      params.version,
      params.provider,
      params.variant
    );
  }

  private constructor(
    profile: { scope?: string; name: string },
    version: MapVersion,
    provider: string,
    variant?: string
  ) {
    this.profile = {
      ...profile,
      id: profile.scope ? `${profile.scope}/${profile.name}` : profile.name,
    };
    this.version = version;
    this.provider = provider;
    this.variant = variant;
  }

  //TODO: do we want acces mapId WITHOUT the version??
  toString(): string {
    let id = `${this.profile.id}.${this.provider}`;
    if (this.variant) {
      id += `.${this.variant}`;
    }
    let version = `${this.version.major}.${this.version.minor}`;
    version += this.version.patch !== undefined ? `.${this.version.patch}` : '';
    version += this.version.label !== undefined ? `-${this.version.label}` : '';

    return id + `@${version}`;
  }
}
