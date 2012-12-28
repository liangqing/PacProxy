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
3. Run PacProxy.bat(windows only), or command line:

  ```
  node ProxyServer.js
  ```

4. Set the browser's proxy to 127.0.0.1:9999(socks5)

Notes
-----
1. Because there is no configuration file(will provide in next phase), you need modify source code(ProxyServer.js) to change bind address/port or path of the PAC file
2. Default bind address is 127.0.0.1:9999
3. Default PAC file is autoproxy.pac in same directory
4. IE/Chrome(without proxy extension) will send socks4 request to socks proxy server, * it is not recommended *, so please install a proxy extension to chrome, such as [Foxy Proxy Standard](https://chrome.google.com/webstore/detail/foxy-proxy-standard/gcknhkkoolaabfmlnjonogaaifnjlfnp)
5. If using firefox, please goto about:config and set 'network.proxy.socks_remote_dns' to 'true'

Issues
------
* No authentication feature in PacProxy
* Now it can only forward request to direct connecting or socks5 server(do not support socks4)
* Because FindProxyForURL need a url parameter, so we need cheating the socks client to guess the real http url to FindProxyForURL.
* Because the built-in DNS module of nodejs provide only asynchronous call, so any DNS resolve related function in PAC is faked. The program is maintaining a DNS cache table, DNS resolve function can only get result in the table.

TODO
----
* Provide configuration function
* Add support for http/https/socks4 proxy forwarding
