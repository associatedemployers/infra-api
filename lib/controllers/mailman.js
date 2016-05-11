var winston = require('winston').loggers.get('default'),
    chalk   = require('chalk'),
    Promise = require('bluebird'),
    fs      = require('fs-extra'),
    _       = require('lodash');

var path           = require('path'),
    defTransport   = require(process.cwd() + '/config/mail'),
    emailTemplates = require('email-templates'),
    nodemailer     = require('nodemailer'),
    templatesDir   = path.resolve(process.cwd(), 'mail-templates'),
    partialsDir    = path.resolve(process.cwd(), 'mail-templates', '_partials');

/**
 * Mailman Constructor
 * @param  {Object} options Mail options
 * @return {Object} Mailman
 */
function Mailman ( options ) {
  var _options = options || {};

  this.sender = {
    from: _options.sender && _options.sender.name && _options.sender.email ? _options.sender.name + ' <' + _options.sender.email + '>' : 'Slate Payroll <noreply@slatepayroll.com>'
  };

  this.sender.replyTo = _options.replyTo || this.sender.from;
  this.__templatesDir = _options.templatesDir || templatesDir;
  this.__transportConfig = _options.configuration || defTransport;
  this.__transport = _options.transport || require(process.env.MAILTRANSPORT || 'nodemailer-sendgrid-transport');
  this.__partials = {};

  if ( process.env.MAILAPIKEY ) {
    if ( !_.isObject(this.__transportConfig) ) {
      this.__transportConfig = {
        auth: {}
      };
    }

    if ( !_.isObject(this.__transportConfig.auth) ) {
      this.__transportConfig.auth = {};
    }

    this.__transportConfig.auth.api_key = process.env.MAILAPIKEY; // eslint-disable-line
  }

  var partials = fs.readdirSync( partialsDir ),
      self = this;

  partials.forEach(function ( filename ) {
    var template = fs.readFileSync(path.resolve(partialsDir, filename), 'utf8'),
        name     = filename.split('.')[0];

    self.__partials[ name ] = template;
  });

  return this;
}

module.exports = Mailman;

/**
 * Mailman Send
 * @param  {String|Array} to     Addressed to
 * @param  {String} subject      Subject
 * @param  {String} templateName Name of template in mail-templates directory
 * @param  {Object} vars         Template Locals
 * @return {Promise}             Resolves to Mailer Response
 */
Mailman.prototype.send = function ( to, subject, templateName, vars ) {
  return new Promise((resolve, reject) => {
    if ( !process.env.allowEmails ) {
      winston.log('Please set env var "allowEmails" to true to send emails.');
      return resolve();
    }

    winston.log('debug', chalk.dim('Mailman :: Rendering content for email with template:', templateName));

    return this.__render(templateName, vars).then(rendered => {
      winston.debug(chalk.dim('Mailman :: Rendered content. Sending mail...'));
      winston.debug(chalk.dim('Mailman :: Using auth', this.__transportConfig ? JSON.stringify(this.__transportConfig.auth) : 'None'));

      var postalService = nodemailer.createTransport(this.__transport(this.__transportConfig));

      postalService.on('log', msg => {
        if ( process.env.debug === true ) {
          winston.debug(msg);
        }
      });

      postalService.sendMail({
        from: this.sender.from,
        to: to,
        subject: subject,
        html: rendered.html,
        text: rendered.text
      }, function ( err, res ) {
        if ( err ) {
          return reject( err );
        }

        winston.debug(chalk.dim('Mailman :: Sent mail!'));
        resolve( res );
      });
    });
  });
};

/**
 * Mailman __getTemplates
 * @private
 * @return {Object} email-templates template class
 */
Mailman.prototype.__getTemplates = function () {
  var self = this;

  return new Promise(function ( resolve, reject ) {
    if( self.__templates ) {
      return resolve( self.__templates );
    }

    emailTemplates(self.__templatesDir, {
      partials: self.__partials
    }, function ( err, templates ) {
      if( err ) {
        return reject( err );
      }

      self.__templates = templates;
      return resolve( templates );
    });
  });
};

/**
 * Mailman __render
 * @private
 * @param  {String} templateName Name of template
 * @param  {Object} vars         Template Locals
 * @return {Object}              Containing rendered html & text
 */
Mailman.prototype.__render = function ( templateName, vars ) {
  var self = this;

  return new Promise(function ( resolve, reject ) {
    return self.__getTemplates().then(function ( templates ) {
      templates(templateName, vars, function ( err, html, text ) {
        if( err ) {
          return reject( err );
        }

        resolve({
          html: html,
          text: text
        });
      });
    });
  });
};
