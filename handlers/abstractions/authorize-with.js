var Promise = require('bluebird'),
    _ = require('lodash');

module.exports = function ( authorizeWith, record, user ) {
  if ( !authorizeWith ) {
    return true;
  }

  var lhsp = authorizeWith.recordPath ? authorizeWith.recordPath : authorizeWith,
      rhsp = authorizeWith.userPath ? authorizeWith.userPath : authorizeWith,
      lhsv = _.toString(_.deepGet(record, lhsp)),
      rhsv = _.toString(_.deepGet(user, rhsp)),
      result = lhsv === rhsv;

  return !result && authorizeWith.altAuthMethod ? authorizeWith.altAuthMethod.call(this, lhsv, user) : Promise.resolve(result);
};
