
function extend(obj) {
  var len = arguments.length
    , i, name, objextend

  for(i=1;i<len;i++) {
    objextend = arguments[i]
    if(typeof objextend === 'object') {
      for(name in objextend) {
        obj[name] = objextend[name]
      }
    }
  }
  return obj
}

function Class(def, staticMethods) {
  function Cls(){
    if(typeof def.initialize === 'function')
      def.initialize.apply(this, arguments)
  }
  Cls.prototype = def
  extend(Cls, staticMethods, def)
  Cls.extend = function(subDef, subStaticMethods) {
    return Class(extend({__super__:Cls}, def, subDef), extend({__super__:Cls}, staticMethods, subStaticMethods))
  }
  return Cls
}

exports.create = Class
exports.extend = extend
