var rand = require('./random-number');
var firstNames = [
  'Johnny',
  'Jack',
  'James',
  'Scott',
  'Frankie',
  'Jackie',
  'Tracy',
  'Ruth',
  'Bonnie',
  'Herbert',
  'Dogbert',
  'Homer',
  'Greg',
  'Bender',
  'Leela',
  'Fry',
  'Amy',
  'Scruffy'
];

module.exports = function () {
  return firstNames[rand(0, firstNames.length - 1)];
};
