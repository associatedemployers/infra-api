var winston = require('winston'),
    chalk   = require('chalk');

module.exports = {
  options: {
    name: 'disconnect'
  },

  run: function () {
    var self = this;

    this.controller.removeClient( this.socket, this.clientId )
    .then(function () {
      winston.info(chalk.dim('Socket Server :: User Removed [', self.socket.request.connection.remoteAddress, ']'));
    })
    .catch(this.controller.__socketError);
  }
};
