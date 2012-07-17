var express = require('express');
var fs      = require('fs');
var im      = require('easyimage');
var mime    = require('mime');
var raven   = require('raven');

var app = module.exports = express.createServer();

var loadConfig = function() {
  var config;
  if (fs.existsSync(__dirname + '/config.json')) {
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
  app.error(raven.middleware.express(process.env.SENTRY_DSN));
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

  var realFileName = url;
  if (width > 0) {
    realFileName += '_w' + width;
  }
  if (height > 0) {
    realFileName += '_h' + height;
  }
  if (crop) {
    realFileName += '_c';
  }

  var tmpName = __dirname + '/tmp/' + Math.floor(Math.random() * 10000);

  // Open a file and output its contents to the response, calling callback after
  var sendFileToResponse = function(fileName, callback) {
    im.info(fileName, function(err, image) {
      if (err) throw err;

      res.contentType(image.type);
      fs.readFile(fileName, function(err, data) {
        res.send(data);
        callback();
      });
    });
  };

  // Copy a file to S3
  var sendFileToS3 = function(fileName, originalName, fileType) {
    knox.putFile(originalName, fileName, {'Content-Type': mime.lookup(fileType)}, function(err, data) {
      if (err) {
        console.log(err);
      } else {
        console.log('Saved to S3: ' + originalName);
      }
    });
  };

  // Delete files from the local file system
  var cleanUp = function() {
    for (var arg in arguments) {
      fs.unlink(arguments[arg]);
    }
  };

  var copyFromS3 = function(fileName, originalName, tmpName, alter) {
    knox.get(fileName).on('response', function(response) {
      if (200 == response.statusCode) {
        var stream = fs.createWriteStream(tmpName);
        response.on('data', function(chunk) {
          stream.write(chunk);
        }).on('end', function() {
          console.log('temporary file created at ' + tmpName);

          if (alter) {
            var f = im.resize;
            var tmpNameDst = tmpName + '_2';

            var options = {
              src: tmpName, dst: tmpNameDst,
              width: width, height: height
            };
            if (crop) {
              options.cropwidth = options.width;
              options.cropheight = options.height;
              f = im.crop;
            }

            f(options, function(err, image) {
              console.log('new image created: ' + realFileName);
              var headers = {'Content-Type': mime.lookup(image.type)};
              if (config.s3.private) {
                headers['x-amz-acl'] = 'private';
              }

              sendFileToS3(realFileName, tmpNameDst, image.type);

              sendFileToResponse(tmpNameDst, function() {
                cleanUp(tmpName, tmpNameDst);
              });
            });
          } else {
            sendFileToResponse(tmpName, function() {
              cleanUp(tmpName);
            });
          }
        });
      } else if (!alter) {
        copyFromS3(originalName, '', tmpName, true);
      } else {
        res.send('k thx bai', 404);
      }
    }).end();
  };

  copyFromS3(realFileName, url, tmpName, false);
});

if (!module.parent) {
  app.listen(process.env.PORT || 3000);
  console.log('Express server listening on port %d', app.address().port);
}
