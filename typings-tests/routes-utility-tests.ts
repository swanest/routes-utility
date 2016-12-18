import * as router from "../index";

let controllerA: router.D.Controller = function controllerA(req: any, res: any, next: router.D.nextFn, done: router.D.doneFn) {
    next(this.specifiedContext + req, controllerC);
};

let controllerB: router.D.Controller = function controllerB(req: any, res: any, next: router.D.nextFn, done: router.D.doneFn) {
    next(res + "UpdatedB");
};

let controllerC: router.D.Controller = function controllerC(req: any, res: any, next: router.D.nextFn, done: router.D.doneFn) {
    next(res + "UpdatedC");
};

//Add routes
router
    .addRoute("test", controllerA, controllerB)
    .addRoute("test2", controllerA, controllerB, controllerC);

var test = (async function () {
    try {
        await router.match("test", "init");
    }
    catch (e) {
        const err: Error = e;
        console.log("err - await", err.message);
    }
})();

router.match("test2", "init").progress(function (p: router.D.Progression) {
    console.log("progress", p);
}).then(function (value: string) {
    console.log("FinalResult", value);
}).catch(function (error: Error) {
    console.error(error);
});

router.match("test2", "init", {specifiedContext: "givenContext"}).then(function (value: string) {
    console.log("FinalResult with given context", value);
}).catch(function (error: Error) {
    console.error(error.message);
});

router.match("test2", "init", function (output: any) {
    console.log("FinalResult callback", output);
}).match("test2", "init2")


