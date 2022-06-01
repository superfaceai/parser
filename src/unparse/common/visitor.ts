import {
  UnparserTokenGroup,
  UnparserTreeMaterializer,
  UnparserTreeMaterializerConfiguration,
} from './tree';

export abstract class UnparserBase<T> {
  private readonly materializer: UnparserTreeMaterializer;

  constructor(configuration: UnparserTreeMaterializerConfiguration) {
    this.materializer = new UnparserTreeMaterializer(configuration);
  }

  unparse(ast: T): string {
    const tree = this.visit(ast);

    return this.materializer.materialize(tree);
  }

  abstract visit(ast: T): UnparserTokenGroup;
}
