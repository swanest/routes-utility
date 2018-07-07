import { expect } from 'chai';
import * as _ from 'lodash';
import { CustomError, Logger } from 'sw-logger';
import { Controller, defaultRouter, IProgression, Route, Router } from '../src/';

const tracer = new Logger();

describe('Router', () => {

    it('handles errors', async function () {
        const controllerA = new Controller(async function A(req, res, next, done) {
            await Promise.reject(new Error('test'));
        });
        const controllerB = new Controller(async function B(req, res, next, done) {
            next({});
        });
        const controllerC = new Controller(async function C(req, res, next, done) {
            await Promise.reject(new Error('test'));
            // await test();
        });
        const routeA = new Route('testA', ...[controllerA]);
        const routeB = new Route('testB', ...[controllerB, controllerC]);
        const router = new Router();
        router.addRoute(routeA).addRoute(routeB);
        await routeA.match({}, {}).then(function () {
            throw new Error('not expected');
        }).catch(function (e: Error) {
            expect(e.message).to.equal('test');
        });
        await routeB.match({}, {}).then(function () {
            throw new Error('not expected');
        }).catch(function (e: Error) {
            expect(e.message).to.equal('test');
        });
    });

    it('follows the journey', async function () {
        this.timeout(3000);

        interface IContext {
            thisOnlyIsAccessible: boolean
        }

        interface IReq {
            inputOne: number;
            inputTwo: string;
        }

        interface IReqExtended {
            inputOne: number;
            inputTwo: string;
            stage: number;
        }

        interface IFinal {
            output: string
        }

        const controllerA = new Controller<IContext, IReq, IReq, IReqExtended, IFinal>(function A(req, res, next, done) {
            if (!this.thisOnlyIsAccessible)
                throw Error('context not given');
            let nextRes = _.defaults(req, {stage: 0});
            nextRes.stage++;
            next(nextRes);
        });
        const controllerB = new Controller<IContext, IReq, IReqExtended, IReqExtended, IFinal>(function B(req, res, next, done) {
            if (!this.thisOnlyIsAccessible)
                throw Error('context not given');
            let nextRes = _.defaults(req, {stage: 0});
            nextRes.stage++;
            next(nextRes, 'D');
        });
        const controllerC = new Controller<IContext, IReq, IReqExtended, IReqExtended, IFinal>(function C(req, res, next, done) {
            if (!this.thisOnlyIsAccessible)
                throw Error('context not given');
            let nextRes = _.defaults(req, {stage: 0});
            nextRes.stage++;
            next(nextRes);
        });
        const controllerD = new Controller<IContext, IReq, IReqExtended, IReqExtended, IFinal>(function D(req, res, next, done) {
            if (!this.thisOnlyIsAccessible)
                throw Error('context not given');
            let nextRes = _.defaults(req, {stage: 0});
            nextRes.stage++;
            next(nextRes);
        });
        const route = new Route('test', ...[controllerA, controllerB]);
        expect(route.addController.bind(controllerB)).to.throw;
        route.addController(controllerC);
        route.addController(controllerD);
        defaultRouter.addRoute(route);
        expect(defaultRouter.routes['test']).to.be.not.null;
        const progressions: any[] = [];
        const routeResult = await defaultRouter.getRoute<IContext, IReq, IFinal>('test').match({
            inputOne: 1,
            inputTwo: 'hello',
        }, {thisOnlyIsAccessible: true}, async function (progression) {
            expect(route.delta(route.statistics).timestamp_ms).to.below(2);
            progressions.push(progression);
            await new Promise(resolve => setTimeout(resolve, 100));
        });
        expect(route.delta().timestamp_ms).to.be.above(100);
        expect(routeResult).to.deep.equal({inputOne: 1, inputTwo: 'hello', stage: 3});
        expect(progressions).to.have.lengthOf(2);
    });


    it('follows the journey with subroutes', async function () {
        this.timeout(3000);
        const route = new Route('ola-route',
            new Controller(function A(req: any, res: any, next, done) {
                req.first = true;
                next(req);
            }), new Route('sub-route',
                new Controller(function B(req: any, res, next, done) {
                    req.second = true;
                    next(req);
                }),
                new Controller(function C(req: any, res, next, done) {
                    req.third = true;
                    next(req);
                })),
            new Controller(function D(req: any, res: any, next, done) {
                req.fourth = true;
                next(req);
            }));
        defaultRouter.addRoute(route);
        const progressions: Array<IProgression<any>> = [];
        const res = await route.match({}, {}, function (progression) {
            progressions.push(progression);
        });
        expect(progressions).to.have.lengthOf(2);
        expect(res).to.have.keys('first', 'second', 'third', 'fourth');
    });


    it('follows the journey with done() in sub-route', async function () {
        this.timeout(3000);
        const route = new Route('ola-route',
            new Controller(function A(req: any, res: any, next, done) {
                req.first = true;
                next(req);
            }), new Route('sub-route',
                new Controller(function B(req: any, res, next, done) {
                    req.second = true;
                    done(req); // !
                }),
                new Controller(function C(req: any, res, next, done) {
                    req.third = true;
                    next(req);
                })),
            new Controller(function D(req: any, res: any, next, done) {
                req.fourth = true;
                next(req);
            }));
        defaultRouter.addRoute(route);
        const res = await route.match({}, {});
        expect(res).to.have.keys('first', 'second', 'fourth');
    });


    it('follows the journey with error in sub-route', async function () {
        this.timeout(3000);
        const route = new Route('ola-route', new Controller(function A(req: any, res: any, next, done) {
            req.first = true;
            next(req);
        }), new Route('sub-route', new Controller(function B(req: any, res, next, done) {
            throw new CustomError('euh');
        })));
        defaultRouter.addRoute(route);
        let err: any;
        try {
            const res = await route.match({}, {});
        } catch (e) {
            err = e;
        }
        expect(err).not.to.eql(null);
        expect(err.codeString).to.eql('euh');
    });

});