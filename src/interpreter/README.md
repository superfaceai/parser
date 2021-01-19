# **Profile Map Validator**

## **Description**

Profile Map Validator validates maps against certain profile. It consists of the `Profile IO Analyzer` which takes a profile AST as an input and generates its structure as an output. It also consists of the `MapValidator` that takes profile structure from the `Profile IO Analyzer` and map AST as an input and validates the usecase main components (`input`, `result` and `error`) against a map.

### **What jessie can it validate?**

- primitive literals, such as numbers, strings and booleans
- null - `map result null`
- binary expressions - `map result a + b`
- identifiers - `map result a`
- property access expressions - `map result a.b`
- element access expressions - `map result a['b']`
- object expressions - `map result { a: 1, b: 2 }`
- array expressions - `map result [a, b, 3]`

## **Usage**

1. **Internal use**

   [`getProfileOutput`](./utils.ts#L279)

   - takes profile AST as input and returns a `ProfileOutput`

   [`validateMap`](./utils.ts#L287)

   - takes `ProfileOutput` and map AST as input and returns a `ValidationResult` that contains errors and warnings.

2. [**Superface CLI**](https://github.com/superfaceai/cli)\
   `superface lint` command with flag `-v`
   ```bash
   superface lint -v profile.supr map1.suma map2.suma
   ```
