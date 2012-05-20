var express = require('express');
var fs      = require('fs');
var im      = require('easyimage');
var path    = require('path');
var raven   = require('raven');

var app = module.exports = express.createServer();

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
