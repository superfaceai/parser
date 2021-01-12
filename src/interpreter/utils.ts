import { ProfileDocumentNode } from '@superfaceai/ast';

import { ProfileIOAnalyzer } from './profile-io-analyzer';
import { ProfileOutput } from './profile-output';

export const getProfileOutput = (
  profile: ProfileDocumentNode
): ProfileOutput => {
  const analyzer = new ProfileIOAnalyzer();

  return analyzer.visit(profile);
};
