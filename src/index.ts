import packageJson from '../package.json';

export * from './errors';
export * from './language';
export * from './interpreter';
export * from './common';

export const VERSION = packageJson.version;