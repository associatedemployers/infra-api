module.exports = function ( req ) {
  var query = {};

  if ( !req.session.user.isAdmin ) {
    query.company = req.session.user.company;
  }

  if ( req.session.user.isEmployee ) {
    query.employee = req.session.user._id;
  }

  return query;
};
