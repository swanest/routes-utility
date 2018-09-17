import * as _ from 'lodash';
import { CustomError } from 'sw-logger';

// Interfaces
export interface IDoneFn<FINAL_RES> {
    (output: Error | FINAL_RES): void;
}

export interface INextFn<NEXT_RES> {
    (res: Error | NEXT_RES, jump?: Controller<any, any, NEXT_RES, any, any> | string): void;
}

export interface IControllerFn<CONTEXT, INIT_REQ, RES= INIT_REQ, NEXT_RES= INIT_REQ, FINAL_RES= INIT_REQ> {
    (this: CONTEXT, req: INIT_REQ, res: RES, next: INextFn<NEXT_RES>, done: IDoneFn<FINAL_RES>): void;
}

export interface IProgression<C> {
    lastExecutedStep: C;
    nextIndex: number;
    req: any;
    res: any;
    routeSize: number;
}

// Controller
export class Controller<CONTEXT, INIT_REQ, RES= INIT_REQ, NEXT_RES= INIT_REQ, FINAL_RES= INIT_REQ> {

    private _fn: IControllerFn<CONTEXT, INIT_REQ, RES, NEXT_RES, FINAL_RES>;
    private _name: string;

    get name(): string {
        return this._name;
    }

    get body(): IControllerFn<CONTEXT, INIT_REQ, RES, NEXT_RES, FINAL_RES> {
        return this._fn;
    }

    constructor(fn: IControllerFn<CONTEXT, INIT_REQ, RES, NEXT_RES, FINAL_RES>, name?: string) {
        this._fn = fn;
        name != null ? this._name = name : this._name = this._fn.name;
        if (name === '') {
            throw new CustomError('missingControllerName', 'only named controllers are authorized', 500, 'fatal');
        }
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
            [name: string]: number;
        };
        TOTAL: number;
    };
    onHold: number;
    timestamp_ms: number;
}

// Queue utility for routes
export class Queue<T> {

    private _offset: number = 0;
    private _queue: Array<T> = [];

    public get length(): number {
        return this._queue.length - this._offset;
    }

    public dequeue(): T {
        // if the queue is empty, return immediately
        if (this._queue.length === 0) {
            return undefined;
        }
        // store the item at the front of the queue
        const item = this._queue[this._offset];
        // increment the offset and remove the free space if necessary
        if (++this._offset * 2 >= this._queue.length) {
            this._queue = this._queue.slice(this._offset);
            this._offset = 0;
        }
        return item;
    }

    public enqueue(item: T, isUrgent: boolean): this {
        const lastId = this._queue.push(item) - 1;
        if (isUrgent) {
            [this._queue[lastId], this._queue[this._offset]] = [this._queue[this._offset], this._queue[lastId]];
        }
        return this;
    }

    public isEmpty(): boolean {
        return this._queue.length === 0;
    }

    public peek(): T {
        return (this._queue.length > 0 ? this._queue[this._offset] : undefined);
    }
}

// Route
export class Route<CONTEXT, INIT_REQ, FINAL_RES= INIT_REQ> {
    private _maxParallel: number;
    private _onHoldQueue: Queue<{ runner: () => Promise<void>; }>;
    private _parallel: number = 0;
    private _stepTimeout: number = -1;
    private _stepTimeoutHandler: (p: IProgression<any>) => void;
    private _steps: Array<Controller<CONTEXT, INIT_REQ, any, any, FINAL_RES> | Route<CONTEXT, INIT_REQ, FINAL_RES>>;

    private _name: string;

    get name(): string {
        return this._name;
    }

    private _statistics: IRouteStatistics = {
        FINISHED: {
            SUCCESS: 0,
            ERRORS: 0,
            TOTAL: 0,
        },
        PENDING: {
            STAGES: {},
            TOTAL: 0,
        },
        timestamp_ms: Date.now(),
        onHold: 0,
    };

    private _initStatistics: IRouteStatistics = this._statistics;

    get statistics(): IRouteStatistics {
        const s = _.cloneDeep(this._statistics);
        if (this._onHoldQueue) {
            s.onHold = this._onHoldQueue.length;
        }
        s.timestamp_ms = Date.now();
        return s;
    }

    constructor(name: string, ...controllers: Array<Controller<CONTEXT, INIT_REQ, any, any, FINAL_RES> | Route<CONTEXT, INIT_REQ, FINAL_RES>>) {
        this._steps = [];
        this._name = name;
        _.each(controllers || [], (c) => this.add(c));
        this._onHoldQueue = new Queue();
        this._stepTimeoutHandler = (p: IProgression<any>) => {
            throw new CustomError('timeout', 'step timed out', 408, 'fatal', {progression: p});
        };
    }

    add(step: Controller<CONTEXT, INIT_REQ, any, any, FINAL_RES> | Route<CONTEXT, INIT_REQ, FINAL_RES>): this {
        if (step instanceof Controller) {
            return this.addController(step);
        } else if (step instanceof Route) {
            return this.addSubroute(step);
        }
    }

    addController(step: Controller<CONTEXT, INIT_REQ, any, any, FINAL_RES>): this {
        if (_.find(this._steps, {name: step.name}) != null) {
            throw new CustomError('duplicatedControllerName', 'a step with name %s already exists in route %s', step.name, this.name, 500, 'fatal');
        }
        this._statistics.PENDING.STAGES[step.name] = 0;
        this._steps.push(step);
        this._initStatistics = _.cloneDeep(this._statistics);
        return this;
    }

    addSubroute(step: Route<CONTEXT, INIT_REQ, FINAL_RES>): this {
        if (_.find(this._steps, {name: step.name}) != null) {
            throw new CustomError('duplicatedSubrouteName', 'a step with name %s already exists in route %s', step.name, this.name, 500, 'fatal');
        }
        this._statistics.PENDING.STAGES[step.name] = 0;
        this._steps.push(step);
        this._initStatistics = _.cloneDeep(this._statistics);
        return this;
    }

    delta(x?: IRouteStatistics): IRouteStatistics {
        if (x == null) {
            x = this._initStatistics;
        }
        const y = this.statistics,
            s: IRouteStatistics = {
                FINISHED: {
                    SUCCESS: y.FINISHED.SUCCESS - x.FINISHED.SUCCESS,
                    ERRORS: y.FINISHED.ERRORS - x.FINISHED.ERRORS,
                    TOTAL: y.FINISHED.TOTAL - x.FINISHED.TOTAL,
                },
                PENDING: {
                    STAGES: {},
                    TOTAL: y.PENDING.TOTAL - x.PENDING.TOTAL,
                },
                timestamp_ms: y.timestamp_ms - x.timestamp_ms,
                onHold: y.onHold - x.onHold,
            };
        _.keys(y.PENDING.STAGES).forEach((k: string) => {
            s.PENDING.STAGES[k] = y.PENDING.STAGES[k] - (x.PENDING.STAGES[k] || 0);
        });
        return s;
    }

    public async match(req: INIT_REQ,
                       context: CONTEXT,
                       onProgress?: (progression: IProgression<Controller<CONTEXT, INIT_REQ, any, any, FINAL_RES> | Route<CONTEXT, INIT_REQ, FINAL_RES>>) => void,
                       isUrgent: boolean = false,
                       stepTimeoutMS: number = this._stepTimeout,
                       stepTimeoutHandler: (p: IProgression<any>) => void = this._stepTimeoutHandler): Promise<FINAL_RES> {
        return new Promise<FINAL_RES>((resolve, reject) => {
            // Put in queue
            this._onHoldQueue.enqueue({
                runner: async () => {
                    this._parallel++;
                    try {
                        let onProgressFn = onProgress;
                        if (Number.isFinite(stepTimeoutMS) && stepTimeoutMS > 0) { // wrap onProgress
                            let lastProgression: IProgression<any> = null;
                            const handler = () => {
                                try {
                                    this._stepTimeoutHandler(lastProgression);
                                } catch (e) {
                                    reject(e);
                                }
                            };
                            let t = setTimeout(handler, stepTimeoutMS);
                            onProgressFn = (progression: IProgression<Controller<CONTEXT, INIT_REQ, any, any, FINAL_RES> | Route<CONTEXT, INIT_REQ, FINAL_RES>>): void => {
                                clearTimeout(t);
                                lastProgression = progression;
                                if (onProgress != null) {
                                    onProgress(progression);
                                }
                                t = setTimeout(handler, stepTimeoutMS);
                            };
                        }
                        const response = await this._match(req, context, onProgressFn);
                        resolve(response);
                    } catch (e) {
                        reject(e);
                    } finally {
                        this._parallel--;
                        this._run();
                    }
                },
            }, isUrgent);
            this._run();
        });
    }

    /**
     * Set max parallel requests
     * @param {number} n (null or < 0 = unlimited)
     * @returns {this}
     */
    public setMaxParallel(n: number): this {
        this._maxParallel = n;
        this._run();
        return this;
    }

    /**
     * Set timeout handler to process each step, by default handler throws a timeout error
     * @param {number} ms (null or <= 0 = unlimited)
     * @param {() => void} handler
     * @returns {this}
     */
    public setStepTimeout(ms: number, handler?: () => void): this {
        this._stepTimeout = ms;
        if (handler != null) {
            this._stepTimeoutHandler = handler;
        }
        return this;
    }

    private async _match(req: INIT_REQ,
                         context: CONTEXT,
                         onProgress?: (progression: IProgression<Controller<CONTEXT, INIT_REQ, any, any, FINAL_RES> | Route<CONTEXT, INIT_REQ, FINAL_RES>>) => void): Promise<FINAL_RES> {
        if (!_.isArray(this._steps) || !this._steps.length) {
            throw new CustomError('invalidRoute', 'route %s does not contain any controller', this._name);
        }
        let index: number = 0,
            currentStep = this._steps[index],
            lastExecutedStep: Controller<CONTEXT, INIT_REQ, any, any, FINAL_RES> | Route<CONTEXT, INIT_REQ, FINAL_RES>;

        return new Promise<FINAL_RES>(async (resolve, reject) => {
            const finish: IDoneFn<FINAL_RES> = (res) => {
                if (_.isFinite(this._statistics.PENDING.STAGES[lastExecutedStep.name])) {
                    this._statistics.PENDING.STAGES[lastExecutedStep.name]--;
                }
                this._statistics.PENDING.TOTAL--, this._statistics.FINISHED.TOTAL++;
                if (res instanceof CustomError) {
                    reject(res);
                    this._statistics.FINISHED.ERRORS++;
                } else if (res instanceof Error) {
                    reject(new CustomError().use(res));
                    this._statistics.FINISHED.ERRORS++;
                } else {
                    resolve(res);
                    this._statistics.FINISHED.SUCCESS++;
                }
            };
            this._statistics.PENDING.TOTAL++;
            const next = (res: any, step?: any) => {
                if (res instanceof Error) {
                    finish(res);
                } else if (index === this._steps.length - 1) { // finish
                    finish(res);
                } else {
                    // Define next step
                    if (step != null) { // Jump to a specific step
                        while (step !== currentStep && step !== currentStep.name && index < this._steps.length - 1) {
                            index++;
                            currentStep = this._steps[index];
                        }
                        if (step !== currentStep && step !== currentStep.name) {
                            throw new CustomError('controllerJumpFailed', '%s not found in route %s', step, this._name, 500, 'fatal');
                        }
                    } else {
                        index++;
                        currentStep = this._steps[index];
                    }
                    if (_.isFinite(this._statistics.PENDING.STAGES[lastExecutedStep.name])) {
                        this._statistics.PENDING.STAGES[lastExecutedStep.name]--;
                    }
                    _.defaults(this._statistics.PENDING.STAGES, {
                        [currentStep.name]: 0,
                    });
                    this._statistics.PENDING.STAGES[currentStep.name]++;
                    (async () => {
                        try {
                            if (_.isFunction(onProgress)) {
                                await onProgress({
                                    lastExecutedStep,
                                    nextIndex: index,
                                    routeSize: this._steps.length,
                                    req: req,
                                    res: res,
                                });
                            }
                            lastExecutedStep = currentStep;
                            if (currentStep instanceof Controller) {
                                await currentStep.body.call(context, req, res, next, finish);
                            } else if (currentStep instanceof Route) {
                                const resSubroute = await currentStep.match(res, context);
                                next(resSubroute);
                            }
                        } catch (e) {
                            next(e); // is similar to finish(err)
                        }
                    })();
                }
            };
            _.defaults(this._statistics.PENDING.STAGES, {
                [currentStep.name]: 0,
            });
            this._statistics.PENDING.STAGES[currentStep.name]++;
            lastExecutedStep = currentStep;
            try {
                if (currentStep instanceof Controller) {
                    await currentStep.body.call(context, req, req, next, finish);
                } else if (currentStep instanceof Route) {
                    await currentStep.match(req, context);
                }
            } catch (e) {
                next(e);
            }
        });
    }

    private _run(): void {
        const maxParallel = Number.isFinite(this._maxParallel) && this._maxParallel >= 0 ? this._maxParallel : this._onHoldQueue.length;
        while (this._parallel < maxParallel && this._onHoldQueue.length > 0) {
            this._onHoldQueue.dequeue().runner();
        }
    }

}


export interface IRoutes {
    [name: string]: Route<any, any, any>;
}

export class Router {

    private readonly _routes: IRoutes;

    get routes(): IRoutes {
        return this._routes;
    }

    constructor() {
        this._routes = {};
    }

    addRoute<CONTEXT, INIT_REQ, FINAL_RES>(route: Route<CONTEXT, INIT_REQ, FINAL_RES>): this {
        this._routes[route.name] = route;
        return this;
    }

    getRoute<CONTEXT, INIT_REQ, FINAL_RES>(name: string): Route<CONTEXT, INIT_REQ, FINAL_RES> {
        return this._routes[name];
    }

}

export const defaultRouter = new Router();
