var Util = require('util')

exports.debug = function(s) {
  //Util.debug(Util.inspect(s))
}

exports.info = function(s) {
  Util.log(Util.inspect(s))
}

exports.error = function(s) {
  Util.error(Util.inspect(s))
}
