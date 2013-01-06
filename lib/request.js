var Url = require('url')
  , Events = require('events')
  , Class= require('./class')
  , rHeaders = /([a-z0-9\-]+)\s*:\s*(.*)/ig
  , rHeaderLine = /([a-z]+) (.+) ([a-z0-9]+)\/([\.0-9]+)/i

function parseHeaderLine(line) {
  var match = rHeaderLine.exec(line)
  if(!match) return
  return {
    method: match[1].toLowerCase()
  , path: match[2]
  , protocol: match[3].toLowerCase()
  , version: match[4]
  }
}

function parseHeaders(buffer) {
  var match, headers = {}
  while(match = rHeaders.exec(buffer)) {
    headers[match[1].toLowerCase()] = match[2]
  }
  return headers
}

function buildUrl(host, port, headerline) {
  if(!headerline) {
    //guess the connection is https, not exactly
    if(port === 443)
      return 'https://'+host+'/'
    else
      return 'https://'+host+':'+port+'/'
  } else if(headerline.protocol === 'http') {
    if(port === 80)
      return 'http://'+host+headerline.path
    else
      return 'http://'+host+':'+port+headerline.path
  } else {
    return header.protocol+'://'+host+':'+port+headerline.path
  }
}

function captilize(s) {
  return s.charAt(0).toUpperCase()+s.substring(1)
}

var Request = Class.create(Class.extend({

  initialize: function(connection, host, port, clientAddress, clientPort, buffer) {
    this.connection = connection
    this.host = host
    this.port = +port
    this.clientAddress = clientAddress
    this.clientPort = clientPort
  }

, _bind: function() {
    this.connection
    .on('error', this.emit.bind(this, 'error'))
    .on('end', this.emit.bind(this, 'close'))
    .on('close', this.emit.bind(this, 'close'))
    .on('data', this.emit.bind(this, 'data'))
  }

, response: function(title, body) {
    if(this.protocol === 'http') {
      this.connection.write('<h1>'+title+'</h1><p>'+body+'</p>')
    } else {
      //this.connection.write(title)
    }
  }

, pause: function() {
    this.connection.pause()
  }

, resume: function() {
    this.connection.resume()
  }

, end: function() {
    this.connection.end()
  }

, write: function(data) {
    this.connection.write(data)
  }

, destroy: function() {
    this.connection.destroy()
  }

, toString: function() {
    if(this.url && this.protocol === 'http')
      return this.url
    return this.host+':'+this.port
  }

, toHttp: function() {
    if(this.protocol !== 'http') return
    var lines = []
    lines.push(this.method.toUpperCase()+' '+this.url+' HTTP/1.0')
    for(var name in this.headers) {
      lines.push(captilize(name)+': '+this.headers[name])
    }
    return lines.join("\r\n")+"\r\n\r\n"
  }

, httpOptions: function() {
    var proxy = this.proxy || this
    if(this.protocol === 'http') {
      return {
        host: proxy.host
      , port: proxy.port
      , path: this.url
      , method: this.method.toUpperCase()
      , headers: this.headers
      }
    } else {
      return {
        host: proxy.host
      , port: proxy.port
      , method: 'CONNECT'
      , path: this.host+':'+this.port
      }
    }
  }

}, Events.EventEmitter.prototype))


var SocksRequest = Request.extend({

  initialize: function(connection, host, port, clientAddress, clientPort, buffer) {
    this.__super__.initialize.call(this, connection, host, port, clientAddress, clientPort)
    this._buffer = buffer
    this._guess()
  }

  //parse the buffer to guest the protocol, if protocol is http, we can get the exact url
, _guess: function() {
    var buffer = this._buffer
      , headers = (buffer||'').toString()
      , p = headers.indexOf("\r\n"), p2 = headers.indexOf("\r\n\r\n")
      , headerline
    if(p > 0) {
      headerline = headers.substring(0, p)
      if(p2 > 0) {
        headers = parseHeaders(headers.substring(p+2, p2))
      }
    }
    headerline = parseHeaderLine(headerline)
    if(headerline) {
      this.protocol = headerline.protocol
      this.method = headerline.method
      this.httpVersion = headerline.version
      this.fullpath = headerline.path
    }
    if(typeof headers === 'object') {
      this.headers = headers
      if(headers.host) {
        p = headers.host.lastIndexOf(':')
        if(p > 0)
          this.host = headers.host.substring(0, p)
      }
    }
    this.url = buildUrl(this.host, this.port, headerline)
    this.isGuessed = true
  }

, pipe: function(socket) {
    if(this._buffer) {
      socket.write(this._buffer)
    }
    this.connection.pipe(socket)
  }

, body: function() {
    if(!this._buffer) return ''
    var p = this._buffer.toString().indexOf('\r\n\r\n')
    if(p > 0) {
      return this._buffer.slice(p+4).toString()
    }
    return ''
  }

})

exports.socks = function(connection, host, port, clientAddress, clientPort, buffer) {
  return new SocksRequest(connection, host, port, clientAddress, clientPort, buffer)
}

