/**
 * ScraperService.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

var extract = require('pdf-text-extract');
var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');
var Spooky = require('spooky');
var dir = 'assets/gacetas/';
var counter = 1;
var counter2 = 1;

module.exports = {
  years : function(callback) {
    request({
        //Warning este URL cambia cada año
        url: 'http://tramites.semarnat.gob.mx/index.php/component/content/article?id=284',
        headers: {
          'User-agent': 'Mozilla/5.0'
        },
      },
      function(err, resp, body) {
        if (err) throw (err);
        $ = cheerio.load(body);
        var years = [];
        $('a[href*="http://tramites.semarnat.gob.mx/index.php/component/content/article?id="]').each(function() {
          if ($(this).text().trim() == 'Principio Legal') return;
          years.push({
            year: $(this).text().trim(),
            id: $(this).attr('href').replace('http://tramites.semarnat.gob.mx/index.php/component/content/article?id=', ''),
          });
        });
        async.map(years, function(y, c) {
          Year.findOrCreate(y, y, c)
        }, function(e, r) {
          if (e) throw (e);
          console.log(r.length+'years detected');

          if(callback){
            callback(r)
          };
        })
      });
  },

  gacetas: function(callback) {
    Year.find({}, function(e, years) {
      if (e) throw (e);
      async.mapSeries(years, scrapeGacetas, callback);
    });
  },

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

  mia: function(clave) {
    counter = counter2 = 0;
    var q = clave ? {
      clave: clave
    } : {};
    Mia.find(q, function(e, mias) {
      if (e) throw (e);
      console.log('records to process: '+mias.length);
      async.mapLimit(mias, 1, scrapeMia, function(e, m) {
        if (e) throw (e);
        console.log('done');
        res.json(m);
      });
    });
  },
};



var timestamp = function() {
  var newDate = new Date();
  newDate.setTime(Date.now() * 1000);
  return '[' + newDate.toUTCString() + '] ';
}

var scrapeMia = function(mia, callback) {
  if (!mia.proyecto && !mia.orphaned) {
    var spooky = new Spooky({
      child: {
        transport: 'http'
      },
      casper: {
        logLevel: 'debug',
        verbose: true,
      }
    }, function(err) {
      if (err) {
        e = new Error('Failed to initialize SpookyJS');
        e.details = err;
        console.log(err);
        throw e;
      }
      console.log(timestamp() + " downloading " + mia.clave);
      spooky.start('http://app1.semarnat.gob.mx/consultatramite/inicio.php');
      spooky.then([{
        mia: mia.clave
      }, function() {
        this.emit('loaded_search')
        this.evaluate(function(_mia) {
          document.querySelector('input[name="_idBitacora"]').value = _mia;
          document.querySelector('input[name="listadoarea2_r12_c8"]').click();
        }, mia);
      }]);
      spooky.then([{
        mia: mia
      }, function() {
        this.emit('loaded_mia', this.evaluate(function() {
          return document.documentElement.outerHTML;
        }), mia);
      }]);
      spooky.run();
    });
    spooky.on('error', function(e, stack) {
      console.error(e);
      if (stack) console.log(stack);
    });
    spooky.on('loaded_search', function(body) {
      console.log(timestamp() + ' loaded search ' + mia.clave);
    });
    //spooky.on('console', function (line){console.log(line);});
    spooky.on('loaded_mia', function(body, mia) {
      console.log(timestamp() + ' prossesing  ' + mia.clave);
      $ = cheerio.load(body);
      var textos = [];
      $('.texto_espacio').each(function() {
        textos.push($(this).text());
      })
      if (textos.length) {
        var general = $('.texto_espacio').eq(0).children().html().split('<br>');
        var resumen = $('a[href*="wResumenes"]');
        var estudio = $('a[href*="wEstudios"]');
        var resolutivo = $('a[href*="wResolutivos"]');
        var mia = {
            estado: $(".tit_menu").text().replace('Num. ', '').trim(),
            tramite: general[1].trim(),
            proyecto: general[3].replace('Proyecto: ', ''),
            clave: general[5].replace('Num. Proyecto: ', '').trim(),
            entidad: $('.texto_espacio').eq(2).text().trim(),
            fecha_de_ingreso: $('.texto_espacio').eq(3).text().trim(),
            situacion_actual: $('textarea.texto_espacio').val().trim(),
            resumen: resumen.length ? resumen.attr('href').replace("javascript:abrirPDF('", '').replace("','wResumenes')", '') : false,
            estudio: estudio.length ? estudio.attr('href').replace("javascript:abrirPDF('", '').replace("','wEstudios')", '') : false,
            resolutivo: resolutivo.length ? resolutivo.attr('href').replace("javascript:abrirPDF('", '').replace("','wResolutivos')", '') : false,
          }
        //console.dir(mia);
        console.log(timestamp() + ' proccesed ' + counter++);
        Mia.update({
          clave: mia.clave
        }, mia, callback);
      } else {
        console.log(timestamp() + ' orphaned  ' + counter2++);
        Mia.update({
          clave: mia.clave
        }, {
          clave: mia.clave,
          orphaned: true
        }, callback);
      }
    });
  } else {
    console.log(timestamp() + ' already processed ' + mia.clave + ' ' + counter++);
    setImmediate(function() {
      callback(null, mia);
    });
  }
}


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
      console.log('logging mias');
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
      url: 'http://dsiapps.semarnat.gob.mx/gaceta/Gacetas/gaceta' + year.year + '.php',
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
