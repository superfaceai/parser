import * as st from './ScriptTranspiler';

test('transpiler debug', () => {
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
		let optionalChaining = console?.log?.(nullishCoalescing)`
  );

  expect(output).toBe(
    `var _a, _b;
var nullishCoalescing = undefined !== null && undefined !== void 0 ? undefined : ((_a = false) !== null && _a !== void 0 ? _a : "truthy");
var optionalChaining = (_b = console === null || console === void 0 ? void 0 : console.log) === null || _b === void 0 ? void 0 : _b.call(console, nullishCoalescing);`
  );

  expect(sourceMap).toBe(
    ';AAAA,IAAI,iBAAiB,GAAG,SAAS,aAAT,SAAS,cAAT,SAAS,GAAI,OAAC,KAAK,mCAAI,QAAQ,CAAC,CAAA;AACtD,IAAI,gBAAgB,SAAG,OAAO,aAAP,OAAO,uBAAP,OAAO,CAAE,GAAG,+CAAZ,OAAO,EAAQ,iBAAiB,CAAC,CAAA'
  );
});
