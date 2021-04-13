# Parser

![superface logo](https://github.com/superfaceai/parser/blob/master/docs/LogoGreen.svg)

Superface Parser compiles Superface profiles and maps into representation that can be interpreter using the Superface SDK.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Development](#development)
- [Support](#support)
- [Publishing](#publishing)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Install

To install this package, first add the github superface repository to your npm config. Use your github name as your login and generate a personal access token with at least the `repo` and `read:packages` permissions in Github to use as password:

```shell
npm login --scope=@superfaceai --registry=https://npm.pkg.github.com
```

Then install the parser into one of your projects:

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

## Support

If you need any additional support, have any questions or you just want to talk you can do that through our [documentation page](https://developer.superface.dev). 

## Publishing

Package publishing is done through GitHub release functionality.

[Draft a new release](https://github.com/superfaceai/parser/releases/new) to publish a new version of the package.

Use semver for the version tag. It must be in format of `v<major>.<minor>.<patch>`.

Github Actions workflow will pick up the release and publish it as one of the [packages](https://github.com/superfaceai/parser/packages).

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
- UNLICENSED

Note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

The Superface Parser is licensed under the [MIT](LICENSE).
© 2021 Superface
