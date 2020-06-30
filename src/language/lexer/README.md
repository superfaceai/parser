# Lexer

Lexes profile language into tokens.

## Separators

Separators are delimiters that come in pairs. Defined separators are:

- `SOF` and `EOF` - pseudo delimiters, these don't exist in code
- `(` and `)`
- `[` and `]`
- `{` and `}`

## Operators

Operators operate on arguments (usually identifiers or literals). Defined operators are:

- `:` - assignment
- `!` - non-null assertion
- `+` and `-`

## Literals

Literals are instances of values existing inside the source code itself. Defined literals are:

- `true` and `false`
- `0b[0-9]+`, `0o[0-9]+`, `[0-9]+`, `0x[0-9]+` - integer numbers
- `[0-9]+.[0-9]+` - float numbers

_Note: There is no distinction between integers and floats in javascript, so the lexer does not store the information whether the literal was an integer or a float._

### String literals

String literals a bit special. During lexing, string literals and doc comments are treated the same, since they share syntax.

String literals support single (`'`) and double quotes (`"`). Inside these quotes, only a limited set of characters is supported, others must be escaped. Additionally, literals can be triple-quoted (`'''` or `"""`). These literals allow all characters (except for other triple quotes) inside, but do not allow escaping.

## Decorators

Decorators, or alternatively attributes, are keyword-like values prefixed with `@`. Defined decorators are:

- `@safe`
- `@unsafe`
- `@idempotent`

It is possible to merge these with keywords, but it might make semantical analysis a little bit easier later on.

## Keywords

Keywords are identifiers specially defined in the language. Defined keywords are:

- `usecase` and `model`
- `input`, `result` and `async`
- `field`
- `Number`, `String`, `Boolean` and `Enum`

## Identifier

Identifiers are user-defined names. Allowed identifiers have format: `[_a-zA-Z]+`

## Comments

Comments are values with no semantical meaning to the language. Line comments are supported with starting char `#`.
