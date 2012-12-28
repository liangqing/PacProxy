var Net = require('net')
  , Http = require('http')
  , Https = require('https')
  , Socks = require('./socks')
  , Logger = require('./log')
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

function forwardRequest(pac, connection, request) {
  connection.pause()
  connection.response = response
  pac.find(request.url, connection.remoteAddress, function(proxy, err) {
    if(!proxy && err) {
      Logger.error(err)
      connection.response('DNS parse error', JSON.stringify(err))
      return connection.end()
    }
    Logger.info("proxy choosed for "+request.url+': '+JSON.stringify(proxy))
    proxy = proxy[0]
    request.proxy = proxy
    var forwardproxy = connectors[proxy.type]
    if(!forwardproxy) {
      Logger.error('unsupport forward type: socks4')
      connection.response('unsupport forward type: socks4')
      connection.end()
      return
    }
    var remote = forwardproxy(request, function() {
      connection.pipe(remote.socket || remote)
      connection.resume()
      if(request.buffer)
        remote.write(request.buffer)
    })
    .on('error', function(err) {
      if(err.code === 'ECONNREFUSED') {
        Logger.error('Can not connect to proxy '+proxy.host+':'+proxy.port+' '+JSON.stringify(err))
        connection.response('Can not connect to proxy '+proxy.host+':'+proxy.port, JSON.stringify(err))
      } else {
        Logger.error('Error occurs in remote connection('+request.host+':'+request.port+'):'+JSON.stringify(err))
        connection.response('Error occurs in remote connection('+request.host+':'+request.port+'):', JSON.stringify(err))
      }
      connection.destroy()
      remote.destroy()
    })
    .on('end', function() {
      connection.end()
    })
    .on('close', function() {
      connection.end()
    })
  })
}

exports.create = function(pacfile) {
  var pac = Pac.create(pacfile)
  return forwardRequest.bind(null, pac)
}


