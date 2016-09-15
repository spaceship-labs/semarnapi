/**
 * MiaController.js 
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

module.exports = {
  getDoc: function(req, res) {
    var clave = req.param('clave');
    var doc = req.param('doc');
    //clave = '23QR2016TD083';
    //doc = 'resumen';
    Mia.findOne({ clave: clave }).then(function(mia) {
      if (mia) {
        var url = mia[doc];
        TextService.openUrl(url).then(function(text) {
          res.json({ text: text });
        });
      } else {
        res.json({ error: 'could not find' });
      }
    });
  },
  findCoordinates: function(req, res) {
    Mia.findOne({ clave: req.param('id') }).exec(function(e, mia) {
      if (mia[req.param('filetype') + "_file"]) {
        searchPDF(mia[req.param('filetype') + "_file"], function(e, pdf) {
          res.send(pdf);
        });
      } else {
        //TODO no hay archivo
        res.json(mia);
      }

    });
  },
  convertUTM: function(req, res) {
    var points = req.param('points');
    var converter = require('coordinator');
    var fn = converter('utm', 'latlong');
    var new_points = [];
    points.forEach(function(point) {
      latlong = fn(point.y, point.x, 16);
      new_points.push({ x: latlong.latitude, y: latlong.longitude });
    });
    res.json(new_points);
  },
  savePolygon: function(req, res) {
    Mia.findOne({ clave: req.param('mia') }).exec(function(e, mia) {
      if (e) throw (e);
      var poligono = req.param('poligono');
      poligono.mia = mia.id;
      //todo checar si ya existe el poligono
      Poligono.create(poligono, function(e, p) {
        if (e) throw (e);
        res.json(p);
      });
    });
  },
};
