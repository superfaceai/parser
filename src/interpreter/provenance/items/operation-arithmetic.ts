import { ProvenanceItem } from './common';
import { ProvenanceOperation } from './operation';

export class ProvenanceOperationRemainder extends ProvenanceOperation {
	constructor(
		private readonly left: ProvenanceItem,
		private readonly right: ProvenanceItem,
	) {
		super();
	}
}

export class ProvenanceOperationLogicalOr extends ProvenanceOperation {
	constructor(
		private readonly left: ProvenanceItem,
		private readonly right: ProvenanceItem,
	) {
		super();
	}
}