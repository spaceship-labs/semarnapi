/**
 * ScraperService.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

var extract = require('pdf-text-extract'),
  request = require('request'),
  fs = require('fs'),
  dir = 'assets/gacetas/';

module.exports = {

  downloadGacetas: function(callback) {
    Gaceta.find({}, function(e, gacetas) {
      if (e) throw (e);
      async.mapSeries(gacetas, function(g, c) {
        downloadWget(g.pdf, c)
      }, callback)
    })
  },

  mias: function(callback) {
    counter = 0;
    Gaceta.find({}).exec(function(e, gacetas) {
      console.log(gacetas.length);
      async.mapSeries(gacetas, scrapeMias, callback);
    });
  },
};

var scrapeMias = function(gaceta, callback) {
  var aux = gaceta.pdf.split('/');
  var filePath = dir + aux[aux.length - 1];
  extract(filePath, function(err, pages) {
    if (err) {
      console.dir(err);
      return;
    }
    var pages = pages.join(" ");
    var mias = pages.match(/[\w\d]{4}20[1,0]\d[\w\d]{5}/gi);
    if (mias) {
      async.map(mias, function(m, c) {
        Mia.findOrCreate({
          clave: m
        }, {
          clave: m
        }, c)
      }, callback);
    } else {
      console.log('fail: ', gaceta.pdf);
      callback();
    }
    console.log('gacetas procesadas: ' + counter++);
  });
}

var scrapeGacetas = function(year, callback) {
  request({
      url: 'http://sinat.semarnat.gob.mx/Gaceta/gacetapublicacion/?ai='+year,
      headers: {
        'user-agent': 'Mozilla/5.0'
      },
    },
    function(err, resp, body) {
      if (err) throw (err);
      $ = cheerio.load(body);
      var gacetas = [];
      $('a[href*="archivos' + year.year + '/gaceta_"]').each(function() {
        var file = $(this).attr('href').split('/')
        gacetas.push({
          pdf: 'http://dsiapps.semarnat.gob.mx/gaceta/archivos' + year.year + '/' + file[file.length - 1],
          periodo: $(this).parent().parent().next().text().trim(),
          publicacion: $(this).parent().parent().next().next().text().trim(),
          numero: $(this).text().trim(),
        });
      })
      dir = 'assets/gacetas/';
      async.map(gacetas, function(g, c) {
        Gaceta.findOrCreate(g, g, c)
      }, callback);
    });
}

var download = function(url, cb) {
  var fname = url.split('/');
  fname = fname[fname.length - 1];
  if (fs.existsSync(dir + fname)) {
    console.log('exists: ' + counter++);
    cb(null, fname);
  } else {
    var options = {
      uri: url,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:15.0) Gecko/20120427 Firefox/15.0a1'
      },
      method: "HTTP",
    }
    console.log('downloading: ' + url);
    var req = request(options).pipe(fs.createWriteStream(dir + fname)).on('finish', function(e, res, body) {
      if (e) cb(e, fname);
      console.log('downloaded :' + counter++);
      cb(null, fname);
    });
  }
}

var downloadWget = function(url, cb) {
  var fname = url.split('/');
  fname = fname[fname.length - 1];
  console.log('downloading ' + fname);
  var util = require('util'),
    exec = require('child_process').exec,
    child,

    child = exec('wget -O ' + dir + fname + ' ' + url,
      function(error, stdout, stderr) {
        // console.log('stdout: ' + stdout);
        // console.log('stderr: ' + stderr);
        if (error !== null) {
          console.log('exec error: ' + error);
          cb(error, url);
        }
      });
  child.on('exit', function() {
    console.log('downloaded: ' + fname);
    cb(null, dir + fname);
  });
}
