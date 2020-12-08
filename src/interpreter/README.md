# **Profile Map Validator**

## **Description**

Profile Map Validator validates maps against certain profile. It consists of the `ProfileValidator` which takes a profile AST as an input and generates its structure as an output. It also consists of the `MapValidator` that takes profile structure from the `ProfileValidator` and map AST as an input and validates the usecase main components (`input`, `result` and `error`) against a map.

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
