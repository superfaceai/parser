import { MapUnparser } from './map';

describe('map unparser', () => {
  it('should unparse map with empty definitions', () => {
    const ast = {
      kind: 'MapDocument',
      header: {
        kind: 'MapHeader',
        profile: {
          scope: 'example',
          name: 'pub-hours',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        provider: 'osm',
      },
      definitions: [
        {
          kind: 'MapDefinition',
          name: 'PubOpeningHours',
          usecaseName: 'PubOpeningHours',
          statements: [],
        },
        {
          kind: 'OperationDefinition',
          name: 'BuildQuery',
          usecaseName: 'BuildQuery',
          statements: [],
        },
      ],
    };

    const unparser = new MapUnparser(ast as any);
    expect(unparser.unparse()).toBe(
      [
        'profile = "example/pub-hours@1.0"',
        'provider = "osm"',
        '',
        'map PubOpeningHours {',
        '}',
        '',
        'operation BuildQuery {',
        '}',
        '',
      ].join('\n')
    );
  });

  it('should unparse pub-hours map', () => {
    /*
    ,\n\s*"location": \{[^}]+\},\n\s*"span": \{[^}]+\}
    */

    const ast = {
      kind: 'MapDocument',
      header: {
        kind: 'MapHeader',
        profile: {
          scope: 'example',
          name: 'pub-hours',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        provider: 'osm',
      },
      definitions: [
        {
          kind: 'MapDefinition',
          name: 'PubOpeningHours',
          usecaseName: 'PubOpeningHours',
          statements: [
            {
              kind: 'HttpCallStatement',
              method: 'POST',
              url: '/api/interpreter',
              request: {
                kind: 'HttpRequest',
                contentType: 'application/x-www-form-urlencoded',
                body: {
                  kind: 'ObjectLiteral',
                  fields: [
                    {
                      kind: 'Assignment',
                      key: ['data'],
                      value: {
                        kind: 'InlineCall',
                        operationName: 'BuildQuery',
                        arguments: [
                          {
                            kind: 'Assignment',
                            key: ['city'],
                            value: {
                              kind: 'JessieExpression',
                              expression: 'input.city',
                              source: 'input.city',
                              sourceMap:
                                'AAAA,IAAI,CAAC,GAAG,KAAK,CAAC,IAAI,CAAC',
                            },
                          },
                          {
                            kind: 'Assignment',
                            key: ['nameRegex'],
                            value: {
                              kind: 'JessieExpression',
                              expression: 'input.nameRegex',
                              source: 'input.nameRegex',
                              sourceMap:
                                'AAAA,IAAI,CAAC,GAAG,KAAK,CAAC,SAAS,CAAC',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              responseHandlers: [
                {
                  kind: 'HttpResponseHandler',
                  statusCode: 200,
                  statements: [
                    {
                      kind: 'OutcomeStatement',
                      isError: true,
                      terminateFlow: true,
                      condition: {
                        kind: 'StatementCondition',
                        expression: {
                          kind: 'JessieExpression',
                          expression:
                            "body.remarks && body.remarks.includes('Query timed out')",
                          source:
                            "body.remarks && body.remarks.includes('Query timed out')",
                          sourceMap:
                            'AAAA,IAAI,CAAC,GAAG,IAAI,CAAC,OAAO,IAAI,IAAI,CAAC,OAAO,CAAC,QAAQ,CAAC,iBAAiB,CAAC,CAAC',
                        },
                      },
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'TIMEOUT',
                      },
                    },
                    {
                      kind: 'OutcomeStatement',
                      isError: false,
                      terminateFlow: true,
                      value: {
                        kind: 'JessieExpression',
                        expression:
                          'body.elements.map(function (node) {\n    return {\n        name: node.tags.name,\n        openingHours: node.tags.opening_hours\n    };\n})',
                        source:
                          'body.elements.map(\n\t\t\t\tnode => {\n\t\t\t\t\treturn {\n\t\t\t\t\t\tname: node.tags.name,\n\t\t\t\t\t\topeningHours: node.tags.opening_hours\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t)',
                        sourceMap:
                          'AAAA,IAAI,CAAC,GAAG,IAAI,CAAC,QAAQ,CAAC,GAAG,CACrB,UAAA,IAAI;IACH,OAAO;QACN,IAAI,EAAE,IAAI,CAAC,IAAI,CAAC,IAAI;QACpB,YAAY,EAAE,IAAI,CAAC,IAAI,CAAC,aAAa;KACrC,CAAA;AACF,CAAC,CACD,CAAC',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          kind: 'OperationDefinition',
          name: 'BuildQuery',
          statements: [
            {
              kind: 'SetStatement',
              assignments: [
                {
                  kind: 'Assignment',
                  key: ['regexLine'],
                  value: {
                    kind: 'JessieExpression',
                    expression:
                      'args.nameRegex ? "node._[\\"name\\"~\\"" + args.nameRegex + "\\", i];" : \'\'',
                    source:
                      'args.nameRegex ? `node._["name"~"${args.nameRegex}", i];` : \'\'',
                    sourceMap:
                      'AAAA,IAAI,CAAC,GAAG,IAAI,CAAC,SAAS,CAAC,CAAC,CAAC,uBAAkB,IAAI,CAAC,SAAS,YAAQ,CAAC,CAAC,CAAC,EAAE,CAAC',
                  },
                },
              ],
            },
            {
              kind: 'SetStatement',
              assignments: [
                {
                  kind: 'Assignment',
                  key: ['query'],
                  value: {
                    kind: 'JessieExpression',
                    expression:
                      '("[out:json][timeout:10];\\n\\t\\tarea[boundary=administrative][admin_level=8][name=\\"" + args.city + "\\"];\\n\\t\\tnode[amenity=\\"pub\\"][opening_hours](area);\\n\\t\\t" + regexLine + "\\n\\n\\t\\tout;")',
                    source:
                      '(`[out:json][timeout:10];\n\t\tarea[boundary=administrative][admin_level=8][name="${args.city}"];\n\t\tnode[amenity="pub"][opening_hours](area);\n\t\t${regexLine}\n\n\t\tout;`)',
                    sourceMap:
                      'AAAA,IAAI,CAAC,GAAG,CAAC,sFAC8C,IAAI,CAAC,IAAI,mEAE5D,SAAS,iBAEN,CAAC,CAAC',
                  },
                },
              ],
            },
            {
              kind: 'OutcomeStatement',
              isError: false,
              terminateFlow: true,
              value: {
                kind: 'JessieExpression',
                expression: 'query',
                source: 'query',
                sourceMap: 'AAAA,IAAI,CAAC,GAAG,KAAK,CAAC',
              },
            },
          ],
        },
      ],
    };

    const unparser = new MapUnparser(ast as any);
    expect(unparser.unparse()).toBe(
      [
        'profile = "example/pub-hours@1.0"',
        'provider = "osm"',
        '',
        'map PubOpeningHours {',
        '  http POST "/api/interpreter" {',
        '    request "application/x-www-form-urlencoded" {',
        '      body {',
        '        data = call BuildQuery(city = input.city, nameRegex = input.nameRegex)',
        '      }',
        '    }',
        '',
        '    response 200 {',
        '      return map error if (body.remarks && body.remarks.includes(\'Query timed out\')) "TIMEOUT"',
        '',
        '      return map result body.elements.map(',
        '				node => {',
        '					return {',
        '						name: node.tags.name,',
        '						openingHours: node.tags.opening_hours',
        '					}',
        '				}',
        '			)',
        '    }',
        '  }',
        '}',
        '',
        'operation BuildQuery {',
        '  regexLine = args.nameRegex ? `node._["name"~"${args.nameRegex}", i];` : \'\'',
        '  query = (`[out:json][timeout:10];',
        '		area[boundary=administrative][admin_level=8][name="${args.city}"];',
        '		node[amenity="pub"][opening_hours](area);',
        '		${regexLine}',
        '',
        '		out;`)',
        '  return query',
        '}',
        '',
      ].join('\n')
    );
  });

  it('should parse something else', () => {
    const ast = {
      kind: 'MapDocument',
      header: {
        kind: 'MapHeader',
        profile: {
          name: 'testy',
          version: {
            major: 3,
            minor: 2,
            patch: 1,
          },
        },
        provider: 'pro',
        variant: 'vider',
      },
      definitions: [
        {
          kind: 'MapDefinition',
          name: 'CaseMe',
          usecaseName: 'CaseMe',
          statements: [
            {
              kind: 'SetStatement',
              assignments: [
                {
                  kind: 'Assignment',
                  key: ['a'],
                  value: {
                    kind: 'PrimitiveLiteral',
                    value: 1,
                  },
                },
                {
                  kind: 'Assignment',
                  key: ['b', 'c'],
                  value: {
                    kind: 'PrimitiveLiteral',
                    value: true,
                  },
                },
              ],
            },
            {
              kind: 'CallStatement',
              operationName: 'Foo',
              arguments: [],
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminatesFlow: false,
                  value: {
                    kind: 'PrimitiveLiteral',
                    value: 'Bar',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const unparser = new MapUnparser(ast as any, { indent: '\t' });
    expect(unparser.unparse()).toBe(
      [
        'profile = "testy@3.2"',
        'provider = "pro"',
        'variant = "vider"',
        '',
        'map CaseMe {',
        '\tset {',
        '\t\ta = 1',
        '\t\tb.c = true',
        '\t}',
        '\tcall Foo() {',
        '\t\tmap result "Bar"',
        '\t}',
        '}',
        '',
      ].join('\n')
    );
  });
});
