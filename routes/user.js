var express     = require('express'),
    userHandler = require('../handlers/user');

var sessionMiddleware = require('../lib/security/middleware/session'),
    // clientParserMiddleware = require('../lib/security/middleware/client-parser'),
    requiresPermission = require('../lib/security/middleware/permission');

module.exports = function ( app ) {
  var userRouter = express.Router(),
      userUtilityRouter = express.Router();

  userRouter.use( sessionMiddleware('Session') );

  userRouter.get('/', requiresPermission('VIEW_USER'), userHandler.fetchAll);
  userRouter.get('/:id', function ( req, res, next ) {
    if ( req.session.user._id.toString() === req.params.id ) {
      return next();
    }

    requiresPermission('VIEW_USER').apply(this, arguments);
  }, userHandler.fetchById);
  userRouter.post('/', requiresPermission('CREATE_USER'), userHandler.create);
  userRouter.put('/:id', function ( req, res, next ) {
    if ( req.session.user._id.toString() === req.params.id ) {
      return next();
    }

    requiresPermission('EDIT_USER').apply(this, arguments);
  }, userHandler.update);
  userRouter.delete('/:id', requiresPermission('DELETE_USER'), userHandler.del);

  userUtilityRouter.post('/login', userHandler.login);
  userUtilityRouter.get('/exists/:username', userHandler.checkUsername);
  userUtilityRouter.get('/activate/:id', userHandler.getActivation);
  userUtilityRouter.post('/activate/:id', userHandler.activateAccount);
  userUtilityRouter.post('/send-forgot-link', userHandler.sendForgotLink);
  userUtilityRouter.post('/reset-password/:resetToken', userHandler.resetPassword);

  app.use(['/api/users', '/admin-api/users'], userRouter);
  app.use('/api/user', userUtilityRouter);
};
