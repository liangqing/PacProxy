var Net = require('net')
  , Http = require('http')
  , Https = require('https')
  , Events = require('events')
  , Socks = require('./socks')
  , Class = require('./class')
  , Pac = require('./pac')

function response(title, content) {
  content = content || title
  this.write('<h1>'+title+'</h1>\n'+content)
}

var connectors = {

  direct: function(request, callback) {
    delete request.path
    return Net.connect(request, callback)
  }

, socks5: function(request, callback) {
    return Socks.connect(request, callback)
  }

//, socks4: function(request, callback) {
  //}

//, http: function(request, callback) {
  //}

//, https: function(request, callback) {
  //}

}

connectors.socks = connectors.socks5

var Router = Class.create(Class.extend({

  initialize: function(pac) {
    this.pac = pac
  }

, _proxyFound: function(request, proxy, err) {
    var connection = request.connection
      , emit = function(e) {
          var args = Array.prototype.slice.call(arguments, 1)
          args.unshift(request)
          args.unshift(e)
          this.emit.apply(this, args)
        }.bind(this)
    if(!proxy && err) {
      emit('error', err)
      connection.end()
      return 
    }
    proxy = proxy[0]
    request.proxy = proxy
    var connector = connectors[proxy.type]
    if(!connector) {
      emit('proxyUnsupported', proxy)
      connection.end()
      return
    }
    emit('proxyFound', proxy)
    var remote = connector(request, function() {
      emit('proxyConnected', proxy)
      connection.pipe(remote.socket || remote)
      connection.resume()
      if(request.buffer)
        remote.write(request.buffer)
    })
    .on('error', function(err) {
      emit('error', err)
      connection.destroy()
      remote.destroy()
    })
    .on('end', function() {
      connection.end()
    })
    .on('close', function() {
      connection.end()
    })
  }

, forward: function(request) {
    var connection = request.connection
    connection.pause()
    connection.response = response
    this.pac.find(request.url, connection.remoteAddress, this._proxyFound.bind(this, request))
    return this
  }

}, Events.EventEmitter.prototype))

exports.create = function(pac) {
  return new Router(Pac.create(pac))
}

