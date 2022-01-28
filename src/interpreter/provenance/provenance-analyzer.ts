import createDebug from 'debug';

import { AssignmentNode, CallStatementNode, ConditionAtomNode, HttpCallStatementNode, HttpRequestNode, HttpResponseHandlerNode, InlineCallNode, IterationAtomNode, JessieExpressionNode, LiteralNode, MapASTNode, MapAstVisitor, MapDefinitionNode, MapDocumentNode, MapHeaderNode, ObjectLiteralNode, OperationDefinitionNode, OutcomeStatementNode, PrimitiveLiteralNode, SetStatementNode } from "@superfaceai/ast";
import { ProvenanceItem, ProvenanceOperationCompose, ProvenanceSourceLiteral } from './items';
import { ScriptProvenanceAnalyzer } from './provenance-analyzer-script';

const debug = createDebug('superface-parser:provenance-analyzer');

function assertUnreachable(node: never): never;
function assertUnreachable(node: MapASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

type OutcomeResult = {
  result?: ProvenanceItem;
  error?: ProvenanceItem;
};
export class ProvenanceAnalyzer implements MapAstVisitor {
  /**
  * Cache for operations that have already been visited.
  * 
  * May contain args placeholders.
  */
  private resolvedOperations: Record<string, { result: ProvenanceItem, error: ProvenanceItem }> = {};
  
  private currentMapInfo?: OutcomeResult & { name: string } = undefined;
  private variablesStack: Record<string, ProvenanceItem>[] = [];
  
  constructor(
    private readonly mapAst: MapASTNode
  ) {}

  queryOutcomes(mapName: string): OutcomeResult {
    const { result, error } = this.analyze(mapName);
    
    return { result, error };
  }

  queryVariable(mapName: string, variableName: string): ProvenanceItem | undefined {
    const { variables } = this.analyze(mapName);

    return variables[variableName];
  }

  private analyze(mapName: string): OutcomeResult & { variables: Record<string, ProvenanceItem> } {
    // set up
    this.currentMapInfo = {
      name: mapName
    };
    this.variablesStack.push({});

    // analyze
    this.visit(this.mapAst);

    const { result, error } = this.currentMap;

    const variables = this.variablesStack.pop();
    if (variables === undefined) {
      throw new Error('Invalid analyzer state');
    }

    // clean up
    this.currentMapInfo = undefined;

    return {
      result,
      error,
      variables
    };
  }

  private get currentMap(): OutcomeResult & { name: string } {
    if (this.currentMapInfo === undefined) {
      throw new Error('Unexpected analyzer state');
    }

    return this.currentMapInfo;
  }

  visit(node: MapDocumentNode): void;
  visit(node: MapDefinitionNode): void;
  visit(node: OperationDefinitionNode): OutcomeResult;
  visit(node: LiteralNode): ProvenanceItem;
  visit(node: AssignmentNode): [key: string, value: ProvenanceItem];
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

  // entry nodes

  visitMapDocumentNode(node: MapDocumentNode): void {
    for (const def of node.definitions) {
      if (def.kind !== 'MapDefinition') {
        continue;
      }

      if (def.name !== this.currentMap.name) {
        continue;
      }

      // visit the first map with the correct name - assume there is at most one with such name
      return this.visit(def);
    }

    return undefined;
  }

  visitMapDefinitionNode(node: MapDefinitionNode): void {
    for (const statement of node.statements) {
      this.visit(statement);
    }
  }

  visitMapHeaderNode(node: MapHeaderNode): unknown {
    throw new Error("Method not implemented.");
  }

  visitOperationDefinitionNode(node: OperationDefinitionNode): OutcomeResult {
    throw new Error("Method not implemented.");
  }

  // expressions nodes

  visitPrimitiveLiteralNode(node: PrimitiveLiteralNode): ProvenanceSourceLiteral {
    return ProvenanceItem.literal(node.value);
  }

  visitObjectLiteralNode(node: ObjectLiteralNode): ProvenanceOperationCompose {
    return ProvenanceItem.compose(
      ...node.fields.map(
        (assignment): [ProvenanceItem, ProvenanceItem] => {
          const [key, value] = this.visit(assignment);

          return [ProvenanceItem.literal(key), value];
        }
      )
    );
  }

  visitAssignmentNode(node: AssignmentNode): [key: string, value: ProvenanceItem] {
    if (node.key.length === 0) {
      throw new Error("Invalid assignment node");
    }

    let value: ProvenanceItem = this.visit(node.value);
    for (let i = node.key.length - 1; i > 0; i -= 1) {
      value = ProvenanceItem.compose(
        [ProvenanceItem.literal(node.key[i]), value]
      );
    }

    return [node.key[0], value];
  }

  visitJessieExpressionNode(node: JessieExpressionNode): ProvenanceItem {
    return ScriptProvenanceAnalyzer.analyzeExpression(
      this.currentVariables,
      // the source is usually much simpler, but we are going to have to support transpiled expression as well
      node.source ?? node.expression
    );
  }

  // atoms

  visitConditionAtomNode(node: ConditionAtomNode): ProvenanceItem {
    return this.visit(node.expression);
  }

  visitIterationAtomNode(node: IterationAtomNode): unknown {
    throw new Error("Method not implemented.");
  }

  // variables

  private get currentVariables(): Record<string, ProvenanceItem> {
    return this.variablesStack[this.variablesStack.length - 1];
  }

  private static mergeItems(left: ProvenanceItem | undefined, right: ProvenanceItem): ProvenanceItem {
    // TODO: objects
    return right;
  }

  visitSetStatementNode(node: SetStatementNode): void {
    const newVariables: Record<string, ProvenanceItem> = {};
    for (const assignment of node.assignments) {
      const [key, value] = this.visit(assignment);

      newVariables[key] = value;
    }
    
    if (node.condition !== undefined) {
      // const condition = this.visit(node.condition);

      throw new Error("Method not implemented.");
    } else {
      for (const [key, value] of Object.entries(newVariables)) {
        this.currentVariables[key] = ProvenanceAnalyzer.mergeItems(this.currentVariables[key],value);
      }
    }

    debug("Updated variables", this.currentVariables);
  }

  visitOutcomeStatementNode(node: OutcomeStatementNode): void {
    const value = this.visit(node.value);
    
    if (node.condition !== undefined) {
      throw new Error("Method not implemented.");
    } else {
      if (node.isError) {
        this.currentMap.error = value;
      } else {
        this.currentMap.result = value;
      }
    }
  }

  // calls

  visitInlineCallNode(node: InlineCallNode): ProvenanceItem {
    throw new Error("Method not implemented.");
  }

  visitCallStatementNode(node: CallStatementNode): unknown {
    throw new Error("Method not implemented.");
  }

  // http statement

  visitHttpCallStatementNode(node: HttpCallStatementNode): unknown {
    throw new Error("Method not implemented.");
  }

  visitHttpRequestNode(node: HttpRequestNode): unknown {
    throw new Error("Method not implemented.");
  }

  visitHttpResponseHandlerNode(node: HttpResponseHandlerNode): unknown {
    throw new Error("Method not implemented.");
  }
}
