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
  //Go through all the years and collect and save gaceta ecológica metadata (step1)
  gacetas: function(years) {
    var deferred = q.defer();
    if (!years) {
      var years = [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018,2019];
    }
    //var years = [2016];
    counter = 0;
    async.mapSeries(years, scrapeGacetas, function(e, res) {
      if (e) {
        deferred.reject(e)
      } else {
        deferred.resolve(res);
      }
    });
    return deferred.promise;
  },
  //Download gaceta pdfs that have not been marked as downloaded (step2)
  downloadGacetas: function() {
    var criteria = { downloaded: { '!': '1' } };
    return Gaceta.find(criteria).then(function(gacetas) {
      console.log('Descargando ' + gacetas.length + ' gacetas ecologicas');
      return mapSeries(gacetas, Gaceta.downloadPdf);
    });
  },
  //Extract and save mias that have not been saved (step3)
  mineGacetas: function() {
    var criteria = { status: { '!': ['mined', 'error'] } };
    return Gaceta.find(criteria).then(function(gacetas) {
      console.log('mining ' + gacetas.length + ' gacetas for MIAs');
      return mapSeries(gacetas, Gaceta.extractAndSaveMias);
    });
  },
  //Get metadata for each proyect (iterates using robot needs to be  refactored into RobotService)
  mia: function() {
    var q = require('q');
    var deferred = q.defer();
    counter = counter2 = 0;
    var query = {
      "proyecto": null
    };
    console.log(query);
    Mia.find(query, function(e, mias) {
      if (e) throw (e);
      console.log('records to process: ' + mias.length);
      async.mapLimit(mias, 1, scrapeMia, function(e, res) {
        if (e) {
          deferred.reject(e);
        } else {
          deferred.resolve(res);
        }
      });
    });
  },

  test: function() {
    Mia.findOne({ clave: '23QR2016TD052' }).then(function(mia) {
      //console.log(mia);
      mia.proyecto = false;
      scrapeMia(mia, function(e, mia) {
        console.log(mia);
      });
    });
  },
  readStates: function() {
    Entidad.find().then(function(entidades){
      var id = entidades[0].name;
      console.log(id);
      Mia.findOne({entidad:id}).then(function(mia){
        console.log(mia);
      });
    })
    .catch(function(err){
      console.log(err);
    })
  },
  updateDF : function(){
    Entidad.update({name:'Distrito Federal'},{name:'Ciudad de México'}).exec(console.logLevel);
  }
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
