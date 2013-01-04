var Net = require('net')
  , Http = require('http')
  , Https = require('https')
  , Events = require('events')
  , Socks = require('./socks')
  , Class = require('./class')
  , Pac = require('./pac')

function captilize(s) {
  return s.charAt(0).toUpperCase()+s.substring(1)
}

function httpConnectCallback(request, callback) {
  function strip(data) {
    var str = data.toString()
      , p = str.indexOf('\r\n\r\n')
    if(p > 0) {
      if(p+4 < data.length) {
        request.write(data.slice(p+4))
      }
      callback()
      this.removeListener('data', strip)
    }
  }
  return function() {
    this
    .on('data', strip)
    .write(new Buffer('CONNECT '+request.host+':'+request.port+' HTTP/1.0\r\n\r\n'))
  }
}
  
function httpConnect(request, callback) {
  return Net.connect(request.proxy, httpConnectCallback(request, callback))
}

function http() {
}

var connectors = {

  direct: function(request, callback) {
    return Net.connect(request, callback)
  }

, socks5: function(request, callback) {
    return Socks.connect(request, callback)
  }

//, socks4: function(request, callback) {
  //}

, http: function(request, callback) {
    if(request.protocol === 'http') {
      request._buffer = new Buffer(request.toHttp())
      return Net.connect(request.proxy, callback)
    } else {
      return httpConnect(request, callback)
    }
  }

, https: function(request, callback) {
    var options = request.httpOptions()
    var req = Https.request(options)
    .on('response', function(res) {
      var lines = ['HTTP/1.0 '+res.statusCode+' OK']
      delete res.headers['transfer-encoding']
      delete res.headers['keep-alive']
      delete res.headers['connection']
      for(var name in res.headers) {
        if(name === 'set-cookie') {
          for(var cookie in res.headers[name]) {
            lines.push('Set-cookie: '+res.headers[name][cookie])
          }
        } else {
          lines.push(captilize(name)+': '+res.headers[name])
        }
      }
      lines = lines.join('\r\n')+'\r\n\r\n'
      request.write(new Buffer(lines))
      res.on('data', function(data) {
        request.write(data)
      })
      .on('end', function(data) {
        request.end()
      })
      request.on('data', function(data) {
        req.write(data)
      })
      request.resume()
    })
    .on('connect', function(req, socket, head) {
      request.resume()
      request.pipe(socket)
    })
    if(request._buffer) {
      var p = request._buffer.toString().indexOf('\r\n\r\n')
      if(p > 0 && request._buffer.length >= p+4) {
        req.write(request._buffer.slice(p+4))
      }
    }
    req.end()
    return req
  }

}

connectors.socks = connectors.socks5

var Router = Class.create(Class.extend({

  initialize: function(pac) {
    this.pac = pac
  }

, _proxyFound: function(request, proxyList, err, proxyChoose) {
    var emit = function(e) {
          var args = Array.prototype.slice.call(arguments, 1)
          args.unshift(request)
          args.unshift(e)
          this.emit.apply(this, args)
        }.bind(this)
      , proxy
    proxyChoose = proxyChoose || 0
    proxy = proxyList[proxyChoose]
    if(!proxy) {
      emit('NoProxyAvailable', proxyList)
      request.response('No proxy available, proxy list:', JSON.stringify(proxyList))
      request.end()
      request.destroy()
      return
    }
    if(err) {
      emit('error', err)
    }
    var connector = connectors[proxy.type]
    if(!connector) {
      emit('proxyUnsupported', proxy)
      request.destroy()
      return
    }
    emit('proxyFound', proxy)
    request.proxy = proxy
    var remote = connector(request, function() {
      emit('proxyConnected', proxy)
      remote
      .on('end', function(err) {
        emit('remoteClose')
        request.end()
      })
      .on('close', function(err) {
        emit('remoteClose')
        request.end()
      })
      request.pipe(remote.socket || remote)
      request.resume()
    })
    .on('error', function(err) {
      if(err.syscall === 'connect') {
        emit('proxyCannotConnected', proxy)
        this._proxyFound(request, proxyList, err, proxyChoose+1)
        return
      }
      emit('error', err)
      request.response('Server Error', JSON.stringify(err))
      request.destroy()
      remote.destroy()
    }.bind(this))
    request.on('close', function() {
      remote.end()
    })
  }

, forward: function(request) {
    request.pause()
    this.pac.find(request.url, request.clientAddress, this._proxyFound.bind(this, request))
    return this
  }

}, Events.EventEmitter.prototype))

exports.create = function(pac) {
  return new Router(Pac.create(pac))
}

