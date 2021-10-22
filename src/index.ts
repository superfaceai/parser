import { parseEnvFeatures } from './language';

export * from './errors';
export * from './language';
export * from './interpreter';
export * from './common';
export * from './metadata';

// Parse env features here, globally
parseEnvFeatures();
