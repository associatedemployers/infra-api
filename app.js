var bodyParser = require('body-parser'),
    globSync   = require('glob').sync,
    routes     = globSync('./routes/*.js', { cwd: __dirname }).map(require),
    cluster    = require('cluster'),
    winston    = require('winston'),
    chalk      = require('chalk'),
    morgan     = require('morgan'),
    version    = require('./package.json').version,
    mongoose   = require('mongoose'),
    logLevel   = process.env.logLevel ? process.env.logLevel : process.env.environment === 'development' || process.env.environment === 'dev' ? 'debug' : 'info';

winston.level = logLevel;

module.exports = function ( app ) {
  if ( !mongoose.connection.db ) {
    require('./config/mongoose').init();
  }

  winston.debug(chalk.dim('Setting server options...'));

  app.enable('trust proxy');

  if ( cluster.worker ) {
    app.set('worker', cluster.worker.id);
  }

  winston.debug(chalk.dim('Setting up middleware...'));

  var logRoute = process.env.environment === 'test' ? process.env.verboseLogging : true;

  if ( logRoute ) {
    app.use( morgan('dev') );
  }

  app.use( bodyParser.json() );

  app.use(bodyParser.urlencoded({
    extended: true
  }));

  app.use(function ( req, res, next ) {
    if ( app.settings.worker ) {
      res.set('X-Worker-Id', app.settings.worker);
      winston.debug(chalk.dim('Request served by worker', app.settings.worker));
    }

    res.set('X-API-Version', version);
    res.set('X-Powered-By', 'Associated Employers');

    next();
  });

  winston.debug(chalk.dim('Getting routes...'));

  routes.forEach(function(route) {
    route(app);
  });

  return app;
};
