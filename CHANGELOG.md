## [Unreleased]

### Changed
* Refactored `computeEndLocation` to be externally reusable

## [0.0.6] - 2020-11-30

### Changed
* Package renamed from `superface-parser` to `parser`

## [0.0.5] - 2020-11-25

### Added
* `none` security scheme for http call
* Inline call support in maps

### Changed
* Scope renamed from `@superindustries` to `@superfaceai`

## [v0.0.4-beta3] - 2020-10-26

### Added
* `SyntaxError` category
* `LexerContext` to communicate context from parser to the lexer
* `LexerTokenStream` with native save and rollback
* Lexer unknown token
* Jessie expression lexer context terminator characters
* Newline lexer token and parser rules
* Parser features (`nested_object_literals` and `shorthand_http_request_slots`)
* Map parser rules
* `PeekUnknown` and `AndThen` syntax rules
* Simple build option that skips parcel because of bugs with the produced artifacts

### Changed
* Updated dependency versions
* Updated typescript to version 4+ and using new features
* Line comment token from `#` to `//`

### Removed
* `+` and `-` operators

### Fixed
* Jessie expression lexer context handling string templates
* Lexer parsing numbers with `+` and `-` prefixes

## [0.0.3] - 2020-08-26

### Removed
* Dependency on superface sdk

## [0.0.2] - 2020-08-25

### Added
* Parcel build system

### Changed
* Documentation extraction from doc strings
* Usecase result parsing as optional

[Unreleased]: https://github.com/superfaceai/parser/compare/v0.0.6...HEAD
[0.0.6]: https://github.com/superfaceai/parser/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/superfaceai/parser/compare/v0.0.4-beta3...v0.0.5
[v0.0.4-beta3]: https://github.com/superfaceai/parser/compare/v0.0.3...v0.0.4-beta3
[0.0.3]: https://github.com/superfaceai/parser/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/superfaceai/parser/releases/tag/v0.0.2
