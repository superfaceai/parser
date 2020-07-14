import { BufferedIterator } from './util';

describe('buffered iterator', () => {
  it('handles multiple saves', () => {
    const inner: Array<number> = [1, 2, 3, 4, 5];
    const buf = new BufferedIterator(inner[Symbol.iterator]());

    expect(buf.next()).toStrictEqual({ done: false, value: 1 });

    const saveA = buf.save();
    expect(buf.next()).toStrictEqual({ done: false, value: 2 });
    expect(buf.next()).toStrictEqual({ done: false, value: 3 });

    const saveB = buf.save();
    expect(buf.next()).toStrictEqual({ done: false, value: 4 });

    buf.restore(saveA);
    expect(buf.next()).toStrictEqual({ done: false, value: 2 });
    expect(buf.next()).toStrictEqual({ done: false, value: 3 });
    expect(buf.next()).toStrictEqual({ done: false, value: 4 });
    expect(buf.next()).toStrictEqual({ done: false, value: 5 });

    buf.restore(saveB);
    expect(buf.next()).toStrictEqual({ done: false, value: 4 });
    expect(buf.next()).toStrictEqual({ done: false, value: 5 });
  });

  it('can restore newer after forgetting', () => {
    const inner: Array<number> = [1, 2, 3, 4, 5];
    const buf = new BufferedIterator(inner[Symbol.iterator]());

    expect(buf.next()).toStrictEqual({ done: false, value: 1 });

    const saveA = buf.save();
    expect(buf.next()).toStrictEqual({ done: false, value: 2 });
    expect(buf.next()).toStrictEqual({ done: false, value: 3 });

    const saveB = buf.save();
    expect(buf.next()).toStrictEqual({ done: false, value: 4 });
    expect(buf.next()).toStrictEqual({ done: false, value: 5 });

    buf.restore(saveA);
    buf.forget();
    expect(buf.next()).toStrictEqual({ done: false, value: 2 });
    expect(buf.next()).toStrictEqual({ done: false, value: 3 });

    buf.restore(saveA);
    expect(buf.next()).toStrictEqual({ done: false, value: 2 });
    expect(buf.next()).toStrictEqual({ done: false, value: 3 });
    expect(buf.next()).toStrictEqual({ done: false, value: 4 });
    expect(buf.next()).toStrictEqual({ done: false, value: 5 });

    buf.restore(saveB);
    expect(buf.next()).toStrictEqual({ done: false, value: 4 });
    expect(buf.next()).toStrictEqual({ done: false, value: 5 });
  });

  it('throws on restoring forgotten values', () => {
    const inner: Array<number> = [1, 2, 3, 4, 5];
    const buf = new BufferedIterator(inner[Symbol.iterator]());

    expect(buf.next()).toStrictEqual({ done: false, value: 1 });

    const save = buf.save();
    expect(buf.next()).toStrictEqual({ done: false, value: 2 });
    expect(buf.next()).toStrictEqual({ done: false, value: 3 });

    buf.forget();

    expect(() => buf.restore(save)).toThrow('');
  });

  it("doesn't call inner again once it's done", () => {
    const inner: Array<number> = [1, 2, 3, 4, 5];
    const innerIter = inner[Symbol.iterator]();
    let counter = 0;
    const innerWrap = {
      next(): IteratorResult<number> {
        if (counter >= inner.length + 1) {
          throw 'next called after inner iterator exhausted';
        }
        counter += 1;

        return innerIter.next();
      },
    };

    const buf = new BufferedIterator(innerWrap);

    const save = buf.save();
    expect(buf.next()).toStrictEqual({ done: false, value: 1 });
    expect(buf.next()).toStrictEqual({ done: false, value: 2 });
    expect(buf.next()).toStrictEqual({ done: false, value: 3 });
    expect(buf.next()).toStrictEqual({ done: false, value: 4 });
    expect(buf.next()).toStrictEqual({ done: false, value: 5 });
    expect(buf.next()).toStrictEqual({ done: true, value: undefined });
    expect(buf.next()).toStrictEqual({ done: true, value: undefined });

    buf.restore(save);
    expect(buf.next()).toStrictEqual({ done: false, value: 1 });
    expect(buf.next()).toStrictEqual({ done: false, value: 2 });
    expect(buf.next()).toStrictEqual({ done: false, value: 3 });
    expect(buf.next()).toStrictEqual({ done: false, value: 4 });
    expect(buf.next()).toStrictEqual({ done: false, value: 5 });
    expect(buf.next()).toStrictEqual({ done: true, value: undefined });
    expect(buf.next()).toStrictEqual({ done: true, value: undefined });
  });

  it('keeps position on peek', () => {
    const inner: Array<number> = [1, 2, 3, 4, 5];
    const buf = new BufferedIterator(inner[Symbol.iterator]());

    expect(buf.peek()).toStrictEqual({ done: false, value: 1 });
    expect(buf.next()).toStrictEqual({ done: false, value: 1 });

    expect(buf.next()).toStrictEqual({ done: false, value: 2 });

    expect(buf.peek()).toStrictEqual({ done: false, value: 3 });
    expect(buf.peek()).toStrictEqual({ done: false, value: 3 });
    expect(buf.next()).toStrictEqual({ done: false, value: 3 });

    expect(buf.next()).toStrictEqual({ done: false, value: 4 });
    expect(buf.next()).toStrictEqual({ done: false, value: 5 });
  });
});
