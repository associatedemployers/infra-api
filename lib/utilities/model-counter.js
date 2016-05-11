/*
  Model Counter Utility
*/

var winston  = require('winston').loggers.get('default'),
    chalk    = require('chalk'),
    mongoose = require('mongoose'),
    Promise  = require('promise'); // jshint ignore:line

var connection = require(process.cwd() + '/config/mongoose').init();

exports.countOne = countOne;

exports.count = function ( models ) {
  return new Promise(function ( resolve, reject ) {

    if( !models ) {
      reject('No models specified');
    }

    var promises = [];

    models.forEach(function ( name ) {
      promises.push( countOne( name ) );
    });

    Promise.all( promises ).then( resolve ).catch( reject );
  });
};

function countOne ( modelName, query ) {
  query = query || {};

  return new Promise(function ( resolve, reject ) {
    var m = connection.model(modelName);

    if( !m ) {
      reject(0);
    } else {
      m.count(query, function ( err, count ) {
        if( err ) {
          return reject( err );
        }

        var o = {};

        o[ modelName ] = count;

        resolve( o );
      });
    }

  });
}
