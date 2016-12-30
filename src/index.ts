import * as When from "when";
import * as _ from "lodash";
import {CustomError} from "sw-logger";


//Interfaces
export interface IDoneFn<FINAL_RES> {
    (output: Error | FINAL_RES): void;
}

export interface INextFn<NEXT_RES> {
    (res: Error | NEXT_RES, jump?: Controller<any,any,NEXT_RES,any,any> | string): void;
}

export interface IControllerFn<CONTEXT,INIT_REQ,RES,NEXT_RES,FINAL_RES> {
    (this: CONTEXT, req: INIT_REQ, res: RES, next: INextFn<NEXT_RES>, done: IDoneFn<FINAL_RES>): void;
}

export interface IProgression {
    lastExecutedController: string;
    nextIndex: number;
    routeSize: number;
    req: any;
    res: any;
}


//Controller
export class Controller<CONTEXT,INIT_REQ,RES,NEXT_RES,FINAL_RES> {

    private _fn: IControllerFn<CONTEXT,INIT_REQ,RES,NEXT_RES,FINAL_RES>
    private _name: string

    constructor(fn: IControllerFn<CONTEXT,INIT_REQ,RES,NEXT_RES,FINAL_RES>, name?: string) {
        this._fn = fn;
        name != void 0 ? this._name = name : this._name = this._fn.name;
        if (name == '')
            throw new CustomError('missingControllerName', "only named controllers are authorized", 500, "fatal");
    }

    get body(): IControllerFn<CONTEXT,INIT_REQ,RES,NEXT_RES,FINAL_RES> {
        return this._fn;
    }

    get name(): string {
        return this._name;
    }

}

export interface IRouteStatistics {
    FINISHED: {
        SUCCESS: number;
        ERRORS: number;
        TOTAL: number;
    };
    PENDING: {
        STAGES: {
            [controller: string]: number;
        };
        TOTAL: number;
    };
    timestamp_ms: number;
}

//Route
export class Route<CONTEXT,INIT_REQ,FINAL_RES> {
    private _controllers: Array<Controller<CONTEXT,INIT_REQ,any,any,FINAL_RES>>
    private _name: string
    private _statistics: IRouteStatistics = {
        FINISHED: {
            SUCCESS: 0,
            ERRORS: 0,
            TOTAL: 0
        },
        PENDING: {
            STAGES: {},
            TOTAL: 0
        },
        timestamp_ms: Date.now()
    }
    private _initStatistics: IRouteStatistics = this._statistics;

    constructor(name: string, ...controllers: Array<Controller<CONTEXT,INIT_REQ,any,any,FINAL_RES>>) {
        this._controllers = [];
        this._name = name;
        _.each(controllers || [], (c) => this.addController(c));
    }

    addController(controller: Controller<CONTEXT,INIT_REQ,any,any,FINAL_RES>): this {
        if (_.find(this._controllers, {name: controller.name}) != void 0)
            throw new CustomError("duplicatedControllerName", "a controller with name %s already exists in route %s", controller.name, this.name, 500, "fatal");
        this._statistics.PENDING.STAGES[controller.name] = 0;
        this._controllers.push(controller);
        this._initStatistics = _.cloneDeep(this._statistics);
        return this;
    }

    match(req: INIT_REQ, context: CONTEXT, onProgress?: (progression: IProgression)=>any): When.Promise<FINAL_RES> {

        if (!_.isArray(this._controllers) || !this._controllers.length)
            throw new CustomError("invalidRoute", "route %s does not contain any controller", this._name);

        let index: number = 0,
            currentController = this._controllers[index],
            lastExecutedController: Controller<CONTEXT,INIT_REQ,any,any,FINAL_RES>,
            onProgressFns: Array<any> = [],
            def = When.defer<FINAL_RES>(),
            finish: IDoneFn<FINAL_RES> = (res) => {
                if (_.isFinite(this._statistics.PENDING.STAGES[lastExecutedController.name]))
                    this._statistics.PENDING.STAGES[lastExecutedController.name]--;
                this._statistics.PENDING.TOTAL--, this._statistics.FINISHED.TOTAL++;
                if (res instanceof CustomError)
                    def.reject(res), this._statistics.FINISHED.ERRORS++;
                else if (res instanceof Error)
                    def.reject(new CustomError().use(res)), this._statistics.FINISHED.ERRORS++;
                else
                    def.resolve(res), this._statistics.FINISHED.SUCCESS++;
            };


        if (onProgress != void 0)
            onProgressFns.push(onProgress);

        this._statistics.PENDING.TOTAL++;

        let next = (res: any, controller?: any) => {
            if (res instanceof Error)
                finish(res);
            else if (index == this._controllers.length - 1) //finish
                finish(res);
            else {
                if (controller != void 0) { //Jump to a specific controller
                    while (controller !== currentController && controller !== currentController.name && index < this._controllers.length - 1) {
                        index++, currentController = this._controllers[index];
                    }
                    if (_.isFinite(this._statistics.PENDING.STAGES[lastExecutedController.name]))
                        this._statistics.PENDING.STAGES[lastExecutedController.name]--;
                    if (controller !== currentController && controller !== currentController.name)
                        throw new CustomError("controllerJumpFailed", "%s not found in route %s", controller, this._name, 500, "fatal");
                }
                else {
                    index++, currentController = this._controllers[index];
                    if (_.isFinite(this._statistics.PENDING.STAGES[lastExecutedController.name]))
                        this._statistics.PENDING.STAGES[lastExecutedController.name]--;
                }

                _.defaults(this._statistics.PENDING.STAGES, {
                    [currentController.name]: 0
                });
                this._statistics.PENDING.STAGES[currentController.name]++;

                When.all(_.map(onProgressFns, (pFn) => {
                    return pFn({
                        lastExecutedController: lastExecutedController,
                        nextIndex: index,
                        routeSize: this._controllers.length,
                        req: req,
                        res: res
                    });
                })).then(() => {
                    lastExecutedController = currentController;
                    currentController.body.call(context, req, res, next, finish);
                }).catch((err) => {
                    next(err); // is similar to finish(err)
                });
            }
        };

        setImmediate(() => {
            try {
                _.defaults(this._statistics.PENDING.STAGES, {
                    [currentController.name]: 0
                });
                this._statistics.PENDING.STAGES[currentController.name]++;
                lastExecutedController = currentController;
                currentController.body.call(context, req, req, next, finish);
            } catch (e) {
                next(e); //is similar to finish(err)
            }
        });

        return def.promise;
    }

    get name(): string {
        return this._name;
    }

    get statistics(): IRouteStatistics {
        let s = _.cloneDeep(this._statistics);
        s.timestamp_ms = Date.now();
        return s;
    }

    delta(x?: IRouteStatistics): IRouteStatistics {
        if (x == void 0)
            x = this._initStatistics;
        let y = this.statistics,
            s: IRouteStatistics = {
                FINISHED: {
                    SUCCESS: y.FINISHED.SUCCESS - x.FINISHED.SUCCESS,
                    ERRORS: y.FINISHED.ERRORS - x.FINISHED.ERRORS,
                    TOTAL: y.FINISHED.TOTAL - x.FINISHED.TOTAL
                },
                PENDING: {
                    STAGES: {},
                    TOTAL: y.PENDING.TOTAL - x.PENDING.TOTAL
                },
                timestamp_ms: y.timestamp_ms - x.timestamp_ms
            };
        _.keys(y.PENDING.STAGES).forEach((k: string) => {
            s.PENDING.STAGES[k] = y.PENDING.STAGES[k] - (x.PENDING.STAGES[k] || 0);
        });
        return s;
    }

}

export interface IRoutes {
    [name: string]: Route<any,any,any>;
}

export class Router {

    private _routes: IRoutes

    constructor() {
        this._routes = {};
    }

    get routes(): IRoutes {
        return this._routes;
    }

    addRoute<CONTEXT,INIT_REQ,FINAL_RES>(route: Route<CONTEXT,INIT_REQ,FINAL_RES>): this {
        this._routes[route.name] = route;
        return this;
    }

    getRoute<CONTEXT,INIT_REQ,FINAL_RES>(name: string): Route<CONTEXT,INIT_REQ,FINAL_RES> {
        return this._routes[name];
    }

}