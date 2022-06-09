import { UnparserTokenGroup, UnparserTreeMaterializer } from '../common/tree';
import {
  MapUnparserConfiguration,
  transformMapUnparserConfiguration,
} from './configuration';
import { UnparserTokenMap as UnparserToken } from './tree';

type TestParams = {
  name: string;
  tree: UnparserTokenGroup;
  configuration?: Partial<MapUnparserConfiguration>;
  expected: string;
};
describe('unparser tree', () => {
  const DEFAULT_CONFIGURATION: MapUnparserConfiguration = {
    indentString: ' ',
    trailingTerminators: false,
    setBlockStyle: 'collapsed',
    callBlockStyle: 'collapsed',
    objectBlockStyle: 'collapsed',
    httpCallDefaultSecurity: 'always',
    httpCallDefaultService: 'always',
  };

  it.each<TestParams>([
    {
      name: 'simple test, spacedTokens factory',
      tree: UnparserToken.withSpaces(
        'profile',
        '=',
        undefined,
        '"foo/bar@1.0"',
        [
          UnparserToken.newline(),
          UnparserToken.atom('set'),
          UnparserToken.atom('!'),
        ]
      ),
      expected: 'profile = "foo/bar@1.0" \nset!',
    },
    {
      name: 'set block collapsed',
      tree: [
        UnparserToken.atom('set'),
        UnparserToken.space(),
        UnparserToken.setBlock(
          UnparserToken.withSpaces('foo', '=', '1'),
          UnparserToken.withSpaces('bar', '=', '2')
        ),
        UnparserToken.newline(),
      ],
      expected: 'set { foo = 1; bar = 2 }\n',
    },
    {
      name: 'set block expanded, nested',
      tree: [
        UnparserToken.atom('set'),
        UnparserToken.space(),
        UnparserToken.setBlock(
          UnparserToken.withSpaces('foo', '=', '1'),
          UnparserToken.withSpaces('bar', '=', '2'),
          [UnparserToken.setBlock(UnparserToken.withSpaces('baz', '=', '3'))]
        ),
        UnparserToken.newline(),
      ],
      configuration: {
        setBlockStyle: 'expanded',
      },
      expected: 'set {\n foo = 1\n bar = 2\n {\n  baz = 3\n }\n}\n',
    },
    {
      name: 'set block expanded+semicolons, trailing, different indent string',
      tree: [
        UnparserToken.atom('set'),
        UnparserToken.setBlock(
          UnparserToken.withSpaces('foo', '=', '1'),
          UnparserToken.withSpaces('bar', '=', '2')
        ),
      ],
      configuration: {
        indentString: '_',
        setBlockStyle: 'expanded+semicolons',
        trailingTerminators: true,
      },
      expected: 'set{\n_foo = 1;\n_bar = 2;\n}',
    },
    {
      name: 'statement block',
      tree: UnparserToken.withSpaces(
        'map',
        'Foo',
        UnparserToken.statementBlock(
          UnparserToken.withSpaces('foo', '=', '1'),
          UnparserToken.withSpaces('bar."baz-1"', '=', '2')
        )
      ),
      expected: 'map Foo {\n foo = 1\n\n bar."baz-1" = 2\n}',
    },
    {
      name: 'call arguments block, collapsed',
      tree: [
        ...UnparserToken.withSpaces('call', 'Foo'),
        UnparserToken.callBlock(
          UnparserToken.withSpaces('foo', '=', '1'),
          UnparserToken.withSpaces('bar."baz-1"', '=', '2')
        ),
      ],
      expected: 'call Foo(foo = 1, bar."baz-1" = 2)',
    },
    {
      name: 'call arguments block, expanded',
      tree: [
        ...UnparserToken.withSpaces('call', 'Foo'),
        UnparserToken.callBlock(
          UnparserToken.withSpaces('foo', '=', '1'),
          UnparserToken.withSpaces('bar."baz-1"', '=', '2')
        ),
      ],
      configuration: {
        callBlockStyle: 'expanded',
      },
      expected: 'call Foo(\n foo = 1\n bar."baz-1" = 2\n)',
    },
    {
      name: 'object block, collapsed, trailing',
      tree: UnparserToken.withSpaces(
        'a',
        '=',
        UnparserToken.objectBlock(
          UnparserToken.withSpaces('foo', '=', '1'),
          UnparserToken.withSpaces('bar."baz-1"', '=', '2')
        )
      ),
      configuration: {
        trailingTerminators: true,
      },
      expected: 'a = { foo = 1, bar."baz-1" = 2, }',
    },
    {
      name: 'object block, expanded',
      tree: UnparserToken.withSpaces(
        'a',
        '=',
        UnparserToken.objectBlock(
          UnparserToken.withSpaces('foo', '=', '1'),
          UnparserToken.withSpaces('bar."baz-1"', '=', '2')
        )
      ),
      configuration: {
        objectBlockStyle: 'expanded',
      },
      expected: 'a = {\n foo = 1\n bar."baz-1" = 2\n}',
    },
  ])('materialize $name', ({ name: _name, tree, configuration, expected }) => {
    const materializer = new UnparserTreeMaterializer(
      transformMapUnparserConfiguration({
        ...DEFAULT_CONFIGURATION,
        ...configuration,
      })
    );

    const result = materializer.materialize(tree);

    expect(result).toBe(expected);
  });
});
