var _ = require("lodash"),
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
    var ret = null, donePromise = function (res) {
        setImmediate(function () {
            res instanceof Error ? ret.reject(res) : ret.resolve(res);
        });
    };
    if (arguments.length == 2) //match(routeName,req).then
        ret = when.defer(), done = donePromise, _this = null;
    else if (arguments.length == 3 && !_.isFunction(arguments[2])) //match(routeName,req,this).then
        ret = when.defer(), _this = done, done = donePromise;
    var route = _.isString(routeName) ? routes[routeName] : routeName;
    if (!_.isArray(route) || !route.length) {
        done(new ERR("invalidRoute", {r: routeName}));
        return;
    }
    route = _.clone(route);

    var fn = route.shift();
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
                tracer.fatal(e, "Unexpected Error");
                next(e);
            }
        }
    };
    try {
        fn.call(_this || fn, req, null, next, done);
    } catch (e) {
        e = new ERR({req: req}).use(e);
        next(e);
    }
};

module.exports = router;