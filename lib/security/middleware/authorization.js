/*
  Authorization middleware
*/

var winston = require('winston'),
    chalk   = require('chalk'),
    Promise = require('bluebird'), // jshint ignore:line
    _       = require('lodash');

var session        = require('../session'),
    UserPermission = require(process.cwd() + '/models/user-permission'),
    respond        = require(process.cwd() + '/handlers/response');

var generator = module.exports = function ( options ) {
  // Defaults
  options = options || {};

  if( !options.allow ) {
    winston.log('debug', chalk.dim('options.allow is not specified; will use defaults'));
  }

  options.allow = ( options.allow ) ? ( typeof options.allow === 'string' ) ? [ options.allow ] : options.allow : [ 'admin' ];

  return function ( req, res, next ) {
    var _session = req.session,
        _user    = _session.user,
        base     = req.baseUrl.replace('/api', ''),
        path     = base + req.path,
        method   = req.method.toLowerCase();

    var pathPattern = path.replace(/[a-f\d]{24}/i, ':id');

    pathPattern = new RegExp(pathPattern.split('/').filter(function ( v ) {
      return v.length > 0;
    }).map(function ( v, index ) {
      var prefix = ( index === 0 ) ? '(\\/' : '(';
      return prefix + v + '*.\\/)';
    }).join(''), 'gi');

    if( !_user.permissions || !_.isArray( _user.permissions ) ) {
      return res.status(401).send('You do not have permissions');
    }

    if( !_.contains( options.allow, _user.type ) ) {
      return res.status(401).send(_user.type + 's are not allowed to access ' + path);
    }

    UserPermission.populate(_user.permissions, { path: 'group' }, function ( err, permissions ) {
      if( err ) {
        return respond.error.res( res, err, true );
      }

      var permission = _.find(permissions, function ( userPermission ) {

        var endpointExists = userPermission.group.endpoints.reduce(function ( exists, endpoint ) {
          if( endpoint.charAt( endpoint.length - 1 ) !== '/' ) {
            endpoint += '/';
          }

          return ( exists === true ) ? true : pathPattern.test( endpoint );
        }, false);

        return ( userPermission.type === method && endpointExists );
      });

      if( !permission ) {
        return res.status(401).send('You do not have the proper method permission to ' + method.toUpperCase() + ' "' + path + '"' );
      }

      req.permission = permission;

      next();
    });
  };
};
