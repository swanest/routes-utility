import {expect} from "chai";
import {Router, Route, Controller} from '../src/index';
import * as _ from "lodash";
import * as When from "when";
import {CustomError} from 'sw-logger';

describe("Router", () => {

    it("follows the journey", function (done){
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

        let router = new Router();
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