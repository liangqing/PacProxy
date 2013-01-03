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
    var emit = function(e) {
          var args = Array.prototype.slice.call(arguments, 1)
          args.unshift(request)
          args.unshift(e)
          this.emit.apply(this, args)
        }.bind(this)
    if(!proxy && err) {
      emit('error', err)
      request.end()
      return 
    }
    proxy = proxy[0]
    request.proxy = proxy
    var connector = connectors[proxy.type]
    if(!connector) {
      emit('proxyUnsupported', proxy)
      request.end()
      return
    }
    emit('proxyFound', proxy)

    var remote = connector(request, function() {
      emit('proxyConnected', proxy)
      request.pipe(remote.socket || remote)
      request.resume()
    })
    .on('error', function(err) {
      emit('error', err)
      request.destroy()
      remote.destroy()
    })
    .on('end', function() {
      emit('remoteClose')
      request.end()
    })
    .on('close', function() {
      request.end()
    })
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

