import createDebug from 'debug';

import { AssignmentNode, CallStatementNode, ConditionAtomNode, HttpCallStatementNode, HttpRequestNode, HttpResponseHandlerNode, InlineCallNode, IterationAtomNode, JessieExpressionNode, LiteralNode, MapASTNode, MapAstVisitor, MapDefinitionNode, MapDocumentNode, MapHeaderNode, ObjectLiteralNode, OperationDefinitionNode, OutcomeStatementNode, PrimitiveLiteralNode, SetStatementNode } from "@superfaceai/ast";
import { ProvenanceSourceLiteral } from './items/source';
import { ProvenanceItem } from './items/common';
import { ProvenanceOperationCompose } from './items/operation-member';

const debug = createDebug('superface-parser:provenance-analyzer');

function assertUnreachable(node: never): never;
function assertUnreachable(node: MapASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

export class ProvenanceAnalyzer implements MapAstVisitor {
	constructor(
    private readonly mapAst: MapASTNode
  ) {}

  query(map: string, todo: never): void {
    throw 'TODO'
  }

  visit(node: LiteralNode): ProvenanceItem;
  visit(node: AssignmentNode): [key: ProvenanceItem, value: ProvenanceItem];
  visit(node: MapASTNode): unknown;
	visit(node: MapASTNode): unknown {
		debug('Visiting node: ' + node.kind);

		switch (node.kind) {
			case 'MapDocument':
			  return this.visitMapDocumentNode(node);
			case 'MapHeader':
			  return this.visitMapHeaderNode(node);
			case 'OperationDefinition':
			  return this.visitOperationDefinitionNode(node);
			case 'MapDefinition':
			  return this.visitMapDefinitionNode(node);
			case 'HttpCallStatement':
			  return this.visitHttpCallStatementNode(node);
			case 'HttpResponseHandler':
			  return this.visitHttpResponseHandlerNode(node);
			case 'HttpRequest':
			  return this.visitHttpRequestNode(node);
			case 'CallStatement':
			  return this.visitCallStatementNode(node);
			case 'OutcomeStatement':
			  return this.visitOutcomeStatementNode(node);
			case 'SetStatement':
			  return this.visitSetStatementNode(node);
			case 'ConditionAtom':
			  return this.visitConditionAtomNode(node);
			case 'IterationAtom':
			  return this.visitIterationAtomNode(node);
			case 'Assignment':
			  return this.visitAssignmentNode(node);
			case 'InlineCall':
			  return this.visitInlineCallNode(node);
			case 'JessieExpression':
			  return this.visitJessieExpressionNode(node);
			case 'ObjectLiteral':
			  return this.visitObjectLiteralNode(node);
			case 'PrimitiveLiteral':
			  return this.visitPrimitiveLiteralNode(node);
	  
			default:
			  assertUnreachable(node);
		  }
	}

	visitPrimitiveLiteralNode(node: PrimitiveLiteralNode): ProvenanceSourceLiteral {
		return new ProvenanceSourceLiteral(node.value);
	}

	visitObjectLiteralNode(node: ObjectLiteralNode): ProvenanceItem {
		return new ProvenanceOperationCompose(
      node.fields.map(
        assignment => this.visit(assignment)
      )
    )
	}

	visitJessieExpressionNode(node: JessieExpressionNode): ProvenanceItem {
		throw new Error("Method not implemented.");
	}

	visitAssignmentNode(node: AssignmentNode): [key: ProvenanceItem, value: ProvenanceItem] {
		if (node.key.length === 0) {
      throw new Error("Invalid assignment node");
    }

    let value: ProvenanceItem = this.visit(node.value);
    for (let i = node.key.length - 1; i > 0; i -= 1) {
      value = new ProvenanceOperationCompose(
        [
          [new ProvenanceSourceLiteral(node.key[i]), value]
        ]
      );
    }

    return [
      new ProvenanceSourceLiteral(node.key[0]),
      value
    ]
	}

	visitConditionAtomNode(node: ConditionAtomNode): unknown {
		throw new Error("Method not implemented.");
	}

	visitIterationAtomNode(node: IterationAtomNode): unknown {
		throw new Error("Method not implemented.");
	}

	visitSetStatementNode(node: SetStatementNode): unknown {
		throw new Error("Method not implemented.");
	}

	visitCallStatementNode(node: CallStatementNode): unknown {
		throw new Error("Method not implemented.");
	}

	visitHttpResponseHandlerNode(node: HttpResponseHandlerNode): unknown {
		throw new Error("Method not implemented.");
	}

  visitHttpRequestNode(node: HttpRequestNode): unknown {
    throw new Error("Method not implemented.");
  }

	visitHttpCallStatementNode(node: HttpCallStatementNode): unknown {
		throw new Error("Method not implemented.");
	}

	visitMapDefinitionNode(node: MapDefinitionNode): unknown {
		throw new Error("Method not implemented.");
	}

	visitMapHeaderNode(node: MapHeaderNode): unknown {
		throw new Error("Method not implemented.");
	}

	visitOperationDefinitionNode(node: OperationDefinitionNode): unknown {
		throw new Error("Method not implemented.");
	}

	visitOutcomeStatementNode(node: OutcomeStatementNode): unknown {
		throw new Error("Method not implemented.");
	}

	visitInlineCallNode(node: InlineCallNode): ProvenanceItem {
		throw new Error("Method not implemented.");
	}

	visitMapDocumentNode(node: MapDocumentNode): unknown {
		throw new Error("Method not implemented.");
	}
}
