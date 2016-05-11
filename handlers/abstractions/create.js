var respond = require('../response'),
    inflect = require('i')();

module.exports = options => {
  if ( !options || !options.model ) {
    throw new Error('Required options not passed');
  }

  var Model = options.model,
      modelName = inflect.camelize(Model.modelName, false);

  return (req, res) => {
    var payload = req.body[modelName],
        user    = req.session.user;

    req.modelName = modelName;

    if ( !payload ) {
      return respond.error.res(res, 'Invalid payload');
    }

    var data = payload;

    if ( options.mergeCompany && !user.isAdmin ) {
      data.company = user.company._id;
    }

    if ( options.mergeEmployee && user.isEmployee ) {
      data.employee = user._id;
    }

    var pendingRecord = new Model(data);

    pendingRecord.save().then(record => {
      var responseObject = {};
      responseObject[modelName] = record.toObject(options.toObjectOptions);
      res.status(201).send(responseObject);
    }).catch(respond.error.callback(res, true));
  };
};
