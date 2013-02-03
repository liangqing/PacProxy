exports.config = {

  //proxy server related
  server: {

    //proxy server type, should be socks/http/https
    type: "socks"

    //binding host, if you want to bind in every address, please set it to number 0
  , host: '127.0.0.1'

    //bind port
  , port: 9999

  }

  //PAC file related
, pac: {

    // PAC file path
    path: 'autoproxy.pac'

    //if your PAC file don't use any DNS related function(dnsResolve, isInNet, isResolvable), you can make this configuration be true, it will improve a bit performance
  , disableDNS: false

  }

  //logging related
, logger: {
    // log level
    level: 'info'
  }

}
