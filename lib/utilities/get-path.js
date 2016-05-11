var _ = require('lodash');

module.exports = getPathValue;

function getPathValue ( paths ) {
  paths = ( _.isArray( paths ) ) ? paths : paths.split('.');

  var rValue,
      obj = this;

  var getFrom = function ( pathArray ) {
    var recursive = _.clone( obj ),
        ret;

    pathArray.forEach(function ( subPath, index ) {
      if( ret !== undefined ) {
        return;
      }

      if( subPath === '$' ) {
        var deep = pathArray[ index + 1 ];

        ret = ( !_.isArray( recursive ) ) ? null : ( deep ) ? _.map(recursive, pathArray[ index + 1 ]): recursive;
        return;
      }

      recursive = ( recursive.hasOwnProperty( subPath ) ) ? recursive[ subPath ] : {};
    });

    var returnValue = ( ret ) ? ret : recursive;

    return ( _.isUndefined( returnValue ) ) ? null : returnValue;
  };

  return getFrom( paths );
}
