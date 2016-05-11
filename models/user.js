/*
  User - Server Data Model
*/

var mongoose = require('mongoose'),
    Schema   = mongoose.Schema,
    createModel = require('mongoose-create-model'),
    cryptify = require('mongoose-cryptify'),
    Mailman = require('../lib/controllers/mailman');

/*
  Doc Schema
*/
var userSchema = new Schema({
  email:    String,
  password: String,
  type:     String,

  activationKey: String,
  passwordResetToken: String,

  activatedOn: Date,
  created:     { type: Date, default: Date.now, index: true }
});

userSchema.plugin(cryptify, {
  paths:  [ 'password' ],
  factor: 11
});

userSchema.pre('save', function ( next ) {
  this.wasNew = this.isNew;
  next();
});

// Email Notification
userSchema.post('save', function ( doc ) {
  if ( !doc.wasNew || !doc.email ) {
    return;
  }

  var mailman = new Mailman();

  doc.constructor.populate(doc, 'company', function ( err, populatedRecord ) {
    if ( err ) {
      throw err;
    }

    var subject = '';

    var data = {
      user: populatedRecord,
      reason: 'added a user'
    };

    mailman.send(doc.email, subject, 'new-user', data);
  });
});

module.exports = createModel('User', userSchema);
