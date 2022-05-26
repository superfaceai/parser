/////////////////////////////////////////////////////////////////////
// BASE

export type ProvenanceItemBase = {
  kind: string;
};

/////////////////////////////////////////////////////////////////////
// SOURCE

export type ProvenanceSourceBase = ProvenanceItemBase & {
  kind: 'source';
  sourceKind: string;
};
export type ProvenanceSourceLiteral = ProvenanceSourceBase & {
  sourceKind: 'literal';
  /** The expression which materializes this literal. */
  expression: number | string | boolean;
};
export type ProvenanceSourceInput = ProvenanceSourceBase & {
  sourceKind: 'input';
};
export type ProvenanceSourceParameters = ProvenanceSourceBase & {
  sourceKind: 'parameters';
};
export type ProvenanceSourceHttpResponse = ProvenanceSourceBase & {
  sourceKind: 'http-response';
  /** An id of the http call uniquely identifying the HTTP call within the map. */
  httpCallId: string;
  /** An id of the response handler uniquely identifying the handler within the HTTP call. */
  responseHandlerId: string;
};

/////////////////////////////////////////////////////////////////////
// PLACEHOLDER

export type ProvenancePlaceholderBase = ProvenanceItemBase & {
  kind: 'placeholder';
  placeholderKind: string;
};
export type ProvenancePlaceholderArgs = ProvenancePlaceholderBase & {
  kind: 'placeholder';
  placeholderKind: 'args';
};
export type ProvenancePlaceholderMissing = ProvenancePlaceholderBase & {
  kind: 'placeholder';
  placeholderKind: 'missing';
};

/////////////////////////////////////////////////////////////////////
// OPERATION

export type ProvenanceOperationBase = ProvenanceItemBase & {
  kind: 'operation';
  operationKind: string;
};

/////////////////////////////////////////////////////////////////////
// OPERATION unary

export type ProvenanceOperationLogicalNot = ProvenanceOperationBase & {
  operationKind: 'logical-not';
  parent: ProvenanceItem;
};
export type ProvenanceOperationBitwiseNot = ProvenanceOperationBase & {
  operationKind: 'bitwise-not';
  parent: ProvenanceItem;
};
export type ProvenanceOperationUnaryPlus = ProvenanceOperationBase & {
  operationKind: 'unary-plus';
  parent: ProvenanceItem;
};
export type ProvenanceOperationUnaryMinus = ProvenanceOperationBase & {
  operationKind: 'unary-minus';
  parent: ProvenanceItem;
};

/////////////////////////////////////////////////////////////////////
// OPERATION binary

export type ProvenanceOperationLogicalOr = ProvenanceOperationBase & {
  operationKind: 'logical-or';
  parentLeft: ProvenanceItem;
  parentRight: ProvenanceItem;
};

/////////////////////////////////////////////////////////////////////
// OPERATION member

export type ProvenanceOperationIndex = ProvenanceOperationBase & {
  operationKind: 'index';
  base: ProvenanceItem;
  path: ProvenanceItem[];
};

export type ProvenanceOperationCompose = ProvenanceOperationBase & {
  operationKind: 'compose';
  entries: [key: ProvenanceItem, value: ProvenanceItem][];
};

/////////////////////////////////////////////////////////////////////
// OPERATION condition

export type ProvenanceOperationCondition = ProvenanceOperationBase & {
  operationKind: 'condition';
  parentCondition: ProvenanceItem;
  parentPositive: ProvenanceItem;
  parentNegative: ProvenanceItem;
};

/////////////////////////////////////////////////////////////////////
// FINAL

export type ProvenanceSource =
  | ProvenanceSourceLiteral
  | ProvenanceSourceInput
  | ProvenanceSourceParameters
  | ProvenanceSourceHttpResponse;
export type ProvenancePlaceholder =
  | ProvenancePlaceholderArgs
  | ProvenancePlaceholderMissing;
export type ProvenanceOperation =
  | ProvenanceOperationLogicalNot
  | ProvenanceOperationBitwiseNot
  | ProvenanceOperationUnaryPlus
  | ProvenanceOperationUnaryMinus
  | ProvenanceOperationLogicalOr
  | ProvenanceOperationIndex
  | ProvenanceOperationCompose
  | ProvenanceOperationCondition;
export type ProvenanceItem =
  | ProvenanceSource
  | ProvenancePlaceholder
  | ProvenanceOperation;

export const ProvenanceItem = {
  literal(expression: string | number | boolean): ProvenanceSourceLiteral {
    return {
      kind: 'source',
      sourceKind: 'literal',
      expression,
    };
  },

  compose(
    ...entries: [key: ProvenanceItem, value: ProvenanceItem][]
  ): ProvenanceOperationCompose {
    return {
      kind: 'operation',
      operationKind: 'compose',
      entries,
    };
  },
};
