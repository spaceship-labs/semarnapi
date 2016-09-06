/**
 * CloudFilesService.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */
module.exports = {
  connect: connect,
  save: save,
  client: false,
}

function connect() {
  var pkgcloud = require('pkgcloud');
  console.log('Creating Cloud Files Client');
  var client = pkgcloud.storage.createClient({
    provider: 'rackspace',
    username: 'mossodany',
    apiKey: 'ab7c7bf943c27883a8b8b4cded5d8c91',
    region: 'DFW'
  });
  console.log('Cloud Files Client Created');
  CloudFilesService.client = client;
}

function save(url) {
  var request = require('request');
  var q = require('q');
  var deferred = q.defer();
  //var url = 'http://sinat.semarnat.gob.mx/Gacetas/archivos2015/gaceta_50-15.pdf';
  var fname = url.split('/');
  fname = fname[fname.length - 1];
  if (!CloudFilesService.client) {
    CloudFilesService.connect();
  }
  console.log('saving file: ' + url);
  var writeStream = CloudFilesService.client.upload({
    container: 'semarnat',
    remote: fname
  });

  writeStream.on('error', function(err) {
    console.log('Error uploading file: ' + url);
    deferred.reject(err);
  });

  writeStream.on('success', function(file) {
    console.log('File saved to cloud: ' + url);
    deferred.resolve(file);
  });

  request(url).pipe(writeStream);
  return deferred.promise;

}
