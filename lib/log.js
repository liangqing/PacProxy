var Util = require('util')
  , levels = 'debug info warn error'.split(' ')
  , levelMap = {}

levels.forEach(function(name, index) {
  levelMap[name] = index
})

exports.create = function(options) {
  var level = levelMap[options.level] || 0
    , funcs = {}
    , slice = Array.prototype.slice
  levels.forEach(function(name, index){
    var upper = name.toUpperCase()
    if(upper.length === 4) upper+=' '
    funcs[name] = function() {
      if(level <= index) {
        var args = slice.call(arguments, 0)
          , now = (new Date()).toJSON()
        args.unshift(upper)
        args.unshift(now)
        args.unshift('%s')
        Util.puts(Util.format.apply(Util, args))
      }
    }
  })
  return funcs
}
