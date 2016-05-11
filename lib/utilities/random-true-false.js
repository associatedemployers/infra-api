var rand = require('./random-number');

module.exports = function () {
  return !!rand(0, 1);
};
