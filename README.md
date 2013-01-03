PacProxy
========

A socks proxy server that use PAC file to decide how to forward request

Features
--------
* Implement a socks server(support socks4 and socks5, no authentication module)
* Using PAC file to decide how to forward request

Install
-------
1. Install [node.js](http://nodejs.org/)
2. Download [PacProxy](https://github.com/liangqing/PacProxy/archive/master.zip), and uncompress it
3. If you need modify the default configuration, copy config.sample.js to config.js, and modify config.js to set the configuration, such as server bind address or port
4. Run PacProxy.bat(windows only), or command line:

  ```
  node ProxyServer.js
  ```

5. Set the browser's proxy to 127.0.0.1:9999(socks5)

Notes
-----
1. IE/Chrome(without proxy extension) will send socks4 request to socks proxy server, * it is not recommended *, so please install a proxy extension to chrome, such as [Foxy Proxy Standard](https://chrome.google.com/webstore/detail/foxy-proxy-standard/gcknhkkoolaabfmlnjonogaaifnjlfnp)
2. If using firefox, please goto about:config and set 'network.proxy.socks_remote_dns' to 'true'

Issues
------
* No authentication feature in PacProxy
* Now it can only forward request to socks5 server(do not support socks4)
* Because FindProxyForURL need a url parameter, so we need cheating the socks client to guess the real http url for FindProxyForURL.
* Because the built-in DNS module of nodejs provide only asynchronous call, so any DNS resolve related function(dnsResolve, isInNet, isResolvable) in PAC is faked. The program is maintaining a DNS cache table, DNS resolve function can only get result in the table. If your PAC don't call DNS resolve function, you can disable this function in configuration file.

TODO
----
* Provide configuration function [done]
* Add support for http/https/socks4 proxy forwarding
