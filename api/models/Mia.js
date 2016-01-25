/**
 * Mia.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs    :: http://sailsjs.org/#!documentation/models
 */

module.exports = {

  attributes: {
    clave : {
      unique : true,
      index : true
    },
    file_status_set : {
      type : 'boolean',
      defaultsTo: false
    },
    status : {
      model : 'status',
      dominant : true
    },
    entity : {
      model : 'entidad',
    },
    fecha_de_ingreso : {
      type: 'date',
      index : true
    },
    poligonos: {
      collection: 'poligono',
      via: 'mia',
      dominant: true,
    },
    gaceta : {
      model : 'gaceta'
    }

  },

};
