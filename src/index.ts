import { parseEnvFeatures } from './language';

export * from './errors';
export * from './language';
export * from './interpreter';
export * from './common';
export { VERSION, PARSED_VERSION, PARSED_AST_VERSION } from './metadata';

// Parse env features here, globally
parseEnvFeatures();
