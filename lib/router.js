var Net = require('net')
  , Http = require('http')
  , Https = require('https')
  , Events = require('events')
  , Socks = require('./socks')
  , Class = require('./class')
  , Pac = require('./pac')

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

