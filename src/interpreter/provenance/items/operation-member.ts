import { ProvenanceItem } from './common';
import { ProvenanceOperation } from './operation';

/** `<parent>[<path>[0]][<path>[1]][...]` */
export class ProvenanceOperationIndex extends ProvenanceOperation {
	constructor(
		private readonly base: ProvenanceItem,
		private readonly path: ProvenanceItem[]
	) {
		super();
	}
}

/** `{ [entries[0].key]: entries[0].value, [entries[1].key]: entries[1].value, ... }` */
export class ProvenanceOperationCompose extends ProvenanceOperation {
	constructor(
		private readonly entries: [key: ProvenanceItem, value: ProvenanceItem][]
	) {
		super();
	}
}
