import {expect} from "chai";
import {Router, Route, Controller, defaultRouter} from '../src/index';
import * as _ from "lodash";
import * as When from "when";
import {CustomError} from 'sw-logger';

describe("Router", () => {

    it("handles errors", async function () {

        let controllerA = new Controller(async function A(req, res, next, done) {
            await Promise.reject(new Error('test'));
            // await test();
        });


        let controllerB = new Controller(async function B(req, res, next, done) {
            // await test();
            next({});
        });


        let controllerC = new Controller(async function C(req, res, next, done) {
            await Promise.reject(new Error('test'));
            // await test();
        });


        let routeA = new Route("testA", ...[controllerA]);
        let routeB = new Route("testB", ...[controllerB, controllerC]);
        let router = new Router();
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

    it("follows the journey", function (done) {
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
        let controllerA = new Controller<IContext,IReq,IReq,IReqExtended,IFinal>(function A(req, res, next, done) {
            if (!this.thisOnlyIsAccessible)
                throw Error("context not given");
            let nextRes = _.defaults(req, {stage: 0});
            nextRes.stage++;
            next(nextRes);
        });
        let controllerB = new Controller<IContext,IReq,IReqExtended,IReqExtended,IFinal>(function B(req, res, next, done) {
            if (!this.thisOnlyIsAccessible)
                throw Error("context not given");
            let nextRes = _.defaults(req, {stage: 0});
            nextRes.stage++;
            next(nextRes, "D");
        });
        let controllerC = new Controller<IContext,IReq,IReqExtended,IReqExtended,IFinal>(function C(req, res, next, done) {
            if (!this.thisOnlyIsAccessible)
                throw Error("context not given");
            let nextRes = _.defaults(req, {stage: 0});
            nextRes.stage++;
            next(nextRes);
        });
        let controllerD = new Controller<IContext,IReq,IReqExtended,IReqExtended,IFinal>(function D(req, res, next, done) {
            if (!this.thisOnlyIsAccessible)
                throw Error("context not given");
            let nextRes = _.defaults(req, {stage: 0});
            nextRes.stage++;
            next(nextRes);
        });
        let route = new Route("test", ...[controllerA, controllerB]);
        expect(route.addController.bind(controllerB)).to.throw;
        route.addController(controllerC);
        route.addController(controllerD);

        let router = defaultRouter;
        router.addRoute(route);
        expect(router.routes["test"]).to.be.not.null;
        let progressions: any[] = [];

        router.getRoute<IContext,IReq,IFinal>("test").match({
            inputOne: 1,
            inputTwo: "hello"
        }, {thisOnlyIsAccessible: true}, function (progression) {
            expect(route.delta(route.statistics).timestamp_ms).to.equal(0);
            progressions.push(progression);
            return When<null>(null).delay(100);
        }).then(function (res) {
            expect(route.delta().timestamp_ms).to.be.above(200);
            expect(res).to.deep.equal({inputOne: 1, inputTwo: 'hello', stage: 3});
            expect(progressions).to.have.lengthOf(2);
            done();
        }).catch(done);
    });


});