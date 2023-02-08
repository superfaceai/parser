# Parser

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/superfaceai/parser/main.yml)](https://github.com/superfaceai/parser/actions/workflows/main.yml)
![NPM](https://img.shields.io/npm/v/@superfaceai/parser)
[![NPM](https://img.shields.io/npm/l/@superfaceai/parser)](LICENSE)
![TypeScript](https://img.shields.io/badge/%3C%2F%3E-Typescript-blue)

<img src="https://github.com/superfaceai/parser/blob/main/docs/LogoGreen.png" alt="superface logo" width="150" height="150">

Superface Parser compiles Superface profiles and maps into representation that can be interpreter using the Superface SDK.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Security](#security)
- [Support](#support)
- [Development](#development)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Background

Superface (super-interface) is a higher-order API, an abstraction on top of the modern APIs like GraphQL and REST. Superface is one interface to discover, connect, and query any capabilities available via conventional APIs. 

Through its focus on application-level semantics, Superface decouples the clients from servers, enabling fully autonomous evolution. As such it minimizes the code base as well as errors and downtimes while providing unmatched resiliency and redundancy. 

Superface allows for switching capability providers without development at a runtime in milliseconds. Furthermore, Superface decentralizes the composition and aggregation, and thus creates an Autonomous Integration Mesh.

Motivation behind Superface is nicely described in this [video](https://www.youtube.com/watch?v=BCvq3NXFb94) from APIdays conference.

You can get more information at https://superface.ai and https://superface.ai/docs.
 
## Install

Install the parser into one of your projects:

```shell
yarn add @superfaceai/parser
```

## Usage

```ts
const { basename } = require('path');
const { readFileSync } = require('fs');
const { inspect } = require('util');
const { Source, parseProfile } = require('@superfaceai/parser');

const path = process.argv[2];
const content = readFileSync(path, 'utf-8');
const source = new Source(content, basename(path));
const result = parseProfile(source);

console.log(inspect(result));
```

## Security

Superface is not man-in-the-middle so it does not require any access to secrets that are needed to communicate with provider API. Superface CLI only prepares super.json file with authorization fields in form of environment variable. You just set correct variables and communicate directly with provider API.

You can find more information in [SDK repository](https://github.com/superfaceai/one-sdk-js/blob/main/SECURITY.md).

## Support

If you need any additional support, have any questions or you just want to talk you can do that through our [documentation page](https://docs.superface.ai). 

## Development

When developing, start with cloning the repository using `git clone https://github.com/superfaceai/parser.git` (or `git clone git@github.com:superfaceai/parser.git` if you have repository access).

After cloning, the dependencies must be downloaded using `yarn install` or `npm install`.

Now the repository is ready for code changes.

The `package.json` also contains scripts (runnable by calling `yarn <script-name>` or `npm run <script-name>`):
- `test` - run all tests
- `lint` - lint the code (use `lint:fix` to run autofix)
- `format` - check the code formatting (use `format:fix` to autoformat)
- `prepush` - run `test`, `lint` and `format` checks. This should run without errors before you push anything to git.

Lastly, to build a local artifact run `yarn build` or `npm run build`.

## Maintainers

- [@Lukáš Valenta](https://github.com/lukas-valenta)
- [@Edward](https://github.com/TheEdward162)

## Contributing

**Please open an issue first if you want to make larger changes**

Feel free to contribute! Please follow the [Contribution Guide](CONTRIBUTION_GUIDE.md).

## Licensing

Licenses of `node_modules` are checked during push CI/CD for every commit. Only the following licenses are allowed:

- 0BDS
- MIT
- Apache-2.0
- ISC
- BSD-3-Clause
- BSD-2-Clause
- CC-BY-4.0
- CC-BY-3.0;BSD
- CC0-1.0
- Unlicense

Note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

The Superface Parser is licensed under the [MIT](LICENSE).
© 2021 Superface
