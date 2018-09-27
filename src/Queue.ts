export class Queue<T> {
    private _head: INode<T> = null;

    public get head() {
        return this._head;
    }

    private _length: number = 0;

    public get length() {
        return this._length;
    }

    private _tail: INode<T> = null;

    public get tail() {
        return this._tail;
    }

    public add(value: T, placeFirst: boolean = false) {
        const newNode: INode<T> = {
            value: value,
            prev: null,
            next: null,
        };
        if (this._length === 0) {
            this._head = this._tail = newNode;
        } else {
            if (placeFirst) {
                this._head.prev = newNode;
                newNode.next = this._head;
                this._head = newNode;
            } else {
                this._tail.next = newNode;
                newNode.prev = this._tail;
                this._tail = newNode;
            }
        }
        this._length++;
        return this;
    }

    public next() {
        if (this.length === 0) {
            return undefined;
        }

        const value = this._head.value;
        this._head = this._head.next;
        if (this._head) {
            this._head.prev = null;
        }

        this._length--;

        return value;
    }
}

interface INode<T> {
    next: INode<T> | null;
    prev: INode<T> | null;
    value: T;
}
