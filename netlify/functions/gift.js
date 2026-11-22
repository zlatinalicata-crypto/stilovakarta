const { gift } = require('../../lib/server.js');
exports.handler = async (event) => gift(event);
