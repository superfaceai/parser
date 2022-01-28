import { MapDocumentNode } from "@superfaceai/ast";

import { parseMap } from "../../language";
import { ProvenanceAnalyzer } from "./provenance-analyzer";
import { Source } from '../../common/source';

const parseMapSource = (source: string): MapDocumentNode =>
  parseMap(
    new Source(
      `
      profile = "profile@1.0"
      provider = "provider"
    ${source}
      `
    )
  );

it('should trace simple literals', () => {
  const map = parseMapSource(
    `map Foo {
      a = 1
      b = a

      c = true
      c = b

      map result c
    }`
  );

  const analyzer = new ProvenanceAnalyzer(map);

  expect(
    analyzer.queryOutcomes('Foo')
  ).toStrictEqual(
    {
      result: {
        kind: 'source',
        sourceKind: 'literal',
        expression: 1
      },
      error: undefined
    }
  );
});
