var Net = require('net')
  , Http = require('http')
  , Https = require('https')
  , Socks = require('./lib/socks')
  , Logger = require('./lib/log')
  , forwardRequest = require('./lib/forward').create('pacfiles/autoproxy.pac')
  , Url = require('url')
  , bindAddress = {
      host: '127.0.0.1'
    , port: 9999
    }
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

function buildUrl(address, headerline) {
  var host = address.host
    , port = address.port
  if(!headerline) {
    //guess the connection is https, not exactly
    if(port === 443)
      return 'https://'+address.host+'/'
    else
      return 'https://'+address.host+':'+port+'/'
  } else if(headerline.protocol === 'http') {
    if(port === 80)
      return 'http://'+address.host+headerline.path
    else
      return 'http://'+address.host+':'+port+headerline.path
  } else {
    return header.protocol+'://'+address.host+':'+port+headerline.path
  }
}

//parse the data to guest the protocol, if protocol is http, we can get the exact url
function guessRequest(request) {
  var headers = (request.buffer || '').toString()
    , p = headers.indexOf("\r\n")
    , headerline
  if(p > 0) {
    headerline = headers.substring(0, p)
  }
  headerline = parseHeaderLine(headerline)
  if(headerline) {
    request.method = headerline.method
    request.httpVersion = headerline.version
  }
  request.url = buildUrl(request, headerline)
  request.isGuessed = true
  return request
}

Socks.server(bindAddress, function() {
  var request = {}
  this
  .on('end', function() {
    Logger.debug('socks connection ended')
  })
  .on('request', function(address) {
    request.host = address.host
    request.port = address.port
    Logger.debug('New request, address:'+address)
    //cheat the client that every thing is ok
    this.reply(0, this.address())
    //Do not need guess request by incoming data
    if(address.port === 22 || address.port === 23 || address.port === 443) {
      guessRequest(request)
      forwardRequest(this, request)
    }
  })
  .on('data', function(data) {
    if(request.isGuessed) return
    request.buffer = data
    guessRequest(request)
    forwardRequest(this, request)
  })
  .on('error', function(err) {
    Logger.error('Error occurs in client connection:'+JSON.stringify(err))
  })
})
.on('error', function(err) {
  Logger.error('Error occurs in socks server:'+JSON.stringify(err))
})



