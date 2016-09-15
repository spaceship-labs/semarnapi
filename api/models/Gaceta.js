/**
 * Gaceta.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs    :: http://sailsjs.org/#!documentation/models
 */

module.exports = {

  attributes: {
    numero: {
      type: 'integer',
    },

    mias: {
      collection: 'mia',
      via: 'gaceta',
      dominant: true,
    },

  },
  //Opens up PDF document and extracts MIA's
  extractMias: function(gaceta) {
    var url = CloudFilesService.getCloudUrl(gaceta.pdf);
    console.log('extracting ' + url);
    return TextService
      .openUrl(url)
      .then(TextService.matchMias)
      .catch(function(error) {
        return error;
      });
  },
  extractAndSaveMias: function(gaceta) {
    return Gaceta
      .extractMias(gaceta)
      .then(function(claves) {
        return Gaceta.saveMias(gaceta, claves);
      })
      .then(function(mias) {
        console.log('saved ' + mias.length);
        return Gaceta.update(gaceta.id, { status: 'mined' });
      })
      .catch(function(error) {
        console.log('could not save anything on gaceta ' + gaceta.periodo);
        console.log(error.message);
        return Gaceta.update(gaceta.id, { error: error.message });
      });
    //return gaceta.extractAndSaveMias();
  },
  saveMias: function(gaceta, claves) {
    var q = require('q');
    var mapSeries = require('promise-map-series');
    //console.log(gaceta.id);
    if (claves.length) {
      console.log('saving ' + claves.length + ' MIAs');

      function task(clave) {
        return Mia.findOrCreate({
          clave: clave
        }, {
          clave: clave,
          gaceta: gaceta.id,
        });
      };
      
      return mapSeries(claves,task);
    } else {
      return q.reject(claves);
    }
  },

  downloadPdf: function(gaceta) {
    return CloudFilesService.findOrCreate(gaceta.pdf).then(function(file) {
      return Gaceta.update(gaceta.id, { downloaded: '1' });
    });
  }
}
