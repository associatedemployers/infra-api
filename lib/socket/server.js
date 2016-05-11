/*
  socket.io server & controller
*/

var winston  = require('winston'),
    chalk    = require('chalk'),
    cluster  = require('cluster'),
    globSync = require('glob').sync,
    Promise  = require('bluebird'), // jshint ignore:line
    mongoose = require('mongoose'),
    _        = require('lodash');

var io           = require('socket.io'),
    SocketClient = require(process.cwd() + '/models/socket-client');

require(process.cwd() + '/config/mongoose').init();

module.exports = SocketServer;

function SocketServer ( server ) {
  winston.info(chalk.dim('Socket Server :: Setting Up Connection'));
  var connection = io(server);

  this.connection = connection;
  this.socketConnections = [];

  var self = this;

  winston.info(chalk.dim('Socket Server :: Booted Socket Server'));

  connection.sockets.on('connection', function ( clientSocket ) {
    winston.info(chalk.dim('Socket Server :: User Connected [', clientSocket.request.connection.remoteAddress, ']'));

    var uId = mongoose.Types.ObjectId();

    self.__loadClientEvents(clientSocket, uId);
    self.addClient(clientSocket, uId)
    .then(function () {
      winston.info(chalk.dim('Socket Server :: User Added [', clientSocket.request.connection.remoteAddress, ']'));
    })
    .catch(self.__socketError);
  });
}

/**
 * Loads event managers/listeners on a client socket
 * @private
 * @param {Object} socket
 * @param {Object} id
 */
SocketServer.prototype.__loadClientEvents = function ( socket, id ) {
  var self          = this,
      eventManagers = globSync(process.cwd() + '/lib/socket/event-managers/*.js').map(require);

  var context = {
    socket:     socket,
    clientId:   id,
    controller: this
  };

  eventManagers.forEach(function ( eventManager ) {
    socket.on(eventManager.options.name, eventManager.run.bind( context ));
  });

  winston.info(chalk.dim('Socket Server :: Registered', eventManagers.length, 'Events for Client ' + id));
};

SocketServer.prototype.clientExists = function ( socket ) {
  return !!_.find(this.socketConnections, function ( client ) {
    return socket.request.connection.remoteAddress === client.socket.request.connection.remoteAddress;
  });
};

/**
 * Adds a client to the server
 * @param {Object}   socket
 * @param {ObjectId} id
 * @return {Promise}
 */
SocketServer.prototype.addClient = function ( socket, id ) {
  this.socketConnections.push({
    id:     id,
    socket: socket
  });

  return new Promise(function ( resolve, reject ) {
    var sc = new SocketClient({
      _id: id,
      ip:  socket.request.connection.remoteAddress
    });

    sc.save(function ( err, socketClient ) {
      if ( err ) {
        return reject( err );
      }

      resolve( socketClient );
    });
  });
};

/**
 * Removes a client from the server
 * @param {Object}   socket
 * @param {ObjectId} id
 * @return {Promise}
 */
SocketServer.prototype.removeClient = function ( socket, id ) {
  var r    = _.pull(this.socketConnections, { id: id }),
      self = this,
      cb   = this.removedClient;

  return new Promise(function ( resolve, reject ) {
    SocketClient.findByIdAndRemove(id, function ( err, removed ) {
      if ( err ) {
        return reject( err );
      }

      if ( cb && typeof cb === 'function' ) {
        cb.call(self, r);
      }

      resolve( removed );
    });
  });
};

/**
 * Error handler - used by private events and functions
 * @private
 * @param  {Object} err
 */
SocketServer.prototype.__socketError = function ( err ) {
  winston.error(chalk.bgRed(err.stack));
};
