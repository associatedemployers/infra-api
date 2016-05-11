var cwd          = process.cwd(),
    mongoose     = require('mongoose'),
    winston      = require('winston'),
    chalk        = require('chalk'),
    _            = require('lodash'),
    normalize    = require(cwd + '/config/data-normalization'),
    respond      = require(cwd + '/handlers/response'),
    parseQuery   = require(cwd + '/lib/utilities/parse-query');

function convertCamel ( str ) {
  return str ? str.charAt(0).toLowerCase() + str.substring(1, str.length) : str;
}

function stripObject ( object, strip, mongooseObject ) {
  if ( !strip ) {
    return object;
  }

  var paths = strip.split(' ');

  paths.forEach(function ( path ) {
    if ( mongooseObject ) {
      object.set(path, undefined);
    } else {
      delete object[ path ];
    }
  });

  return object;
}

exports.getAll = function ( resourceName, populate, forceQuery, forceSort ) {
  var _populate = populate || '';

  return function ( req, res ) {
    winston.log('debug', chalk.dim(req.query));

    var Model = mongoose.model(resourceName),
        lowerCaseResource = convertCamel(resourceName);

    var query  = req.query ? parseQuery( req.query ) : req.query,
        _count = query._count,
        limit  = parseFloat(query.limit) || null,
        page   = parseFloat(query.page)  || 0,
        select = query.select || '',
        skip   = page * limit,
        sort   = query.sort ? query.sort : forceSort ? forceSort : { created: 1 };

    if ( forceQuery ) {
      query = _.merge(query, forceQuery);
    }

    if ( query._distinct === true ) {
      return Model.distinct({}, select).exec().then(items => {
        res.send( items );
      });
    }

    if ( query.ids ) {
      query._id = {
        $in: query.ids
      };

      delete query.ids;
    }

    if ( query.q && query.qKey ) {
      query[query.qKey] = {
        $regex: query.q,
        $options: 'i'
      };
    }

    var deleteQueryItems = [ 'limit', 'page', 'sort', 'select', '_count', 'q', 'qKey' ];

    deleteQueryItems.forEach(key => {
      delete query[key];
    });

    for ( var key in query ) {
      if ( query.hasOwnProperty(key) ) {
        var v = query[ key ];

        if ( v === 'exists' ) {
          query[key] = {
            $exists: true
          };
        } else if ( v === 'nexists' ) {
          query[key] = {
            $exists: false
          };
        }
      }
    }

    winston.log('debug', chalk.dim(query, select, limit, page, skip, JSON.stringify(sort)));

    if ( _count === true ) {
      var sendError = function ( err ) {
        respond.error.res( res, err, true );
      };

      return Model.count({}, function ( err, total ) {
        if ( err ) {
          sendError( err );
        }

        Model.count(query, function ( err, count ) {
          if ( err ) {
            sendError( err );
          }

          res.status(200).send({
            total: total,
            count: count
          });
        });
      });
    }

    Model
    .find( query )
    .sort( sort )
    .skip( Math.abs( skip ) )
    .limit( Math.abs( limit ) )
    .select( select )
    .populate( _populate )
    .exec(function ( err, records ) {
      if ( err ) {
        return respond.error.res( res, err, true );
      }

      var _records = records.map(function ( record ) {
        return record.toObject({ virtuals: true });
      });

      Model.count( query, function ( err, count ) {
        if ( err ) {
          return respond.error.res( res, err, true );
        }

        var norm = normalize[ lowerCaseResource ],
            regularNormalize = {
              meta: {
                totalRecords: count
              }
            };

        regularNormalize[ lowerCaseResource ] = _records;

        res.json( norm && typeof norm === 'function' ? norm( _records, regularNormalize.meta ) : regularNormalize );
      });
    });
  };
};

exports.getById = function ( resourceName, populate, select, strip, beforeVirtuals ) {
  var _populate = populate || '';

  return function ( req, res ) {
    var Model = mongoose.model(resourceName),
        lowerCaseResource = convertCamel(resourceName);

    var id = req.params.id;

    if ( !id ) {
      return respond.error.res( res, 'Please specify an id in the url.' );
    }

    Model.findById( id )
    .populate( _populate )
    .select( select )
    .exec(function ( err, record ) {
      if ( err ) {
        return respond.error.res( res, err, true );
      }

      if ( !record ) {
        return respond.code.notfound( res );
      }

      var _record = stripObject( stripObject( record, beforeVirtuals, true ).toObject({ virtuals: true }), strip );

      var norm = normalize[ lowerCaseResource ],
          regularNormalize = {};

      regularNormalize[ lowerCaseResource ] = _record;

      res.json( norm && typeof norm === 'function' ? norm( _record ) : regularNormalize );
    });
  };
};
