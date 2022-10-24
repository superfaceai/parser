import { readFile } from 'fs/promises';
import { join as joinPath } from 'path';

import { Source } from '../../common';
import { parseMap } from '../../language';
import { DEFAULT_MAP_UNPARSER_CONFIGURATION } from './configuration';
import { MapUnparser } from './visitor';

async function readFixture(name: string): Promise<string> {
  return readFile(joinPath('fixtures', 'unparse', name), { encoding: 'utf-8' });
}

describe('map unparser', () => {
  it.each([
    ['social-media.publish-post.pinterest.suma'],
    ['full-example.suma'],
  ])('map %s', async name => {
    const map = await readFixture(name);
    const ast = parseMap(new Source(map));

    const unparser = new MapUnparser(DEFAULT_MAP_UNPARSER_CONFIGURATION);
    const result = unparser.unparse(ast);

    // expect(result).toBe(map); // use for debugging, should be only whitespace and implicit default parameter differences (as per style settings)
    expect(result).toMatchSnapshot();
  });
});
