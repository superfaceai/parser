import * as st from './transpiler';

test('transpiler basics', () => {
  const { output, sourceMap } = st.transpileScript(
    `let a = { hello: 1, world: 2 + "3" }
console.log(a)`
  );

  expect(output).toBe(
    `var a = { hello: 1, world: 2 + "3" };
console.log(a);`
  );

  expect(sourceMap).toBe(
    'AAAA,IAAI,CAAC,GAAG,EAAE,KAAK,EAAE,CAAC,EAAE,KAAK,EAAE,CAAC,GAAG,GAAG,EAAE,CAAA;AACpC,OAAO,CAAC,GAAG,CAAC,CAAC,CAAC,CAAA'
  );
});

test('transpiler ES2020', () => {
  const { output, sourceMap } = st.transpileScript(
    `let nullishCoalescing = undefined ?? (false ?? "truthy")
		const optionalChaining = console?.log?.(nullishCoalescing)`
  );

  expect(output).toMatch('var nullishCoalescing =');
  expect(output).toMatch('var optionalChaining =');
  expect(output).toMatch(
    'undefined !== null && undefined !== void 0 ? undefined'
  );
  expect(output).toMatch(
    'console === null || console === void 0 ? void 0 : console.log'
  );

  expect(sourceMap).toMatch(
    /[;,]?([a-zA-Z_+]|[a-zA-Z_+]{4}|[a-zA-Z_+]{5})([;,]([a-zA-Z_+]|[a-zA-Z_+]{4}|[a-zA-Z_+]{5}))*/
  );
});
