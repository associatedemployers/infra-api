var Promise = require('bluebird');

module.exports = function ( modelArray, query ) {
  if ( !modelArray || !modelArray.length || !query || typeof query !== 'object' ) {
    throw new Error('Expected modelArray and query.');
  }

  return Promise.map(modelArray, modelName => {
    var Model = require(process.cwd() + '/models/' + modelName);

    if ( !Model ) {
      throw new Error('No model found for ' + modelName);
    }

    Model.remove(query).exec();
  });
};
