const cluster   = require('cluster'),
      os        = require('os'),
      Koa       = require('koa'),
      winston   = require('winston'),
      chalk     = require('chalk'),
      getConfig = require('./lib/utilities/get-config'),
      logLevel  = process.env.environment === 'development' || process.env.environment === 'dev' ? 'debug' : 'info';

winston.level = logLevel;

const app = require('./app');
require('./config/mongoose').init();

const port = getConfig('port') || 3000;

if ( cluster.isMaster ) {
  var workers = [];

  let boot = (c, i) => {
    workers[i] = cluster.fork();

    workers[i].on('exit', () => {
      winston.error(chalk.bgRed('Worker died. :( RIP Worker', i, '. Rebooting...'));
      boot(c, i);
    });
  };

  os.cpus().forEach((cpu, ci) => boot(ci));

  var initalizerLoader = require('./initializer-loader');

  initalizerLoader.load();
} else {
  winston.info(chalk.dim('[', cluster.worker.id, '] Starting worker ...'));

  process.title = 'Infra API Worker - ' + cluster.worker.id + ' - Node.js';

  app.registerModels();

  app.init(new Koa()).listen(port, () => {
    winston.info(chalk.dim('[', cluster.worker.id, '] Worker listening on port:', port));
  });
}
