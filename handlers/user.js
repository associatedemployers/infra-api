var // winston   = require('winston'),
    respond   = require('./response'),
    mongoose  = require('mongoose'),
    // Promise   = require('bluebird'), // jshint ignore:line
    bcp       = require('bcrypt'),
    keygen    = require('keygenerator'),
    jwt       = require('jwt-simple'),
    _         = require('lodash');

var User          = require('../models/user'),
    ResourceMixin = require('../lib/mixins/resource-handler'),
    session       = require('../lib/security/session');

var Mailman = require('../lib/controllers/mailman');

/**
 * Generates a session from a user record
 * @private
 * @param  {Object} user User document
 * @return {Promise}     Authorization
 */
function _generateAuthorization ( user ) {
  var sessionData = {
    userId:   user._id.toString(),
    username: user.username
  };

  return session.create(user._id, sessionData, 'Session', 'user', 'User');
}

/**
 * Responds with authorization (session)
 * @param  {Object} userSession Session document
 * @param  {Object} res         Express response object
 * @return {undefined}
 */
function _respondWithAuthorization ( userSession, res ) {
  var _res = res || this;

  _res.json({
    token:      userSession.publicKey,
    expiration: userSession.expiration,
    user:       userSession.user.toString()
  });
}

function _toPermStrings ( perms ) {
  return perms.map(function ( perm ) {
    return perm._id.toString();
  });
}

exports.fetchAll = function ( req ) {
  var query = !req.session.user.isAdmin ? { company: req.session.user.company } : null;
  ResourceMixin.getAll('User', null, query).apply(this, arguments);
};

exports.fetchById = ResourceMixin.getById('User');

exports.create = function ( req, res ) {
  var payload = req.body.user,
      user    = req.session.user;

  if ( !payload || !payload.username || !payload.email ) {
    return respond.error.res(res, 'Invalid payload');
  }

  // Users need permissions, make the default the current user's perms
  if ( !payload.permissions ) {
    payload.permissions = user.permissions;
  }

  // We need to make sure they haven't grabbed an id of a perm they
  // do not have. We do this by checking the diff and comparing the
  // result of the diff array.
  var permStringIds = _toPermStrings(user.permissions),
      permDiff = _.difference(payload.permissions, permStringIds);

  if ( permDiff.length > 0 ) {
    return respond.error.res(res, 'Attempted to assign unauthorized permissions (' + permDiff.join(', ') + ')');
  }

  User.findOne({ username: payload.username }, function ( err, existingUser ) {
    if ( err ) {
      return respond.error.res(res, err, true);
    }

    if ( existingUser ) {
      return respond.error.res(res, 'A user already exists with username, ' + payload.username);
    }

    var newUser = new User(user.isAdmin ? payload : _.merge(payload, {
      company: user.company._id
    }));

    newUser.save(function ( err, record ) {
      if ( err ) {
        return respond.error.res(res, err, true);
      }

      var _complete = function () {
        res.status(201).send({
          user: record.toObject({ depopulate: true })
        });
      };

      if ( user.isAdmin ) {
        return _complete();
      }

      user.company.users.addToSet(record);

      user.company.save(function ( err ) {
        if ( err ) {
          return respond.error.res(res, err, true);
        }

        _complete();
      });
    });
  });
};

exports.update = function ( req, res ) {
  var id      = req.params.id,
      payload = req.body.user,
      user    = req.session.user;

  if ( !payload ) {
    return respond.error.res(res, 'Invalid payload');
  }

  if ( !id || !mongoose.Types.ObjectId.isValid(id) ) {
    return respond.error.res(res, 'Invalid id');
  }

  User.findById(id).exec().then(userUpdate => {
    if ( !userUpdate ) {
      return respond.code.notfound(res);
    }

    var permStringIds = _toPermStrings(user.permissions),
        permDiff = _.difference(payload.permissions, permStringIds);

    if ( permDiff.length > 0 ) {
      return respond.error.res(res, 'Attempted to assign unauthorized permissions (' + permDiff.join(', ') + ')');
    }

    delete payload.username;

    _.assign(userUpdate, payload);

    return userUpdate.save();
  }).then(userRecord => {
    res.status(200).send({
      user: userRecord.toObject({ depopulate: true })
    });
  }).catch(respond.error.callback(res, true));
};

exports.del = function ( req, res ) {
  var id   = req.params.id,
      user = req.session.user;

  if ( !id || !mongoose.Types.ObjectId.isValid(id) ) {
    return respond.error.res(res, 'Invalid id');
  }

  User.findById(id, function ( err, record ) {
    if ( err ) {
      return respond.error.res(res, err, true);
    }

    if ( !record ) {
      return respond.code.notfound(res);
    }

    record.remove(function ( err ) {
      if ( err ) {
        return respond.error.res(res, err, true);
      }

      user.company.users.pull(record._id);

      user.company.save(function ( err ) {
        if ( err ) {
          return respond.error.res(res, err, true);
        }

        res.status(204).end();
      });
    });
  });
};

exports.checkUsername = function ( req, res ) {
  var username = req.params.username;

  User.findOne({ username: username }, function ( err, existingUser ) {
    if ( err ) {
      return respond.error.res(res, err, true);
    }

    res.status(200).send({
      exists: !!existingUser
    });
  });
};

exports.getActivation = function ( req, res ) {
  var id = req.params.id;

  if ( !id || !mongoose.Types.ObjectId.isValid(id) ) {
    return respond.error.res(res, 'Invalid id');
  }

  User.findById(id, function ( err, user ) {
    if ( err ) {
      return respond.error.res(res, err, true);
    }

    if ( !user || user.activatedOn ) {
      return respond.code.notfound(res);
    }

    if ( user.password ) {
      return res.status(200).send({
        hasPassword: true
      });
    }

    var key = keygen._({ length: 128 });
    var data = {
      id: user._id.toString()
    };
    var signature = jwt.encode(data, key);

    user.activationKey = key;

    user.save(function ( err ) {
      if ( err ) {
        return respond.error.res(res, err, true);
      }

      res.status(201).send({
        activationSignature: signature
      });
    });
  });
};

exports.activateAccount = function ( req, res ) {
  var id       = req.params.id,
      password = req.body.password,
      actsig   = req.body.activationSignature;

  if ( !id || !mongoose.Types.ObjectId.isValid(id) ) {
    return respond.error.res(res, 'Invalid id');
  }

  if ( !password ) {
    return respond.error.res(res, 'Please specify a password with your account activation');
  }

  if ( !actsig ) {
    return respond.error.res(res, 'Unauthorized request detected. Please include a valid activation signature.');
  }

  User.findById(id, function ( err, user ) {
    if ( err ) {
      return respond.error.res(res, err, true);
    }

    if ( !user ) {
      return respond.code.notfound(res);
    }

    var decrypted = jwt.decode(actsig, user.activationKey);

    if ( !decrypted || !decrypted.id || decrypted.id !== user._id.toString() ) {
      return respond.code.unauthorized(res);
    }

    if ( user.activatedOn ) {
      return respond.error.res(res, 'User already activated.');
    }

    user.password = password;
    user.activationKey = undefined;
    user.activatedOn = new Date();

    user.save(function ( err, userRecord ) {
      if ( err ) {
        return respond.error.res(res, err, true);
      }

      res.status(200).send({
        activatedEmail: userRecord.email,
        success: true
      });
    });
  });
};

exports.login = function ( req, res ) {
  var payload  = req.body,
      username = payload.username,
      password = payload.password;

  if ( !username || !password ) {
    return respond.error.res(res, 'Provide a payload in your request with login details');
  }

  var handleError = function ( err ) {
    respond.error.res(res, err, true);
  };

  User.findOne({ username: username, password: { $exists: true } }).exec().then(function ( user ) {
    if ( !user ) {
      return res.status(401).send('User not found.');
    }

    bcp.compare(password, user.password, function ( err, passwordMatches ) {
      if ( err ) {
        return respond.error.res(res, err, true);
      }

      if ( passwordMatches ) {
        if ( !user.activatedOn ) {
          user.activatedOn = new Date();
          user.activationKey = undefined;

          return user.save(function ( err, newUser ) {
            if ( err ) {
              return respond.error.res(res, err, true);
            }

            _generateAuthorization( newUser ).then( _respondWithAuthorization.bind( res ) );
          });
        }

        return _generateAuthorization( user ).then( _respondWithAuthorization.bind( res ) );
      } else {
        respond.code.unauthorized(res, 'Invalid password');
      }
    });
  }).catch( handleError );
};

exports.sendForgotLink = function ( req, res ) {
  var email = req.body.email;

  if ( !email ) {
    return respond.error.res(res, 'Please send an email with your request.');
  }

  var handleError = function ( err ) {
    respond.error.res(res, err, true);
  };

  User.findOne({ email }).exec().then(user => {
    if ( !user || !user.email ) {
      return res.status(404).send('User or email not found.');
    }

    var resetToken = keygen._({ length: 20 });
    user.passwordResetToken = resetToken;
    return user.save();
  }).then(newUser => {
    var mailman = new Mailman(),
        subject = 'Your reset link for your Slate Payroll account';

    var data = {
      user: newUser,
      reason: 'you requested an email to reset your password or view your username'
    };

    return mailman.send(newUser.email, subject, 'company-user-forgot-link', data).then(() => {
      res.status(204).end();
    });
  }).catch(handleError);
};

exports.resetPassword = function ( req, res ) {
  var resetToken = req.params.resetToken,
      password = req.body.password;

  if ( !resetToken || !password ) {
    return respond.error.res(res, 'Invalid payload.');
  }

  var handleError = function ( err ) {
    respond.error.res(res, err, true);
  };

  User.findOne({ passwordResetToken: resetToken }).exec().then(user => {
    if ( !user ) {
      return res.status(404).send('User not found.');
    }

    user.password = password;
    user.passwordResetToken = null;

    return user.save().then(newUser => {
      res.status(200).send({
        userEmail: newUser.email,
        username: newUser.username
      });
    });
  }).catch(handleError);
};
