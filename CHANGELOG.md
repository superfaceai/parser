# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Http call can now select service id, e.g. `http VERB "id" "url" {`
- `ExampleValidator` class to validate examples defined in profile usecase
- `validateExamples` function similar to `validateMap` for using `ExampleValidator`

### Changed
- `ErrorContext` field `path` to object containing location span and node kind
- Formatting of validation issues into more intuitive way
- Validation issues `inputNotFound`, `resultNotFound` and `errorNotFound` merged into `useCaseSlotNotFound`
- Validation issues `resultNotDefined` and `errorNotDefined` merged into `outcomeNotDefined`

### Fixed
- Handling variables that are written with dot notation, e.g. `output.is.nested = true`
- Remove unnecessary linting of input in HTTP Request node
- Validate arguments in inline call only against input
- Unwrap non null structure in validation of nested properties
- Remove limited validation of binary expressions and let other constructs handle them
- Propagation of validation issues on top of issues from jessie expression nodes 
- `SyntaxRuleNever` causing a wrong error message

## [1.0.0] - 2021-11-04
### Added
- `ProfileVersion` class representing version of profile in ProfileId
- `ProfileId` class representing complete id of profile
- `MapVersion` class representing version of map in MapId
- `MapId` class representing complete id of map

### Changed
- **BREAKING CHANGE:** `ProfileDocumentId` renamed to `ProfileIdRange`
- **BREAKING CHANGE:** `DocumentVersion` renamed to `VersionRange`
- **BREAKING CHANGE:** `parseVersionNumber` renamed to `tryParseVersionNumber`
- **BREAKING CHANGE:** removed `isValidDocumentIdentifier` started using `isValidDocumentName` from AST
- **BREAKING CHANGE:** removed `splitLimit` strated using `splitLimit` from AST

## [0.0.23] - 2021-10-18
### Added
- Profile example parsing
- Comlink literals

### Changed
- Updated to AST `0.0.34` (has BREAKING CHANGES)

## [0.0.22] - 2021-09-22
### Changed
- Updated ast dependecy to `0.0.29`

## [0.0.21] - 2021-08-25
### Added
- Extracted `formatIssueContext` function

### Fixed
- Fixed referencing variables in jessie expressions

## [0.0.20] - 2021-08-03

## [0.0.19] - 2021-07-14

## [0.0.18] - 2021-06-08
### Added
- Added an explicit hint to ShorthandPropertyAssignment Jessie construct error

### Changed
- Changed how MatchAttemts merge works to preserve expected behavior

### Fixed
- Fixed Jessie errors (and other lexer errors) not reporting correct location

## [0.0.17] - 2021-05-04
### Added
- Added support for returning multiple errors from Lexer parsing

### Changed
- Changed internal handling of persing errors and result types
- Better generics for Lexer interface

### Fixed
- Fixed template string RHS parsing
- Fixed jessie transpilation when polyfill is generated

## [0.0.16] - 2021-04-26
### Added
- Automatic feature parsing from environment variables

### Changed
- Renamed `checkKeywordLiteral` to `tryKeywordLiteral`
- Removed unused `countStartingWithNewlines`

### Fixed
- Fixed error produced by `countStartingNumbersRadix` to use string template

## [0.0.15] - 2021-03-23
### Added
- VERSION constant export
- `multiple_security_requirements` parser feature

### Changed
- Map security requirements syntax

## [0.0.14] - 2021-02-04
### Added
- `call foreach` map rule

### Changed
- Map validator uses `MapAstVisitor` from ast package
- Profile io validator uses `ProfileAstVisitor` from ast package
- Map security requirements syntax
- Updated ast dependency to `v0.0.22`

### Fixed
- Allow enum inside list in Profile IO Analyzer
- Map validator version error reporting with new version nodes

## [0.0.11] - 2021-01-19
### Added
- Public `parseDocumentId` for partial parsing

### Changed
- Interfaces for map and profile id
- Improved document id version parsing
- Rename `isLowercaseIdentifier` to `isValidDocumentIdentifier`

### Fixed
- Document id `parseProfileId` not returning version label

## [0.0.11] - 2021-01-19
### Added
- Profile IO Analyzer that generates profile structure
- Map Validator for validating profile input/output components
- Interface for using Profile IO Analyzer and Map Validator
- Interface for composing error and warning messages
- Profile structure interfaces
- Profile structure utils
- ValidationIssue interface

## [0.0.10] - 2021-01-11
### Changed
- Exported `parseVersion`, `parseProfileId` and `parseMapId` publicly
- Changed ast dependency to `v0.0.20`

### Fixed
- Fixed `ID_NAME_RE` to not accept leading `_` or `-`

## [0.0.9] - 2021-01-09
### Fixed
- Fixed the weird behavior of `String.prototype.split(string, number)` by implementing a custom `splitLimit` function.

## [0.0.8] - 2021-01-09
### Fixed
- Fixed semver parsing allowing invalid version strings like `1.x1`

## [0.0.7] - 2021-01-09
### Added
- Document id and version parsing implementation
- Profile `version` header field
- Map `variant` header field

### Changed
- Refactored `computeEndLocation` to be externally reusable
- Profile `profile = <string>` syntax to `name = '[<scope>/]<name>`
- Map `profile = <string>` syntax to `profile = [<scope>/]<name>@<version>`
- Moved test files from `examples` folder to `fixtures` folder

### Fixed
- Some typos in comments and descriptions

## [0.0.6] - 2020-11-30
### Changed
- Package renamed from `superface-parser` to `parser`

## [0.0.5] - 2020-11-25
### Added
- `none` security scheme for http call
- Inline call support in maps
- `SyntaxError` category
- `LexerContext` to communicate context from parser to the lexer
- `LexerTokenStream` with native save and rollback
- Lexer unknown token
- Jessie expression lexer context terminator characters
- Newline lexer token and parser rules
- Parser features (`nested_object_literals` and `shorthand_http_request_slots`)
- Map parser rules
- `PeekUnknown` and `AndThen` syntax rules
- Simple build option that skips parcel because of bugs with the produced artifacts

### Changed
- Scope renamed from `@superindustries` to `@superfaceai`
- Updated dependency versions
- Updated typescript to version 4+ and using new features
- Line comment token from `#` to `//`

### Removed
- `+` and `-` operators

### Fixed
- Jessie expression lexer context handling string templates
- Lexer parsing numbers with `+` and `-` prefixes

## [0.0.3] - 2020-08-26
### Removed
- Dependency on superface sdk

## 0.0.2 - 2020-08-25
### Added
- Parcel build system

### Changed
- Documentation extraction from doc strings
- Usecase result parsing as optional

[Unreleased]: https://github.com/superfaceai/parser/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/superfaceai/parser/compare/v0.0.23...v1.0.0
[0.0.23]: https://github.com/superfaceai/parser/compare/v0.0.22...v0.0.23
[0.0.22]: https://github.com/superfaceai/parser/compare/v0.0.21...v0.0.22
[0.0.21]: https://github.com/superfaceai/parser/compare/v0.0.20...v0.0.21
[0.0.20]: https://github.com/superfaceai/parser/compare/v0.0.19...v0.0.20
[0.0.19]: https://github.com/superfaceai/parser/compare/v0.0.18...v0.0.19
[0.0.18]: https://github.com/superfaceai/parser/compare/v0.0.17...v0.0.18
[0.0.17]: https://github.com/superfaceai/parser/compare/v0.0.16...v0.0.17
[0.0.16]: https://github.com/superfaceai/parser/compare/v0.0.15...v0.0.16
[0.0.15]: https://github.com/superfaceai/parser/compare/v0.0.14...v0.0.15
[0.0.14]: https://github.com/superfaceai/parser/compare/v0.0.11...v0.0.14
[0.0.11]: https://github.com/superfaceai/parser/compare/v0.0.11...v0.0.11
[0.0.11]: https://github.com/superfaceai/parser/compare/v0.0.10...v0.0.11
[0.0.10]: https://github.com/superfaceai/parser/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/superfaceai/parser/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/superfaceai/parser/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/superfaceai/parser/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/superfaceai/parser/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/superfaceai/parser/compare/v0.0.3...v0.0.5
[0.0.3]: https://github.com/superfaceai/parser/compare/v0.0.2...v0.0.3
