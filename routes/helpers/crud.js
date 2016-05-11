var express = require('express'),
    inflect = require('i')(),
    path = require('path'),
    winston = require('winston'),
    chalk = require('chalk'),
    _ = require('lodash');

var sessionMiddlware = require(path.join(process.cwd(), 'lib/security/middleware/session'));

var optionDefaults = {
  useSession: true,
  sessionModel: 'Session',
  basePathPrefix: 'api',
  routes: [{
    action: 'get',
    path: '/',
    method: 'fetchAll'
  }, {
    action: 'get',
    path: '/:id',
    method: 'fetchById'
  }, {
    action: 'post',
    path: '/',
    method: 'create'
  }, {
    action: 'put',
    path: '/:id',
    method: 'update'
  }, {
    action: 'delete',
    path: '/:id',
    method: 'del'
  }]
};

function getModelNameVariants (modelName) {
  var u = inflect.underscore(modelName);

  return {
    class: modelName,
    camel: inflect.pluralize(inflect.camelize(u, false)),
    dasherized: inflect.dasherize(u),
    dasherizedPlural: inflect.pluralize(inflect.dasherize(u))
  };
}

function getBaseRoutePath (prefix, modelNames) {
  var p = modelNames.dasherizedPlural,
      buildPath = (pre, bp) => '/' + path.join(pre, bp),
      basePaths = _.isArray(prefix) ? prefix : [ prefix ],
      paths = [];

  basePaths.map(base => {
    paths.push(buildPath(base, p));
    if ( p !== modelNames.camel ) {
      paths.push(buildPath(base, modelNames.camel));
    }
  });

  return paths;
}

module.exports = function (app, modelName, options) {
  var _options = _.assign(optionDefaults, options || {}),
      modelNames = getModelNameVariants(modelName);

  try {
    var handler = require(path.join(process.cwd(), 'handlers', modelNames.dasherized));
  } catch (e) {
    winston.error(chalk.bgRed('Unable to find handler for route:', modelNames.class));
  }

  var router = express.Router(),
      baseRoutePath = _options.baseRoutePath || getBaseRoutePath(_options.basePathPrefix, modelNames);

  if ( _options.useSession ) {
    router.use(sessionMiddlware(_options.sessionModel));
  }

  _options.routes.forEach(route => {
    var middleware = route.middleware || [],
        args = [ route.path, ...middleware, handler[route.method] ];

    router[route.action](...args);
  });

  app.use(baseRoutePath, router);
};
