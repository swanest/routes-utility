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
            next: null,
        };
        if (this._length === 0) {
            this._head = this._tail = newNode;
        } else {
            if (placeFirst) {
                newNode.next = this._head;
                this._head = newNode;
            } else {
                this._tail.next = newNode;
                this._tail = newNode;
            }
        }
        this._length++;
        return this;
    }

    public next() {
        if (this._length === 0) {
            return undefined;
        }

        const currentHead = this._head;
        this._head = currentHead.next;
        currentHead.next = null;

        this._length--;

        return currentHead.value;
    }
}

interface INode<T> {
    next: INode<T> | null;
    value: T;
}
