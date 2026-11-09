const { report } = require('../../lib/server.js');
exports.handler = async (event) => report(event);
