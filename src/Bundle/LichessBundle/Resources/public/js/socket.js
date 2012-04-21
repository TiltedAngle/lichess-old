$.websocket = function(url, version, settings) {
  this.settings = {
    open: function(){},
    close: function(){},
    message: function(m){},
    events: {},
    params: { },
    options: {
      name: "unnamed",
      debug: true,
      offlineDelay: false,
      offlineTag: false,
      pingData: $.toJSON({t: "p"}),
      pingTimeout: 5000,
      pingDelay: 2000
    }
  };
  $.extend(true, this.settings, settings);
  this.url = url;
  this.version = version;
  this.options = this.settings.options;
  this.ws = null;
  this.fullUrl = null;
  this.offlineTimeout = null;
  this.pingTimeout = null;
  this.connect();
  $(window).unload(this._destroy);
}
$.websocket.available = window.WebSocket || window.MozWebSocket;
$.websocket.prototype = {
  addEvent: function(name, fn) { var self = this;
    var prev = self.settings.events[name];
    self.settings.events[name] = function(e) {
      if ($.isFunction(prev)) prev(e);
      fn(e); 
    };
  },
  connect: function() { var self = this;
    self._destroy();
    self.fullUrl = self.url + "?" + $.param($.extend(self.settings.params, { version: self.version }));
    self._debug("connection attempt to " + self.fullUrl);
    if (window.MozWebSocket) self.ws = new MozWebSocket(self.fullUrl); 
    else if (window.WebSocket) self.ws = new WebSocket(self.fullUrl); 
    else self.ws = {
      send: function(m){ return false },
        close: function(){}
    }; 
    $(self.ws)
      .bind('open', function() {
        self._debug("connected to " + self.fullUrl);
        if (self.offlineTimeout) clearTimeout(self.offlineTimeout);
        if (self.options.offlineTag) self.options.offlineTag.hide(); 
        self.settings.open();
      })
    .bind('close', function() {
      self._debug("disconnected");
      if (self.options.offlineDelay && !self.offlineTimeout) self.offlineTimeout = setTimeout(function() { 
        self.options.offlineTag.show(); 
      }, self.options.offlineDelay);
      self.settings.close();
    })
    .bind('message', function(e){
      var m = $.parseJSON(e.originalEvent.data);
      if (m.t != "n") self._debug(m);
      if (m.t == "p") self.keepAlive();
      else if (m.t == "batch") {
        $(m.d || []).each(function() { self._handle(this); });
      } else {
        self._handle(m);
      }
    });
    self.keepAlive();
  },
  keepAlive: function() {
    var self = this;
    clearTimeout(self.pingTimeout);
    setTimeout(function() {
        self._debug("ping!");
      try {
        self.ws.send(self.options.pingData);
        self.pingTimeout = setTimeout(function() {
          self._debug("reconnect!");
          self.connect();
        }, self.options.pingTimeout);
      } catch (e) {
        self._debug(e);
        self.connect();
      }
    }, self.options.pingDelay);
  },
  send: function(t, d) { 
    var data = d || {};
    this._debug({t: t, d: data});
    return this.ws.send($.toJSON({t: t, d: data})); 
  },
  disconnect: function() { 
    this.ws.close(); 
  },
  _handle: function(m) { var self = this;
    if (m.v) self.version = m.v;
    var h = self.settings.events[m.t];
    if ($.isFunction(h)) h(m.d || null);
    else self._debug(m.t + " not supported");
    self.settings.message(m);
  },
  _debug: function(msg) { if (this.options.debug) console.debug("[" + this.options.name + "]", msg); },
  _destroy: function() { if (this.ws) { this.disconnect(); this.ws = null; } }
}
