import { splitLimit } from '../split';
import { parseProfileId, parseVersionNumber } from './parser';

/**
 * Class representing profile version, every property except label is required
 * Defeerence between this class and DocumenVersion is in optionality of properties - DocumentVersion is more abstract structire
 */
export class ProfileVersion {
  public static fromString(input: string): ProfileVersion {
    const [restVersion, label] = splitLimit(input, '-', 1);
    const [majorStr, minorStr, patchStr] = splitLimit(restVersion, '.', 2);

    const major = parseVersionNumber(majorStr);
    if (major === undefined) {
      throw new Error(
        `Invalid profile version: ${input} - major component is not a valid number`
      );
    }
    const minor = parseVersionNumber(minorStr);
    if (minor === undefined) {
      throw new Error(
        `Invalid profile version: ${input} - minor component is not a valid number`
      );
    }
    const patch = parseVersionNumber(patchStr);
    if (patch === undefined) {
      throw new Error(
        `Invalid profile version: ${input} - patch component is not a valid number`
      );
    }

    return new ProfileVersion(major, minor, patch, label);
  }

  public static fromParameters(params: {
    major: number;
    minor: number;
    patch: number;
    label?: string;
  }): ProfileVersion {
    return new ProfileVersion(
      params.major,
      params.minor,
      params.patch,
      params.label
    );
  }

  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}-${this.label ?? ''}`;
  }

  private constructor(
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number,
    public readonly label?: string
  ) {}
}

export class ProfileId {
  /**
   * Creates instance of ProfileId from string
   * @param profileId string in format {scope/}{name}{@major.minor.path-label} where scope,label and entire version is optional
   * @returns instance of ProfileId
   */
  public static fromId(profileId: string): ProfileId {
    const parsed = parseProfileId(profileId);
    if (parsed.kind === 'error') {
      throw new Error(`Invalid profile id: ${parsed.message}`);
    }

    let version: ProfileVersion | undefined = undefined;
    if (parsed.value.version) {
      if (!parsed.value.version.minor) {
        throw new Error(
          `Invalid profile id: ${profileId} - minor version is required`
        );
      }

      if (!parsed.value.version.patch) {
        throw new Error(
          `Invalid profile id: ${profileId} - patch version is required`
        );
      }

      version = ProfileVersion.fromParameters({
        major: parsed.value.version.major,
        minor: parsed.value.version.minor,
        patch: parsed.value.version.patch,
        label: parsed.value.version.label,
      });
    }

    return ProfileId.fromScopeName(
      parsed.value.scope,
      version,
      parsed.value.name
    );
  }

  public static fromScopeName(
    scope: string | undefined,
    version: ProfileVersion | undefined,
    name: string
  ): ProfileId {
    return new ProfileId(scope, version, name);
  }

  private constructor(
    public readonly scope: string | undefined,
    public readonly version: ProfileVersion | undefined,
    public readonly name: string
  ) {}

  /**
   * Returns profile id without version
   */
  get withoutVersion(): string {
    return this.scope ? `${this.scope}/${this.name}` : this.name;
  }

  /**
   * Stringified profile id with version if version is defined
   * @returns stringified profile id
   */
  toString(): string {
    if (this.version) {
      return this.withoutVersion + `@${this.version.toString() || ''}`;
    }

    return this.withoutVersion;
  }
}
