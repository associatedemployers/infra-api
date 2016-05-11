/*
  Client parser middleware
*/

var //winston = require('winston'),
    //chalk   = require('chalk'),
    //Promise = require('bluebird'), // jshint ignore:line
    _       = require('lodash');

var //session = require('../session'),
    respond = require(process.cwd() + '/handlers/response'),
    getPath = require(process.cwd() + '/lib/utilities/get-path');

var indexOfObjectId = require(process.cwd() + '/lib/utilities/find-by-objectid');

/**
 * Generates a client parser middleware function
 *
 * @param  {String}   paramPath  Path to parameter to restrict
 * @param  {String}   clientPath Path to field to restrict by
 * @return {Function}
 */
module.exports = function ( paramPath, clientPath, enforceAdmin ) {
  return function ( req, res, next ) {
    var requester = req.session.user;

    if ( !enforceAdmin && requester.isAdmin ) {
      return next();
    }

    var param     = getPath.call(req.params, paramPath),
        client    = getPath.call(requester.toObject ? requester.toObject() : requester, clientPath),
        test      = param && client ? _.isArray(client) ? indexOfObjectId(client, param) > -1 : param.toString() === client.toString() : false;

    if ( !test ) {
      return respond.code.unauthorized(res, 'You are not authorized to access resource with ' + paramPath + ' of ' + client.toString() );
    }

    next();
  };
};
