/** Iterator adaptor that buffers expanded values until they are not needed.
 *
 * This adaptor is useful for OR-style rule matchers. It can be repeatedly reset
 * to the last saved point and can freely move between currently buffered values.
 * The iterator can be cleared to drop all values before the cursor and create a new save point.
 */
export class BufferedIterator<T> implements IterableIterator<T> {
	/** The original iterator. */
	private readonly it: Iterator<T>;
	/** Field indicating whether the inner iterator is done. */
	private done: boolean;
	
/**
	* Position inside `it` since the creation of this object.
	*
	* This corresponds to the number of times `it.next()` was called.
*/
	private absolutePosition: number;

/**
	* Position of this iterator.
	*
	* This field will always be inside [`this.absolutePosition - this.buffer.length`; `this.absolutePosition`];
*/
	private position: number;

	/** Whether the values are being recorded. */
	private recording: boolean;
	/** Buffer of the saved values. */
	private buffer: Array<T>;

	constructor(it: Iterator<T>) {
		this.it = it;
		this.done = false;

		this.absolutePosition = 0;
		this.position = 0;

		this.recording = false;
		this.buffer = [];
	}

	/** Returns a position that can be restored using `restore`. */
	save(): number {
		this.recording = true;

		return this.position;
	}

/**
	* Restores a position, if saved.
	*
	* This function will throw if this position cannot be restored.
*/
	restore(position: number) {
		if (!Number.isInteger(position) || position < 0) {
			throw 'position must be a non-negative integer'
		}
		if (position < this.absolutePosition - this.buffer.length) {
			throw 'position is forgotten';
		}
		if (position > this.absolutePosition) {
			throw 'position is in the future';
		}

		this.position = position;
	}

	forget() {
		const placesToForget = this.buffer.length - (this.absolutePosition - this.position);
		this.buffer = this.buffer.slice(placesToForget);

		this.recording = false;
	}

	next(): IteratorResult<T, undefined> {
		if (this.position > this.absolutePosition) {
			throw 'Invalid state. This in an error in the BufferedIterator.';
		}

		if (this.position === this.absolutePosition) {
			if (this.done) {
				return {
					done: true,
					value: undefined
				}
			}

			// Take next value and handle done
			const nextValue = this.it.next();
			if (nextValue.done === true) {
				this.done = true;
				return {
					done: true,
					value: undefined
				}
			}

			this.position += 1;
			this.absolutePosition += 1;
			if (this.recording) {
				this.buffer.push(nextValue.value);
			}

			return {
				done: false,
				value: nextValue.value
			}
		}

		// this.position < this.absolutePosition
		const bufferIndex = this.buffer.length - (this.absolutePosition - this.position);
		this.position += 1;
		return {
			done: false,
			value: this.buffer[bufferIndex]
		}
	}

	peek(): IteratorResult<T, undefined> {
		const save = this.save();
		const next = this.next();
		this.restore(save);

		return next;
	}

	[Symbol.iterator](): IterableIterator<T> {
		return this;
	}
}

/**
 * Attempts to extract documentation title and description from string value.
 * 
 * Empty string returns an empty object.
 * 
 * String with no empty lines returns the trimmed text as description.
 * 
 * String with at least one empty line treats the text before the line 
 * as the title and the text after the empty line as the description.
 */
export function extractDocumentation(string?: string): { title?: string, description?: string } {
	const trimmed = string?.trim();
	
	if (trimmed === undefined || trimmed === '') {
		return {};
	}

	const emptyLinePosition = trimmed.indexOf('\n\n');
	if (emptyLinePosition > -1) {
		const title = trimmed.slice(0, emptyLinePosition);
		const description = trimmed.slice(emptyLinePosition + 2);

		return {
			title,
			description
		}
	}

	return {
		description: trimmed
	}
}