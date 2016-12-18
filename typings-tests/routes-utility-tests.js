"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const router = require("../index");
let controllerA = function controllerA(req, res, next, done) {
    next(this.specifiedContext + req, controllerC);
};
let controllerB = function controllerB(req, res, next, done) {
    next(res + "UpdatedB");
};
let controllerC = function controllerC(req, res, next, done) {
    next(res + "UpdatedC");
};
//Add routes
router
    .addRoute("test", controllerA, controllerB)
    .addRoute("test2", controllerA, controllerB, controllerC);
var test = (function () {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield router.match("test", "init");
        }
        catch (e) {
            const err = e;
            console.log("err - await", err.message);
        }
    });
})();
router.match("test2", "init").progress(function (p) {
    console.log("progress", p);
}).then(function (value) {
    console.log("FinalResult", value);
}).catch(function (error) {
    console.error(error);
});
router.match("test2", "init", { specifiedContext: "givenContext" }).then(function (value) {
    console.log("FinalResult with given context", value);
}).catch(function (error) {
    console.error(error.message);
});
router.match("test2", "init", function (output) {
    console.log("FinalResult callback", output);
}).match("test2", "init2");
