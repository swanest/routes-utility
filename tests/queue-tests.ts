import { expect } from 'chai';
import { Queue } from '../src/Queue';

describe('Queue', () => {
    it('should init a queue properly', () => {
        const q = new Queue();
        expect(q.head).to.equal(null);
        expect(q.tail).to.equal(null);
        expect(q.length).to.equal(0);
    });
    it('should add an element', () => {
        const q = new Queue();
        q.add('abc');
        const el: any = {
            value: 'abc',
            prev: null,
            next: null,
        };
        expect(q.head).to.deep.equal(el);
        expect(q.tail).to.deep.equal(el);
        expect(q.length).to.equal(1);
    });

    it('should add multiple elements', () => {
        const q = new Queue();
        q.add('abc');
        q.add('def');
        q.add('ghi');
        expect(q.head.value).to.equal('abc');
        expect(q.tail.value).to.equal('ghi');
        expect(q.head.prev).to.equal(null);
        expect(q.tail.next).to.equal(null);
        expect(q.head.next.value).to.equal('def');
        expect(q.tail.prev.value).to.equal('def');

        expect(q.head.next.prev).to.equal(q.head);
        expect(q.head.next.next).to.equal(q.tail);

        expect(q.length).to.equal(3);
    });

    it('should get next elements', () => {
        const q = new Queue();
        q.add('abc');
        q.add('def');
        q.add('ghi');

        let cur,
            index = 0;
        expect(q.length).to.equal(3);
        while ((cur = q.next()) !== undefined) {
            switch (index) {
                case 0:
                    expect(cur).to.equal('abc');
                    expect(q.length).to.equal(2);
                    break;
                case 1:
                    expect(cur).to.equal('def');
                    expect(q.length).to.equal(1);
                    break;
                case 2:
                    expect(cur).to.equal('ghi');
                    expect(q.length).to.equal(0);
                    break;
                default:
                    expect(true).to.equal(false);
            }
            index++;
        }
        expect(q.next()).to.equal(undefined);
    });
});
