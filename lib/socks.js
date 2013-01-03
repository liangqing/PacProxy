/*
 *
 * A simple implementation of RFC1928
 * Do not support any socks authentication
 *
 */

var Net = require('net')
  , Events = require("events")
  , Class = require('./class')
  , IP = require('./ip')

//debug protocol
function debug(s) {
  //console.log('SOCKS DEBUG '+s)
}

var Address = Class.create({

  initialize: function(data) {
    if(Buffer.isBuffer(data)) {
      this.fromBuffer(data)
    } else {
      this.family = data.family
      this.host = data.host || data.address
      this.port = data.port
      this.address = this.host
    }
  }

, fromBuffer: function(buffer) {
    var ATYP = buffer.readUInt8(0)
      , host, port , domainLen
    if(ATYP == 0x01) {
        this.family = 'IPv4'
        this.host = IP.toString(buffer.slice(1, 5))
        this.port = buffer.readUInt16BE(5)
    } else if(ATYP == 0x03) {
      domainLen = buffer.readUInt8(1)
      this. family= 'domain'
      this.host = buffer.toString('ascii', 2, domainLen+2)
      this.port = buffer.readUInt16BE(domainLen+2)
    } else if(ATYP == 0x04) {
      this.family = 'IPv6'
      this.host = IP.toString(buffer.slice(1, 17))
      this.port = buffer.readUInt16BE(17)
    }
  }

, toBuffer: function() {
    var ATYP, ADDR, PORT = new Buffer(2)
      , host = this.address || this.host
      , family = this.family || 'IPv4'
      , port = this.port
    try {
      ADDR = IP.toBuffer(host)
      if(ADDR.length === 6)
        family = 'IPv6'
    } catch(e) {
      family = 'domain'
    }
    if(family === 'IPv4') {
      ATYP = 1
    } else if(family === 'domain') {
      ATYP = 3
      ADDR = Buffer.concat([new Buffer([host.length]), new Buffer(host, 'ascii')])
    } else if(family === 'IPv6') {
      ATYP = 4
    }
    PORT.writeUInt16BE(port, 0)
    return Buffer.concat([
            new Buffer([ATYP])
          , ADDR
          , PORT
          ])
  }

, toString: function() {
    return this.host+':'+this.port
  }

})

//Finit State Mashine based on socket input data
var SocketFSM = Class.create(Class.extend({

  initialize: function(socket) {
    var fsm = this
    this.socket = socket
    this.state = 'begin'
    if(this.socket) {
      this.bindSocket()
    }
    Events.EventEmitter.call(this)
  }

, bindSocket: function() {
    this.socket
    .on('data', this.transition.bind(this))
    .on('end', this.emit.bind(this, 'end'))
    .on('close', this.emit.bind(this, 'close'))
    .on('error', this.emit.bind(this, 'error'))
  }

, transition: function(data) {
    this[this.state](data)
  }

, begin: function() {
    this.state = 'end'
  }

, end: function() {
    this.socket.end()
  }

}, Events.EventEmitter.prototype))

//State changes:
//  begin -> request -> proxy -> end
//
//Events:
//  request, client request is comming
//  clientData, data come from client
//  remoteData, data come from remote host
//  end
var serverConnection = SocketFSM.extend({

  initialize: function(socket) {
    this.__super__.initialize.call(this, socket)
    this.remoteAddress = this.socket.remoteAddress
    this.remotePort = this.socket.remotePort
  }

, begin: function(data) {
    this.version = data.readUInt8(0)
    if(this.version === 4) {
      this.begin4(data)
    } if(this.version === 5) {
      this.begin5(data)
    }
  }

, begin4: function(data) {
    var CMD = data.readUInt8(1)
      , port = data.readUInt16BE(2)
      , host = IP.toString(data.slice(4, 8))
      , address = new Address({
          host: host
        , port: port
        })
    debug('client using version 4')
    if(CMD === 0x1) {
      this.request(address)
    } else {
      debug('unsupport CMD('+CMD+') in version 4')
      this.end()
    }
  }

, begin5: function(data) {
    var nMethod = data.readUInt8(1)
      , socket = this.socket
    debug('client using version 5')
    debug('nMethod:'+nMethod)
    for(;nMethod--;) {
      debug('method:'+data.readUInt8(nMethod+2))
    }
    socket.write(new Buffer([0x05, 0x00]), function() {
      debug('reply version and methods');
    })
    this.state = 'request5'
  }

, request5: function(data) {
    var version = data.readUInt8(0)
      , CMD = data.readUInt8(1)
      , address = new Address(data.slice(3))
    debug('version:'+version)
    debug('CMD:'+CMD)
    debug('RSV:'+data.readUInt8(2))
    if(CMD === 0x1) {
      this.request(address)
    } else {
      debug('unsupport CMD('+CMD+') in version 5')
      this.end()
    }
  }

, request: function(address) {
    var listeners = this.listeners('request')
    if(listeners.length === 0) {
      //connect directly
      this.directConnect(address)
    } else {
      //delegate request event to others
      this.emit('request', address)
    }
    this.state = 'proxy'
  }

, directConnect: function(address) {
    var remote = Net.connect(address, function() {
      this.reply(0, remote.address())
      this.pipe(remote)
    }.bind(this))
    return remote
  }

, pipe: function(remote) {
    debug('piping data: '+this.socket.remoteAddress+':'+this.socket.remotePort+'<->'+remote.remoteAddress+':'+remote.remotePort)
    this.socket.pipe(remote)
    remote
    .on('data', this.emit.bind(this, 'remoteData'))
    .on('end', this.end.bind(this))
    .pipe(this.socket)
  }

, reply: function(REP, address) {
    var buffer
    if(this.version === 4) {
      buffer = Buffer.concat([
        new Buffer([0, 0x5A])
      , new Buffer(2)
      , new Buffer(4)
      ])
    } else if(this.version === 5) {
      buffer = Buffer.concat([
        new Buffer([5, REP, 0])
      , (new Address(address)).toBuffer()
      ])
    }
    this.socket.write(buffer)
  }

, proxy: function(data) {
    this.emit('data', data)
  }

, pause: function() {
    return this.socket.pause()
  }

, resume: function() {
    return this.socket.resume()
  }

, destroy: function() {
    return this.socket.destroy()
  }

, write: function(data) {
    return this.socket.write(data)
  }

, address: function() {
    return this.socket.address()
  }

})

//State changes:
//  begin -> negotiated -> connected -> data -> end
//
//Options:
//  host
//  port
//  proxy: {
//    host
//    port
//  }
//
//Events:
//  connect, connection is negotiated
//  data, data come from remote host
//  error, error return by proxy server
//  end
var clientConnection = SocketFSM.extend({

  initialize: function(options, listener) {
    this.__super__.initialize.call(this, Net.connect(options.proxy))
    this.dst = new Address(options)
    this.socket.on('connect', this.begin.bind(this))
    this.state = 'negotiated'
    if(typeof listener === 'function') {
      this.on('connect', listener)
    }
  }

, begin: function() {
    this.socket.write(new Buffer([5, 1, 0]))
    this.state = 'negotiated'
  }

, negotiated: function(data) {
    var version = data.readUInt8(0)
      , method = data.readUInt8(1)
    debug('version:'+version)
    debug('method:'+method)
    this.socket.write(Buffer.concat([new Buffer([5 , 1 , 0]), this.dst.toBuffer()]))
    this.state = 'connected'
  }

, connected: function(data) {
    var version = data.readUInt8(0)
      , reply = data.readUInt8(1)
    debug('version:'+version)
    debug('reply:'+reply)
    if(reply === 0) {
      this.state = 'data'
      this.emit('connect')
    } else {
      debug('request failed: reply code is ' + reply)
      this.emit('error', reply)
    }
  }

, data: function(data) {
    this.emit('data', data)
  }

, write: function(data) {
    if(this.state === 'data')
      this.socket.write(data)
  }

, destroy: function() {
    this.socket.destroy()
  }

})

exports.server = function(bindAddress, connectListener) {
  var host = bindAddress.host || 0
    , port = bindAddress.port
  return Net.createServer(function(socket) {
    connectListener.call(new serverConnection(socket))
  })
  .listen(port, host, function() {
    console.log('Proxy server bound on '+host+':'+port);
  })
}

exports.connect = function(options, connectListener) {
  return new clientConnection(options, connectListener)
}




