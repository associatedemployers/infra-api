var winston = require('winston'),
    chalk   = require('chalk');

var session = require(process.cwd() + '/lib/security/session'),
    SyncController = require(process.cwd() + '/lib/sync/sync-controller');

module.exports = {
  options: {
    name: 'init-sync'
  },

  run: function ( eventData ) {
    var self = this;

    var handleError = function ( err, nt ) {
      if ( !nt ) winston.error(err.stack);
      self.socket.emit('sync-error', err.toString());
    };

    this.socket.emit('sync-event', { msg: 'Server received request. Starting sync...' });

    session.get(eventData.auth, 'Session').then(function ( userSession ) {
      if ( !userSession ) {
        return handleError('No session found for token. Please try logging in again.', true);
      }

      userSession.user.hasPermission('INIT_SYNC', function ( err, hasPermission ) {
        if ( err ) {
          return handleError(err);
        }

        if ( !hasPermission ) {
          return handleError('You do not have appropriate permissions to request this action.', true);
        }

        self.socket.emit('sync-event', { msg: 'Authenticated.' });

        var syncController = new SyncController();

        syncController.eventManager.on('log', handleLog.bind(self.socket));

        return syncController.run().then(function ( results ) {
          self.socket.emit('sync-event', { msg: 'ᕙ(^▿^-ᕙ) Done syncing.', done: true });
        }).catch(handleError);
      });
    }).catch(handleError);
  }
};

function handleLog ( log ) {
  if ( log.type === 'status' ) {
    this.emit('sync-event', { msg: log.message, success: log.success });
  }
}
