import { ProvenanceItem } from './common';

export abstract class ProvenanceSource extends ProvenanceItem {

}

export class ProvenanceSourceLiteral extends ProvenanceSource {
	constructor(
		/** The expression which materializes this literal. */
		private readonly expression: number | string | boolean
	) {
		super();
	}
}

export class ProvenanceSourceInput extends ProvenanceSource {
	constructor(
		/** Path into the input object. */
		private readonly path: string[]
	) {
		super();
	}
}

export class ProvenanceSourceContextParameter extends ProvenanceSource {
	constructor(
		/** Path into the parameters object. */
		private readonly path: string[]
	) {
		super();
	}
}

export class ProvenanceSourceHttpResponse extends ProvenanceSource {
	constructor(
		/** An id of the http call uniquely identifying the HTTP call within the relevant map. */
		private readonly httpCallId: string,
		/** Path into the response object. */
		private readonly path: string[]
	) {
		super();
	}
}
