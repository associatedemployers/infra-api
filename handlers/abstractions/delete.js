var respond = require('../response'),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    removeRecords = require('../../lib/utilities/remove-records');

_.mixin(require('lodash-deep'));

var authorized = require('./authorize-with');

module.exports = options => {
  if ( !options || !options.model ) {
    throw new Error('Required options not passed');
  }

  var Model = options.model,
      authorizeWith = options.authorizeWith;

  return (req, res) => {
    var id   = req.params[options.paramsIdKey || 'id'],
        user = req.session.user;

    if ( !id || !mongoose.Types.ObjectId.isValid(id) ) {
      return respond.error.res(res, 'Invalid id');
    }

    Model.findById(id).exec().then(record => {
      if ( !record ) {
        return respond.code.notfound(res);
      }

      return authorized.call(req, authorizeWith, record, user).then(isAuthorized => {
        if ( !isAuthorized ) {
          return respond.code.unauthorized(res);
        }

        var removeRecord = () => record.remove(),
            dependentRecords = options.removeDependentRecords,
            matchObject;

        if ( dependentRecords && options.matchDependentRecords.key ) {
          var matchKey = options.matchDependentRecords.key,
              matchValuePath = options.matchDependentRecords.valuePath;

          matchObject = {};
          matchObject[matchKey] = record[matchValuePath];
        }

        var recordPromise = dependentRecords ?
          removeRecords(dependentRecords, matchObject).then(removeRecord) :
          removeRecord();

        return recordPromise.then(() => {
          res.status(204).end();
        });
      });
    }).catch(respond.error.callback(res, true));
  };
};
