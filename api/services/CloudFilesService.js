/**
 * CloudFilesService.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */
module.exports = {
  connect: connect,
  save: save,
  findOrCreate: findOrCreate,
  client: false,
  getCloudUrl : getCloudUrl,
}

function connect() {
  var pkgcloud = require('pkgcloud');
  console.log('Creating Cloud Files Client');
  var client = pkgcloud.storage.createClient(sails.config.aws);
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

function findOrCreate(url) {
  return fileExists(url).then(function(file){
    console.log('File already exists: ' + url );
    return file;
  },CloudFilesService.save);
}

function fileExists(url) {
  var filename = getFilenameFromUrl(url);
  var q = require('q');
  if (!CloudFilesService.client) {
    CloudFilesService.connect();
  }
  var deferred = q.defer();
  CloudFilesService.client.getFile('semarnat', filename, function(err, file) {
    if (err) {
      deferred.reject(url);
    }
    deferred.resolve(file);

  });
  return deferred.promise;
}

function getCloudUrl(url){
  filename = getFilenameFromUrl(url);
  return sails.config.aws.containerUrl + '/' + filename;
}

function getFilenameFromUrl(url) {
  var fname = url.split('/');
  fname = fname[fname.length - 1];
  return fname;
}
