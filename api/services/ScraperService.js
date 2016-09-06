/* ScraperService.js *
 * @description::
 * @docs::http: //sailsjs.org/#!documentation/controllers
 */

var extract = require('pdf-text-extract'),
  request = require('request'),
  cheerio = require('cheerio'),
  fs = require('fs'),
  Spooky = require('spooky'),
  q = require('q'),
  mapSeries = require('promise-map-series'),
  dir = 'assets/gacetas/',
  counter = 1,
  counter2 = 1;

module.exports = {
  //Go through all the years and collect gaceta metadata (step1)
  gacetas: function(callback) {
    var years = [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016];
    var years = [2015, 2016];
    counter = 0;
    async.mapSeries(years, scrapeGacetas, function(e, res) {
      console.log('total' + counter);
      //callback(e,res);
    });
  },

  //Download the actual gaceta pdfs (step2)
  downloadGacetas: function() {
    return Gaceta.find().then(function(gacetas) {
      return mapSeries(gacetas, function(g) {
        return DownloadService.wget(g.pdf, 'assets/gacetas/');
      });
    });
  },

  //Extract the mia codes from the gaceta pdfs with a regex and save them (step3)
  mineGacetas: function(callback) {
    counter = 0;
    Gaceta.find({
      status: {
        '!': 'mined'
      }
    }).exec(function(e, gacetas) {
      console.log(gacetas.length);
      async.mapSeries(gacetas, mineGaceta, callback);
    });
  },

  mia: function(clave, callback) {
    counter = counter2 = 0;
    var q = clave ? {
      clave: clave
    } : {};
    Mia.find(q, function(e, mias) {
      if (e) throw (e);
      console.log('records to process: ' + mias.length);
      async.mapLimit(mias, 1, scrapeMia, callback);
    });
  },
};




//Reads Gaceta metadata from sinat
var scrapeGacetas = function(year, callback) {
    request({
        url: 'http://sinat.semarnat.gob.mx/Gaceta/gacetapublicacion/?ai=' + year,
        headers: {
          'user-agent': 'Mozilla/5.0'
        },
      },
      function(err, resp, body) {
        if (err) throw (err);
        $ = cheerio.load(body);
        var gacetas = [];
        $('a[href*="archivos' + year + '/gaceta_"]').each(function() {
          var file = $(this).attr('href').split('/');
          gacetas.push({
            pdf: $(this).attr('href'),
            periodo: $(this).parent().parent().next().text().trim(),
            publicacion: $(this).parent().parent().next().next().text().trim(),
            numero: $(this).text().trim(),
          });
        })
        console.log(year + ': ' + gacetas.length + ' documents');
        counter += gacetas.length;
        async.map(gacetas, function(g, c) {
          Gaceta.findOrCreate(g, g, c)
        }, callback);
      });
  }
  //Reads the gaceta pdf and matches the id to a code
var mineGaceta = function(gaceta, callback) {
  var aux = gaceta.pdf.split('/');
  var filePath = dir + aux[aux.length - 1];
  extract(filePath, function(err, pages) {
    if (err) {
      console.log('error reading file: ' + filePath);
      return Gaceta.update(gaceta.id, {
        status: 'file error'
      }, callback);
    }
    var pages = pages.join(" ");
    var mias = pages.match(/[\w\d]{4}20[1,0]\d[\w\d]{5}/gi);
    if (mias) {
      async.map(mias, function(m, c) {
        Mia.findOrCreate({
          clave: m
        }, {
          clave: m,
          gaceta: gaceta.id,
        }, c)
      }, function(e, res) {
        Gaceta.update(gaceta.id, {
          status: 'mined'
        }, callback);
      });
      console.log('gacetas procesadas: ' + counter++);
    } else {
      console.log('no mias: ', gaceta.pdf);
      Gaceta.update(gaceta.id, {
        status: 'no mias'
      }, callback);
    }

  });
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
      spooky.start('http://apps1.semarnat.gob.mx/consultatramite/inicio.php');
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
        var date = $('.texto_espacio').eq(3).text().trim().split('/');
        date = new Date(date[2], date[1] - 1, date[0]);
        var mia = {
          estado: $(".tit_menu").text().replace('Num. ', '').trim(),
          tramite: general[1].trim(),
          proyecto: general[3].replace('Proyecto: ', ''),
          clave: general[5].replace('Num. Proyecto: ', '').trim(),
          entidad: $('.texto_espacio').eq(2).text().trim(),
          fechaIngreso: date,
          situacionActual: $('textarea.texto_espacio').val().trim(),
          resumen: resumen.length ? resumen.attr('href').replace("javascript:abrirPDF('", '').replace("','wResumenes')", '') : false,
          estudio: estudio.length ? estudio.attr('href').replace("javascript:abrirPDF('", '').replace("','wEstudios')", '') : false,
          resolutivo: resolutivo.length ? resolutivo.attr('href').replace("javascript:abrirPDF('", '').replace("','wResolutivos')", '') : false,
        }
        //console.dir(mia);
        console.log(timestamp() + ' proccesed ' + counter++);
        Mia.update({
          clave: mia.clave
        }, mia, function(e, res) {
          if (e) throw e;
          console.log('saved this');
          callback(e, res);
        });
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

var timestamp = function() {
  var newDate = new Date();
  newDate.setTime(Date.now() * 1000);
  return '[' + newDate.toUTCString() + '] ';
}
