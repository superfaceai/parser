import { ProvenanceItem } from './common';
import { ProvenanceOperation } from './operation';

export class ProvenanceOperationCondition extends ProvenanceOperation {
	constructor(
		private readonly condition: ProvenanceItem,
		private readonly positiveOutcome: ProvenanceItem,
		private readonly negativeOutcome: ProvenanceItem
	) {
		super();
	}
}