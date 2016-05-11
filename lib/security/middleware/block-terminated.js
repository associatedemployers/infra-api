var moment = require('moment');

module.exports = function ( req, res, next ) {
  var term = req.session.user.terminatedOn;

  if ( term && moment().isAfter(term) ) {
    return res.status(401).send('Terminated users can not access this route.');
  }

  next();
};
