# Lexer

Lexes superface language into tokens.

## Separators

Separators are delimiters that usually come in pairs. Defined separators are:

- `SOF` and `EOF` - pseudo delimiters, these don't exist in code
- `(` and `)`
- `[` and `]`
- `{` and `}`

`SOF` and `EOF` separators are always produced at the beginning and end of the source respectively. The `SOF` is always produced exactly once. The `EOF` is produced forever (or in case of the generator interface exacly once).

_Note: that these separators are still produced separately and may be treated the same way as operators._

## Operators

Operators operate on arguments (usually identifiers or literals). Defined operators are:

- `:` - type assignment
- `=` - value assignment
- `!` - non-null type operator and required field operator
- `|` - type union operator
- `@` - decorator operator
- `,` - comma operator (used as delimiter and terminal character)
- `.` - dot operator (used as delimiter)
- `;` - semicolon operator (used as delimiter and terminal character)

## Literals

Literals are instances of values existing inside the source code itself. Defined literals are:

- `true` and `false`
- `0b[0-9]+`, `0o[0-9]+`, `[0-9]+`, `0x[0-9]+` - integer numbers
- `[0-9]+.[0-9]+` - float numbers

_Note: There is no distinction between integers and floats in javascript, so the lexer does not store the information whether the literal was an integer or a float._

### String literals

String literals are a bit special. During lexing, string literals and doc comments are treated the same, since they share syntax.

String literals support single (`'`) and double quotes (`"`) and can be single- or tripe-quoted (`'''` or `"""`). String literals support almost all raw characters inside them and support basic escape characters (`\n, \r, \t, \\, \', \"`).

Triple quoted string literals are always parser with leading indentation and predecing and following blank lines stripped.

## Identifiers

Identifiers are user-defined names. Allowed identifiers have format: `[_a-zA-Z][_a-zA-Z0-9]*`. Keywords are also parsed as identifiers, since all keywords are soft/scoped.

## Comments

Comments are values with no semantical meaning to the language. Line comments are supported with starting char `#`.

_Node: By default, comment tokens are filtered. This can be configured using the lexer token kind filter._

## Newlines

The lexer produces newline tokens for each `\n` newline encountered in the input.

_Note: By default, newline tokens are filtered. This can be configured using the lexer token kind filter._

## Jessie script

Jessie script tokens are generated when the lexer context is set to `JESSIE_SCRIPT_EXPRESSION`. In this context, the Jessie sublexer uses the Typescript scanner and counts the number of opening and closing braces (`{}`), brackets (`[]`) and parens (`()`).

The context also specifies termination characters. When any of the termination character is encountered in the Typescript token stream in the topmost level (when all three bracket counts are zero) the scanning process is stopped and the span of the scanned tokens is diagnosed by the Typescript compiler in a specific context requiring an expression. If the diagnostic passes without errors and the script is validated and transpiled successfully a jessie script expression token is returned.

_Note: The termination character is not consumed by the token._

_Note: The lexer uses the `DEFAULT` context by default which doesn't produce these tokens._
