/*
  is-admin middleware
*/

var respond = require(process.cwd() + '/handlers/response');

/**
 * Is-admin middleware identity
 *
 * Simple middleware function to kick back a 401 for non-admin access
 */
module.exports = function ( req, res, next ) {
  if ( req.session.user.isAdmin ) {
    return next();
  } else {
    return respond.code.notauthorized(res, 'You must be an admin to access that resource or action.');
  }
};
