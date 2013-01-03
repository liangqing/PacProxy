
function extend(obj) {
  var len = arguments.length
    , i=1, name, objextend, deep

  if(typeof obj === 'boolean') {
    deep = obj
    obj = arguments[1]
    i++
  }

  for(;i<len;i++) {
    objextend = arguments[i]
    if(typeof objextend === 'object') {
      for(name in objextend) {
        if(deep
            && typeof obj[name] === 'object'
            && typeof objextend[name] === 'object') {
          extend(true, obj[name], objextend[name])
        } else {
          obj[name] = objextend[name]
        }
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
