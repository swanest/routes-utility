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
        donePromise = function (res) {
            setImmediate(function () {
                res instanceof Error ? def.reject(res) : def.resolve(res);
            });
        },
        route = _.isString(routeName) ? routes[routeName] : routeName,
        fn;

    if (arguments.length == 2) //match(routeName,req).then
        def = when.defer(), prom = def.promise, done = donePromise, _this = null;
    else if (arguments.length == 3 && !_.isFunction(arguments[2])) //match(routeName,req,this).then
        def = when.defer(), prom = def.promise, _this = done, done = donePromise;

    if (!_.isArray(route) || !route.length)
        done(new ERR("invalidRoute", {r: routeName}));
    else {
        route = _.clone(route);
        fn = route.shift();
        var next = function (res, controller) {
            if (res instanceof Error)
                done(new ERR().use(res));
            else if (!route.length)
                done(res);
            else {
                try {
                    if (controller != void 0) { //Jump to a specific controller
                        while (controller !== fn && route.length)
                            fn = route.shift();
                    }
                    else
                        fn = route.shift();
                    fn.call(_this || fn, req, res, next, done);
                } catch (e) {
                    e = new ERR({req: req}).use(e);
                    next(e);
                }
            }
        };
        try {
            fn.call(_this || fn, req, req, next, done);
        } catch (e) {
            e = new ERR({req: req}).use(e);
            next(e);
        }
    }
    return prom;
};

module.exports = router;