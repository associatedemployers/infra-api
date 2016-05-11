/*
  Session middleware
*/

// var winston = require('winston'),
//     chalk   = require('chalk'),
//     Promise = require('bluebird'), // jshint ignore:line
//     _       = require('lodash');

var session = require('../session'),
    respond = require(process.cwd() + '/handlers/response');
    // jwt     = require('jwt-simple');

/**
 * Generates a session middleware function
 * @param {String}    modelName      Model to use
 * @param {Boolean}   refreshes      Should refresh the session?
 * @param {String}    allow          Allow userTypes
 * @param {Boolean}   esRequired     Is extended-security[auth] required?
 * @param {Boolean}   allowFromQuery Allow session token from query parameter
 * @return {Function}                Generated middleware
 */
module.exports = function ( modelName, refreshes, allow, esRequired, allowFromQuery ) {
  return function ( req, res, next ) {
    var token = allowFromQuery === true && req.query ? req.header('X-API-Token') || req.query.token : req.header('X-API-Token'),
        modelName = modelName || 'Session',
        refreshes = refreshes === undefined ? true : refreshes;

    if ( !token ) {
      return res.status(401).send('This resource requires the "X-API-Token" header with a fresh and relevant session\'s token');
    }

    var allErrors = function ( err ) {
      return respond.error.res( res, err, true );
    };

    session.get( token ).then(function ( userSession ) {
      if ( !userSession ) {
        return res.status(401).send('The token you supplied could not be found - The session is either expired or non-existant');
      }

      if ( userSession.isExpired ) {
        return res.status(401).send('Your session has expired');
      }

      if ( allow && userSession.data.userType && allow.split(' ').indexOf(userSession.data.userType) < 0 ) {
        return res.status(401).send('User type not allowed');
      }

      if ( esRequired && userSession.esAuthenticated !== true ) {
        return res.status(401).send('This route requires extended-security authentication');
      }

      var attachAndNext = function () {
        req.session = userSession;
        req.session.user.isAdmin = req.session.user.constructor.modelName === 'AdminUser';
        req.session.user.isEmployee = req.session.user.constructor.modelName === 'Employee';
        next();
      };

      if( refreshes ) {
        userSession.refresh().then( attachAndNext );
      } else {
        attachAndNext();
      }
    }).catch( allErrors );
  };
};
