import { readFile } from 'fs/promises';
import { join as joinPath } from 'path';

import { Source } from '../common';
import { parseMap } from '../language'
import { MapUnparser } from './map';

async function readFixture(name: string): Promise<string> {
  return readFile(joinPath('fixtures', 'unparse', name), { encoding: 'utf-8' });
}

describe('map unparser', () => {
  it.each(
    [
      ['social-media.publish-post.pinterest.suma'],
      ['full-example.suma']
    ]
  )('map %s', async (name) => {
    const map = await readFixture(name);
    const ast = parseMap(new Source(map));

    const unparser = new MapUnparser(ast);
    const result = unparser.unparse();

    // expect(result).toBe(map);
    expect(result).toMatchSnapshot();
  });  
});
