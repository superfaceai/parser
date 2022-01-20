import { ProvenanceItem } from './common';
import { ProvenanceOperation } from './operation';

export class ProvenanceOperationUnaryPlus extends ProvenanceOperation {
	constructor(
		private readonly parent: ProvenanceItem
	) {
		super();
	}
}

export class ProvenanceOperationUnaryMinus extends ProvenanceOperation {
	constructor(
		private readonly parent: ProvenanceItem
	) {
		super();
	}
}

export class ProvenanceOperationBitwiseNot extends ProvenanceOperation {
	constructor(
		private readonly parent: ProvenanceItem
	) {
		super();
	}
}

export class ProvenanceOperationLogicalNot extends ProvenanceOperation {
	constructor(
		private readonly parent: ProvenanceItem
	) {
		super();
	}
}
