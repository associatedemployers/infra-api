var _ = require('lodash');

/**
 * Gets the index of the item containing the same ObjectId
 * @param  {Array}           arr - Array of items
 * @param  {String|ObjectId} id
 * @param  {String}          key - Path to id in array
 * @return {Number}          Index of item
 */
function indexOfObjectId ( arr, id, key ) {
  if ( !id ) {
    return -1;
  }

  var _id = typeof id !== 'string' ? id.toString() : id;

  return _.findIndex(arr, function ( item ) {
    var v = key ? item[ key ] : item;
    return v.toString() === _id;
  });
}

module.exports = indexOfObjectId;
