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
    headers[match[1].toLowerCase()] = match[2].toLowerCase()
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

var Request = Class.create(Class.extend({

  initialize: function(connection, host, port, clientAddress, clientPort, buffer) {
    this.connection = connection
    this.host = host
    this.port = port
    this.clientAddress = clientAddress
    this.clientPort = clientPort
  }

, _bind: function() {
    this.connection
    .on('error', this.emit.bind(this, 'error'))
    .on('end', this.emit.bind(this, 'close'))
    .on('close', this.emit.bind(this, 'close'))
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

, destroy: function() {
    this.connection.destroy()
  }

, toString: function() {
    if(this.url && this.protocol === 'http')
      return this.url
    return this.host+':'+this.port
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
    }
    if(typeof headers === 'object') {
      this.headers = headers
      if(headers.host)
        this.host = headers.host
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

})

exports.socks = function(connection, host, port, clientAddress, clientPort, buffer) {
  return new SocksRequest(connection, host, port, clientAddress, clientPort, buffer)
}

