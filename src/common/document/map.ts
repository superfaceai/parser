import { DocumentVersion } from '.';

/**
 * Class representing map id
 */
export class MapId {
  public readonly profile: { scope?: string; name: string; id: string };
  //TODO: do we want to update DocumentVersion to something similar to ProfileVersion class? It would problably decrease the confucion
  //TODO: do we want to have something similar even for MapVersion
  //In map id version has to contain major and minor property, others are optional
  public readonly version: DocumentVersion & { minor: number };
  public readonly provider: string;
  public readonly variant?: string;

  //TODO: fromId

  public static fromParameters(params: {
    profile: {
      name: string;
      scope?: string;
    };
    version: DocumentVersion & { minor: number };
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
    version: DocumentVersion & { minor: number },
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
    version += this.version.patch ? `.${this.version.patch}` : '';
    version += this.version.label ? `-${this.version.label}` : '';

    return id + `@${version}`;
  }
}
