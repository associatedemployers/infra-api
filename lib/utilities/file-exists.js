var fs = require('fs-extra');

module.exports = function ( path ) {
  try {
    return fs.statSync(process.cwd() + path).isFile();
  } catch ( err ) {
    return false;
  }
};
