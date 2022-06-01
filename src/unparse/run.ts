import { MapASTNode } from '@superfaceai/ast';
import fs from 'fs';

import { Source } from '../common';
import { parseMap, parseProfile } from '../language';
import { DEFAULT_MAP_UNPARSER_CONFIGURATION } from './map/configuration';
import { MapUnparser } from './map/visitor';

type InputType = 'map' | 'profile';

function nope(): never {
  console.error(
    'Usage: unparse map|profile --json|--eval|--source --stdin|FILE'
  );
  process.exit(1);
}

function readStdin(): string {
  const value = fs.readFileSync(0).toString();

  if (value.trim() == '') {
    console.error('Invalid stdin input');

    return nope();
  }

  return value;
}
function readFile(path: string): string {
  if (path === undefined || path.trim() === '') {
    console.error('Invalid file input');

    return nope();
  }

  return fs.readFileSync(path).toString();
}
function readInput(): string {
  const arg = process.argv[4];
  switch (arg) {
    case undefined:
      return nope();

    case '--stdin':
    case '-':
      return readStdin();

    default:
      return readFile(arg);
  }
}

function parseInputType(): InputType {
  const arg = process.argv[2];
  switch (arg) {
    case 'map':
    case 'm':
      return 'map';

    case 'profile':
    case 'p':
      return 'profile';

    default:
      nope();
  }
}

function parseInput(input: string, inputType: InputType): unknown {
  const arg = process.argv[3];
  switch (arg) {
    case '--eval':
    case '-e':
      return eval(input);

    case '--json':
    case '-j':
      return JSON.parse(input);

    case '--source':
    case '-s':
      if (inputType === 'profile') {
        return parseProfile(new Source(input));
      } else {
        return parseMap(new Source(input));
      }

    default:
      nope();
  }
}

function unparseInput(input: unknown, inputType: InputType): string {
  if (inputType === 'profile') {
    throw 'TODO';
  } else {
    return new MapUnparser(DEFAULT_MAP_UNPARSER_CONFIGURATION).unparse(
      input as MapASTNode
    );
  }
}

const inputType = parseInputType();
const input = readInput();
const parsed = parseInput(input, inputType);
const unparsed = unparseInput(parsed, inputType);
console.log(unparsed);
