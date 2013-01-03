var Net = require('net')
  , Http = require('http')
  , Https = require('https')
  , Socks = require('./lib/socks')
  , Request = require('./lib/request')
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
  , router , logger, config

try {
  config = require('./lib/class.js').extend(true, {}, defaultConfig, require('./config').config)
} catch(err) {
  console.log('Failed to load config file, use default configuration')
  config = defaultConfig
}

logger = require('./lib/log').create(config.logger)

router = require('./lib/router').create(config.pac)
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
  logger.error('Unsupported proxy type: '+proxy.type)
})
.on('remoteClose', function(request) {
  logger.info('Remote connection ended: '+request)
})
.on('error', function(request, err) {
  if(err.syscall == 'getaddrinfo') {
    logger.error("Failed to resolve host '"+request.host+"': "+JSON.stringify(err))
  } else {
    logger.error(JSON.stringify(err))
  }
})

Socks.server(config.binding, function() {
  var client = this.remoteAddress+':'+this.remotePort
    , isForwarded = false
  logger.info('New socks connection from '+client)
  this
  .on('request', function(ad) {
    address = ad
    logger.debug('Socks request('+address+')'+' from '+client)
    //cheat the client that every thing is ok
    this.reply(0, this.address())
    //Do not need guess request by incoming data
    if(address.port === 22 || address.port === 23 || address.port === 443) {
      router.forward(Request.socks(this, address.host, address.port, this.remoteAddress, this.remotePort))
      isForwarded = true 
    }
  })
  .on('data', function(data) {
    if(isForwarded) return
    router.forward(Request.socks(this, address.host, address.port, this.remoteAddress, this.remotePort, data))
    isForwarded = true 
  })
  .on('error', function(err) {
    logger.error('Error occurs in client connection('+request.host+':'+request.port+'):'+JSON.stringify(err))
  })
  .on('end', function() {
    logger.debug('Socks connection ended from '+client)
  })

})
.on('error', function(err) {
  logger.error('Error occurs in socks server:'+JSON.stringify(err))
})

