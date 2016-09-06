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
    status : {
      model : 'status',
      dominant : true
    },
    entity : {
      model : 'entidad',
    },
    fechaIngreso : {
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
