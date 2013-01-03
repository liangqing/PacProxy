var Net = require('net')
  , Http = require('http')
  , Https = require('https')
  , Socks = require('./lib/socks')
  , Url = require('url')
  , defaultConfig = {
      binding: {
        host: '127.0.0.1'
      , port: 9999
      }
    , pac: {
        path: 'autoproxy.pac'
      , disableDNS: false
      }
    , logger: {
        level: 'info'
      }
    }
  , rHeaders = /([a-z0-9\-]+)\s*:\s*(.*)/ig
  , rHeaderLine = /([a-z]+) (.+) ([a-z0-9]+)\/([\.0-9]+)/i
  , router , logger, config

try {
  config = require('./lib/class.js').extend(true, {}, defaultConfig, require('./config').config)
} catch(err) {
  console.log('Failed to load config file, use default configuration')
  config = defaultConfig
}

logger = require('./lib/log').create(config.logger)
router = require('./lib/router').create(config.pac)

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

function parseHeaders(data) {
  var match, headers = {}
  while(match = rHeaders.exec(data)) {
    headers[match[1].toLowerCase()] = match[2].toLowerCase()
  }
  return headers
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
    request.protocol = headerline.protocol
    request.method = headerline.method
    request.httpVersion = headerline.version
  }
  if(typeof headers === 'object') {
    request.headers = headers
    if(headers.host)
      request.host = headers.host
  }
  request.url = buildUrl(request, headerline)
  request.isGuessed = true
  return request
}

router
.on('proxyFound', function(request, proxy) {
  logger.info('Proxy('+JSON.stringify(proxy)+') found for '+request)
})
.on('proxyConnected', function(request, proxy) {
  if(proxy.type === 'direct') {
    logger.info('Connected to '+request)
  } else {
    logger.info('Connected to proxy '+JSON.stringify(proxy)+' for '+request)
  }
})
.on('proxyUnsupported', function(request, proxy) {
  logger.error('unsupported proxy type: '+proxy.type)
})
.on('error', function(request, err) {
  if(err.syscall == 'getaddrinfo') {
    logger.error("Failed to resolve host '"+request.host+"': "+JSON.stringify(err))
  } else {
    logger.error(JSON.stringify(err))
  }
})

Socks.server(config.binding, function() {
  var request = {
      connection: this
    , toString: function() {
        if(request.url && request.protocol === 'http')
          return request.url
        return request.host+':'+request.port
      }
    }
  , client = this.remoteAddress+':'+this.remotePort

  logger.info('New socks connection from '+client)
  this.on('end', function() {
    logger.debug('Socks connection ended from '+client)
  })
  .on('request', function(address) {
    request.host = address.host
    request.port = address.port
    logger.debug('Socks request('+address+')'+' from '+client)
    //cheat the client that every thing is ok
    this.reply(0, this.address())
    //Do not need guess request by incoming data
    if(address.port === 22 || address.port === 23 || address.port === 443) {
      guessRequest(request)
      router.forward(request)
    }
  })
  .on('data', function(data) {
    if(request.isGuessed) return
    request.buffer = data
    guessRequest(request)
    router.forward(request)
  })
  .on('error', function(err) {
    logger.error('Error occurs in client connection('+request.host+':'+request.port+'):'+JSON.stringify(err))
  })
})
.on('error', function(err) {
  logger.error('Error occurs in socks server:'+JSON.stringify(err))
})



