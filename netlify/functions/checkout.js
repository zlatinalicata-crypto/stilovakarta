const { checkout } = require('../../lib/server.js');
exports.handler = async (event) => checkout(event);
