# Lexer

Lexes profile language into tokens.

## Separators

Separators are delimiters that come in pairs. Defined separators are:

- `SOF` and `EOF`
- `(` and `)`
- `[` and `]`
- `{` and `}`

## Operators

Operators operate on arguments (usually identifiers or literals). Defined operators are:

- `:` - assignment
- `+` and `-`

## Literals

Literals are instances of values existing inside the source code itself. Defined literals are:

- `true` and `false`
- `0b[0-9]+`, `0o[0-9]+`, `[0-9]+`, `0x[0-9]+` - integer numbers
- `[0-9]+.[0-9]+` - float numbers
- `"[^"]"` - string literals

_Note: There is no distinction between integers and floats in javascript, so the lexer does not store the information whether the literal was an integer or a float._

## Decorators

Decorators, or alternatively attributes, are keyword-like values prefixed with `@`. Defined decorators are:

- `@safe`
- `@unsafe`
- `@idempotent`

It is possible to merge these with keywords, but it might make semantical analysis a little bit easier later on.

## Keywords

Keywords are identifiers specially defined in the language. Defined keywords are:

- `usecase`
- `field`
- `map`
- `Number`, `String` and `Boolean`

## Identifier

Identifiers are user-defined names. Allowed identifiers have format: `[_a-zA-Z]+`

## Doc

Doc strings provide a way to attach programmer documentation to language concepts.

Doc strings are currently matched by taking as many doc string characters (`'`) as possible at a given position and then treating everything following as doc string until a matching number of doc strings characters is found.

Another possibility is to only treat only `'` and `'''` as doc string delimiters.

## Comments

Comments are values with no semantical meaning to the language. Line comments are supported with starting char `#`.
