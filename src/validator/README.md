### Validator

Jessie-like script validator

The script is parsed using typescript compiler, then the AST is validated against whitelisted syntax nodes.

Explicitly allowed nodes are:

#### Literals

- numbers: `1`, `-1`
- strings: `"hi"`
- `true`, `false`
- `null`, `undefined`
- arrays: `[1, 2, 3]`
- objects: `{ x: 1, y: 2, z: "foo" }`

#### Variable declarations and assignment operators

- `const`
- `let`
- `+=`, `-=`
- `*=`, `/=`
- postfix `++` and `--`

#### Arithmetic operators

- `+`, `-`
- `/`, `*`
- `%`, `**`

#### Bitwise operators

- `&`, `|`
- `^`, `~`
- `>>`, `>>>`, `<<`

#### Comparison operators

- `<`, `>`
- `<=`, `>=`
- `===`, `!==`

#### Destructuring

- objects: `const { x, y, z } = { x: 1, y: 2, z: "foo" }`
- arrays: `const [a, b, c] = [1, 2, "foo"]`

#### Spreading

- objects: `const a = [1, 2, 3]`
- arrays: `const b = [...a, 4, 5]`

#### Functions

- arrow: `const foo = (x) => { return x; }`
- rest parameter: `const foo = (...xs) => { return xs.length; }`

#### Template strings

- `` (x, y) => `${x} and ${y}` ``

#### Loops

- for/of: `for (let x of a) {}`
- for: `for (let i = 0; i < a.length; i++) {}`
- while: `while (true) { break; }`
- do: `do {} while (false);`
- labels: `label: while (true) { break label; }`
- `break`, `continue`

#### Conditionals

- if/else: `if (true) {} else {}`
- switch/case: `switch (1) { case 1: break; case 2: break; default: break; }`
- ternaty: `(true || false) ? 1 : 2`
