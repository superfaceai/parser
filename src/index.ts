import { parseEnvFeatures } from './language';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-var-requires
const packageJson = require('../package.json');

export * from './errors';
export * from './language';
export * from './interpreter';
export * from './common';

// Parse env features here, globally
parseEnvFeatures();

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
export const VERSION: string = packageJson.version;
