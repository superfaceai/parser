import { MapASTNode } from '@superindustries/language';
import { MapVisitor } from '@superindustries/superface';

export class MapValidator implements MapVisitor {
  constructor(private readonly nejakyvystup: any) {}

  validate() {}

  visit(node: MapASTNode): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitEvalDefinitionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitHTTPOperationDefinitionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitIterationDefinitionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitJSExpressionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitMapDefinitionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitMapDocumentNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitMapExpressionDefinitionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitMapNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitNetworkOperationDefinitionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitOperationCallDefinitionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitOperationDefinitionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitOutcomeDefinitionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitProfileIdNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitProviderNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitStepDefinitionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
  visitVariableExpressionDefinitionNode(node: any): unknown {
    console.log(node);
    throw new Error('Method not implemented.');
  }
}
