/*
  Permission middleware
*/

var _ = require('lodash'),
    respond = require(process.cwd() + '/handlers/response');

/**
 * Generates a permission middleware function
 *
 * @param  {String|Array} requiredPermissions String or array of required permissions
 * @return {Function}                         Middleware for required permissions
 */
module.exports = function generator ( requiredPermissions ) {
  return function ( req, res, next ) {
    if ( process.env.environment === 'test' ) {
      return next();
    }

    if ( !req.session || !req.session.user || !req.session.user.permissions ) {
      return respond.code.unauthorized(res, 'You are not authorized to access that resource.');
    }

    var permissions = req.session.user.permissions;

    var findPermissionInArray = function ( name ) {
      return _.find(permissions, { name: name });
    };

    var permission = _.isArray(requiredPermissions) ? !_.find(requiredPermissions, function ( perm ) {
      return !findPermissionInArray(perm);
    }) : findPermissionInArray(requiredPermissions);

    if ( !permission ) {
      var requiredPermissionString = _.isArray(requiredPermissions) ? requiredPermissions.join(', ') : requiredPermissions;
      return respond.code.unauthorized(res, 'You are not authorized to access this resource. This requires the following permissions: ' + requiredPermissionString );
    }

    next();
  };
};
