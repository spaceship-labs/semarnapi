module.exports.connections = {
  mongo: {
    adapter: 'sails-mongo',
    url: process.env.DB_URL,
  },
};