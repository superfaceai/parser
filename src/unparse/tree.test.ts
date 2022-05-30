import { materializeTree, UnparserMaterializationConfiguration } from './materializer';
import { UnparserToken, UnparserTree } from './tree';

type TestParams = {
  name: string,
  tree: UnparserTree,
  configuration?: Partial<UnparserMaterializationConfiguration>,
  expected: string
};
describe('unparser tree', () => {
  const DEFAULT_CONFIGURATION: UnparserMaterializationConfiguration = {
    indentString: ' ',
    trailingTerminators: false,
    setBlockStyle: 'collapsed',
    callBlockStyle: 'collapsed'
  };

  it.each<TestParams>(
    [
      {
        name: 'simple test',
        tree: [
          ...UnparserToken.spacedAtoms('profile', '=', '"foo/bar@1.0"'),
          UnparserToken.newline(),
          UnparserToken.atom('set'),
        ],
        expected: 'profile = "foo/bar@1.0"\nset'
      },
      {
        name: 'set block collapsed',
        tree: [
          UnparserToken.atom('set'),
          UnparserToken.space(),
          UnparserToken.setBlock(
            UnparserToken.spacedAtoms('foo', '=', '1'),
            UnparserToken.spacedAtoms('bar', '=', '2'),
          ),
          UnparserToken.newline()
        ],
        expected: 'set { foo = 1; bar = 2 }\n'
      },
      {
        name: 'set block expanded, nested',
        tree: [
          UnparserToken.atom('set'),
          UnparserToken.space(),
          UnparserToken.setBlock(
            UnparserToken.spacedAtoms('foo', '=', '1'),
            UnparserToken.spacedAtoms('bar', '=', '2'),
            [UnparserToken.setBlock(
              UnparserToken.spacedAtoms('baz', '=', '3')
            )]
          ),
          UnparserToken.newline()
        ],
        configuration: {
          setBlockStyle: 'expanded'
        },
        expected: 'set {\n foo = 1\n bar = 2\n {\n  baz = 3\n }\n}\n'
      },
      {
        name: 'set block expanded+semicolons, different indent string',
        tree: [
          UnparserToken.atom('set'),
          UnparserToken.setBlock(
            UnparserToken.spacedAtoms('foo', '=', '1'),
            UnparserToken.spacedAtoms('bar', '=', '2'),
          )
        ],
        configuration: {
          indentString: '_',
          setBlockStyle: 'expanded+semicolons',
          trailingTerminators: true
        },
        expected: 'set{\n_foo = 1;\n_bar = 2;\n}'
      },
      {
        name: 'statement block',
        tree: [
          ...UnparserToken.spacedAtoms('map', 'Foo', ''),
          UnparserToken.statementBlock(
            UnparserToken.spacedAtoms('foo', '=', '1'),
            UnparserToken.spacedAtoms('bar."baz-1"', '=', '2')
          )
        ],
        expected: 'map Foo {\n foo = 1\n\n bar."baz-1" = 2\n}'
      },
      {
        name: 'call arguments block, collapsed',
        tree: [
          ...UnparserToken.spacedAtoms('call', 'Foo'),
          UnparserToken.callBlock(
            UnparserToken.spacedAtoms('foo', '=', '1'),
            UnparserToken.spacedAtoms('bar."baz-1"', '=', '2')
          )
        ],
        expected: 'call Foo(foo = 1, bar."baz-1" = 2)'
      },
      {
        name: 'call arguments block, expanded',
        tree: [
          ...UnparserToken.spacedAtoms('call', 'Foo'),
          UnparserToken.callBlock(
            UnparserToken.spacedAtoms('foo', '=', '1'),
            UnparserToken.spacedAtoms('bar."baz-1"', '=', '2')
          )
        ],
        configuration: {
          callBlockStyle: 'expanded'
        },
        expected: 'call Foo(\n foo = 1\n bar."baz-1" = 2\n)'
      }
    ]
  )('materialize $name', ({name: _name, tree, configuration, expected}) => {
    const result = materializeTree(tree, {...DEFAULT_CONFIGURATION, ...configuration});

    expect(result).toBe(expected)
  });
});
