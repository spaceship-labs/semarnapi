/**
 * TextService.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */
module.exports = {
    matchMias: matchMias,
    openUrl: openUrl,
  }
  //Returns array of MIAs matched using Regex Pattern from provided text
function matchMias(text) {
  var mias = text.match(/[\w\d]{4}20[1,0]\d[\w\d]{5}/gi);
  return mias;
}
//opens pdf from url and returns text
function openUrl(url) {
  var q = require('q');
  var deferred = q.defer();
  var textract = require('textract');
  textract.fromUrl(url,{preserveLineBreaks:true, typeOverride: 'application/pdf'}, function(error, text) {
    if (error) {
      deferred.reject(error);
    } else {
      deferred.resolve(text);
    }
  });
  return deferred.promise;
}
