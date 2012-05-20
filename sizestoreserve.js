var express = require('express');
var fs      = require('fs');
var im      = require('easyimage');
var mime    = require('mime');
var path    = require('path');
var raven   = require('raven');

var app = module.exports = express.createServer();

var loadConfig = function() {
  var config;
  if (path.existsSync(__dirname + '/config.json')) {
    config = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
  } else {
    config = {
      s3: {
        key: process.env.AWS_ACCESS_KEY_ID,
        secret: process.env.AWS_SECRET_ACCESS_KEY,
        bucket: process.env.AWS_STORAGE_BUCKET_NAME
      }
    };
  }

  return config;
};
var config = loadConfig();

var knox = require('knox').createClient(config.s3);

// Configuration
app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
});

app.configure('development', function() {
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
});

app.configure('production', function() {
  app.use(express.errorHandler());
  app.error(raven.middleware.express('SENTRY_DSN'));
});

// Routes
app.get('/', function(req, res, next) {
  res.send('Nothing to see here');
});

app.get('/favicon.ico', function(req, res) {
  res.send('');
});

app.get('*', function(req, res) {
  var url = req.url.split('?')[0];

  var width  = req.param('w', 0),
      height = req.param('h', 0),
      crop   = req.param('crop', false);

  im.info(__dirname + url, function(err, image) {
    if (err) throw err;

    res.contentType(image.type);

    var f = im.resize;
    var options = {
      src: __dirname + url, dst: __dirname + url,
      width: width, height: height
    };
    if (width > 0) {
      options.dst += '_w' + width;
    }
    if (height > 0) {
      options.dst += '_h' + height;
    }
    if (crop) {
      options.dst += '_c';
      options.cropwidth = options.width;
      options.cropheight = options.height;
      f = im.crop;
    }

    if (path.existsSync(options.dst)) {
      fs.readFile(options.dst, function(err, data) {
        res.send(data);
      });
    } else {
      f(options, function(err, image) {
        console.log('Image created:');
        console.log(image);
        knox.putFile(image.name, '/' + image.name, {'Content-Type': mime.lookup(image.type)}, function(err, data) {
          if (err) {
            console.log(err);
          } else {
            console.log('Saved to S3: ' + options.dst);
          }
        });
        fs.readFile(image.name, function(err, data) {
          res.send(data);
        });
      });
    }
  });
});

if (!module.parent) {
  app.listen(process.env.PORT || 3000);
  console.log('Express server listening on port %d', app.address().port);
}
