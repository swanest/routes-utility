var _ = require("lodash"),
    when = require("when"),
    ERR = require("logger").CustomError,
    router = {},
    routes = {};

router.addRoute = _.rest(function addRoute(name, steps) {
    routes[name] = steps;
});

router.getRoutes = function getRoutes() {
    return routes;
};

//available calls :
//match(routeName,req).then
//match(routeName,req,this).then
//match(routeName,req,cb,[this])

router.match = function matchRoute(routeName, req, done, _this) {
    var def = null,
        prom = null,
        progress = _.noop, //only compatible with promise-style
        donePromise = function (res) {
            setImmediate(function () {
                res instanceof Error ? def.reject(res) : def.resolve(res);
            });
        },
        route = _.isString(routeName) ? routes[routeName] : routeName,
        i = 0,
        fn,
        prevFnName;

    if (arguments.length == 2) //match(routeName,req).then
        def = when.defer(), prom = def.promise, done = donePromise, progress = def.notify, _this = null;
    else if (arguments.length == 3 && !_.isFunction(arguments[2])) //match(routeName,req,this).then
        def = when.defer(), prom = def.promise, _this = done, done = donePromise, progress = def.notify;

    if (!_.isArray(route) || !route.length)
        done(new ERR("invalidRoute", {r: routeName}));
    else {
        fn = route[i];

        var next = function (res, controller) {
            if (res instanceof Error)
                done(new ERR().use(res));
            else if (i == route.length - 1) //finish
                done(res);
            else {
                try {
                    if (controller != void 0) { //Jump to a specific controller
                        while (controller !== fn && i < route.length - 1)
                            i++, fn = route[i];
                    }
                    else
                        i++, fn = route[i];

                    progress({
                        prevFnName: prevFnName,
                        i: i,
                        n: route.length,
                        req: req,
                        res: res
                    });

                    prevFnName = fn.name;
                    fn.call(_this || fn, req, res, next, done);
                } catch (e) {
                    next(new ERR({req: req}).use(e));
                }
            }
        };

        try {
            prevFnName = fn.name;
            fn.call(_this || fn, req, req, next, done);
        } catch (e) {
            next(new ERR({req: req}).use(e));
        }

    }
    return prom;
};

module.exports = router;