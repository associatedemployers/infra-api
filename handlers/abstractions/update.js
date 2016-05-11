var respond = require('../response'),
    mongoose = require('mongoose'),
    inflect = require('i')(),
    _ = require('lodash');

var authorized = require('./authorize-with');

module.exports = options => {
  if ( !options || !options.model ) {
    throw new Error('Required options not passed');
  }

  var Model = options.model,
      modelName = inflect.camelize(Model.modelName, false),
      authorizeWith = options.authorizeWith;

  return (req, res) => {
    var id      = req.params[options.paramsIdKey || 'id'],
        payload = req.body[modelName],
        user    = req.session.user;

    req.modelName = modelName;

    if ( !id || !mongoose.Types.ObjectId.isValid(id) ) {
      return respond.error.res(res, 'Invalid id');
    }

    if ( !payload ) {
      return respond.error.res(res, 'Invalid payload');
    }

    Model.findById(id).exec().then(record => {
      if ( !record ) {
        return respond.code.notfound(res);
      }

      return authorized.call(req, authorizeWith, record, user).then(isAuthorized => {
        if ( !isAuthorized ) {
          return respond.code.unauthorized(res);
        }

        if ( options.reservedKeys && !user.isAdmin ) {
          options.reservedKeys.forEach(key => {
            if ( payload[key] ) {
              delete payload[key];
            }
          });
        }

        _.merge(record, payload);

        return record.save();
      }).then(savedRecord => {
        var responseObject = {};
        responseObject[modelName] = savedRecord.toObject(options.toObjectOptions);
        res.status(200).send(responseObject);
      });
    }).catch(respond.error.callback(res, true));
  };
};
