import * as When from 'when';


declare interface ProgressivePromise<T,P> extends When.Promise<T> {
    progress(onProgress?: (updated: P) => void): When.Promise<T>;
}

/*
 Router declarations
 */
declare namespace D {

    interface doneFn {
        (output: any): void;
    }

    interface nextFn {
        (res: any, jump?: Controller | string): void;
    }

    interface Controller {
        (req: any, res: any, next: nextFn, done: doneFn): void;
    }

    interface Routes {
        [name: string]: Array<Controller>
    }

    interface getRoutesFn {
        (): Routes;
    }

    interface addRouteFn {
        (name: String, ...steps: Array<Controller>): routerMethods;
    }

    interface Progression {
        prevFnName: string;
        i: number;
        n: number;
        req: any;
        res: any;
    }

    interface matchFn {
        (name: string, req: any, cb: doneFn, context?: any): routerMethods;
        (name: string, req: any, context: any): ProgressivePromise<any,Progression>;
        (name: string, req: any): ProgressivePromise<any,Progression>;
    }

    interface routerMethods {
        addRoute: addRouteFn;
        getRoutes: getRoutesFn;
        match: matchFn;
    }
}

//Export functions
export var addRoute: D.addRouteFn;
export var getRoutes: D.getRoutesFn;
export var match: D.matchFn;

