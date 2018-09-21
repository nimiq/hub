export default class Observable {
    static get WILDCARD(): string {
        return '*';
    }

    private _listeners: Map<string, Function[]>;

    constructor() {
        this._listeners = new Map();
    }

    _offAll() {
        this._listeners.clear();
    }

    on(type: string, callback: Function): number {
        if (!this._listeners.has(type)) {
            this._listeners.set(type, [callback]);
            return 0;
        } else {
            return this._listeners.get(type)!.push(callback) - 1;
        }
    }

    off(type: string, id: number) {
        if (!this._listeners.has(type) || !this._listeners.get(type)![id]) return;
        delete this._listeners.get(type)![id];
    }

    fire(type: string, ...args: any[]): Promise<any> | null {
        const promises = [];
        // Notify listeners for this event type.
        if (this._listeners.has(type)) {
            const listeners = this._listeners.get(type)!;
            for (const key in listeners) {
                // Skip non-numeric properties.
                if (typeof key !== 'number') continue;

                const listener = listeners[key];
                const res = listener.apply(null, args);
                if (res instanceof Promise) promises.push(res);
            }
        }

        // Notify wildcard listeners. Pass event type as first argument
        if (this._listeners.has(Observable.WILDCARD)) {
            const listeners = this._listeners.get(Observable.WILDCARD)!;
            for (const key in listeners) {
                // Skip non-numeric properties.
                if (typeof key !== 'number') continue;

                const listener = listeners[key];
                const res = listener.apply(null, arguments);
                if (res instanceof Promise) promises.push(res);
            }
        }

        if (promises.length > 0) return Promise.all(promises);
        return null;
    }

    bubble(observable: Observable, ...types: string[]) {
        for (const type of types) {
            let callback;
            if (type === Observable.WILDCARD) {
                callback = function(this: any) {
                    this.fire.apply(this, arguments);
                };
            } else {
                callback = function(this: any) {
                    this.fire.apply(this, [type, ...arguments]);
                };
            }
            observable.on(type, callback.bind(this));
        }
    }
}
