import { inspect } from 'util';

import { parse } from '.';

describe('Interpreter', () => {
  it('interprets strings', () => {
    const slang = 'this is a id sequence: "brrr brr"';
    const ast = parse(slang, { noLocation: true });

    console.log(slang, '\n', inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  fit('interprets other strings', () => {
    const slang = `profile {
      foo: "bar"
    }`;
    const ast = parse(slang, { noLocation: true });

    console.log(slang, '\n', inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('interprets numbers', () => {
    const ast = parse('this: 12', { noLocation: false });

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('interprets booleans', () => {
    const ast = parse('this: true', { noLocation: false });

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('parses ids', () => {
    const ast = parse('this is a id sequence: 2', { noLocation: false });

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('literals: integer number', () => {
    const ast = parse('this: 2', { noLocation: false });

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('literals: real number', () => {
    const ast = parse('this: 2.45', { noLocation: false });

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('strings', () => {
    const ast = parse('this: "2.45"', { noLocation: false });

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('booleans: true', () => {
    const ast = parse('truthy: true', { noLocation: false });

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('empty', () => {
    const ast = parse('some dict {}', { noLocation: false });

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('with statements', () => {
    const ast = parse(
      `some dict {
      with inner: 5
      and nested dict {
        foo: "bar"
      }
    }`,
      { noLocation: false }
    );

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('arrays - empty', () => {
    const ast = parse('arr: []', { noLocation: true });

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('arrays - simple', () => {
    const ast = parse('arr: [1, 2, "bar"]');

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('arrays - nested', () => {
    const ast = parse('arr: [1, 2, [], 5]');

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('multiple statements', () => {
    const ast = parse(
      `truthy: true
      falsy: false`
    );

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });

  it('array', () => {
    const ast = parse(`foo: [1, "Bar", []]`);

    console.log(inspect(ast, false, 10));
    expect(true).toBe(true);
  });
});
