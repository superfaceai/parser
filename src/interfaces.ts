import { MappingAST, ParsedProfile, Result } from '@superindustries/superface';

import { MapValidationError } from './errors';

export interface ProfileParser {
  parse(profileId: string): ParsedProfile;
}

export interface MappingParser {
  parse(map: string): MappingAST;
}

export interface MapValidator {
  validate(map: string): Result<string, MapValidationError>;
}
