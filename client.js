var lib = require("./lib.js");
var WebSocket = require("isomorphic-ws");

module.exports = function client({url = "ws://localhost:7171"} = {}) {
  var ws = new WebSocket(url);
  var Posts = {};
  var watching = {};

  // Waits ws to be ready and then sends buffer to server
  function ws_send(buffer) {
    if (ws.readyState === 1) {
      ws.send(buffer);
    } else {
      setTimeout(() => ws_send(buffer), 20);
    }
  }

  // Time sync variables
  var last_ask_time = null; // last time we pinged the server
  var last_ask_numb = 0; // id of the last ask request
  var best_ask_ping = Infinity; // best ping we got
  var delta_time = 0; // estimated time on best ping
  var ping = 0; // current ping

  // User-defined callbacks
  var on_init_callback = null;
  var on_post_callback = null;

  // Sets the on_init callback
  function on_init(callback) {
    on_init_callback = callback;
  }

  // Sets the on_post callback
  function on_post(callback) {
    on_post_callback = callback;
  }

  // Sends a signed post to a room on the server
  function send_post(post_room, post_user, post_data) {
    var post_room = lib.check_hex(64, post_room);
    var post_user = lib.check_hex(64, post_user);
    var post_data = lib.check_hex(null, post_data);
    var msge_buff = lib.hexs_to_bytes([
      lib.u8_to_hex(lib.POST),
      post_room,
      post_user,
      post_data,
    ]);
    ws_send(msge_buff);
  };

  // Starts watching a room
  function watch_room(room_name) {
    var room_name = room_name.toLowerCase();
    if (!watching[room_name]) {
      watching[room_name] = true;
      var room_name = lib.check_hex(64, room_name);
      var msge_buff = lib.hexs_to_bytes([
        lib.u8_to_hex(lib.WATCH),
        room_name,
      ]);
      Posts[room_name] = [];
      ws_send(msge_buff); 
    }
  };

  // Stops watching a room
  function unwatch_room(room_name) {
    var room_name = room_name.toLowerCase();
    if (watching[room_name]) {
      watching[room_name] = false;
      var room_name = lib.check_hex(64, room_name);
      var msge_buff = lib.hexs_to_bytes([
        lib.u8_to_hex(lib.UNWATCH),
        room_name,
      ]);
      ws_send(msge_buff);
    }
  };

  // Returns the best estimative of the server's current time
  function get_time() {
    return Date.now() + delta_time;  
  };

  // Returns the best estimative of the server's current tick
  function get_tick() {
    return Math.floor((Date.now() + delta_time) / 62.5);
  };

  // Asks the server for its current time
  function ask_time() {
    last_ask_time = Date.now();
    last_ask_numb = ++last_ask_numb;
    ws_send(lib.hexs_to_bytes([
      lib.u8_to_hex(lib.TIME),
      lib.u64_to_hex(last_ask_numb),
    ]));
  };

  // Creates a rollback state computer instance
  // Arguments:
  // - room: the room to watch
  // - init: the initial state
  // - tick(state,time): processes a tick, returning a new state
  // - txfn(state,event): processes events, returning a new state
  function rollback_state(room, init, tick, txfn) {
    var posts = [];
    var states = lib.states_new();
    watch_room(room);
    on_post(function(post) {
      // Stores post
      posts.push(post);
      // Removes states after this post's tick
      // TODO
      // Computes delta time
      // TODO
    });
    // TODO ...
  }

  ws.binaryType = "arraybuffer";

  ws.onopen = function() {
    if (on_init_callback) {
      on_init_callback();
    }
    // Pings time now, after 0.5s, after 1s, and then every 2s
    setTimeout(ask_time, 0);
    setTimeout(ask_time, 500);
    setTimeout(ask_time, 1000);
    setInterval(ask_time, 2000);
  };

  ws.onmessage = (msge) => {
    var msge = new Uint8Array(msge.data);
    //console.log("receiving", msge);
    if (msge[0] === lib.SHOW) {
      var room = lib.bytes_to_hex(msge.slice(1, 9));
      var tick = lib.bytes_to_hex(msge.slice(9, 17));
      var user = lib.bytes_to_hex(msge.slice(17, 25));
      var data = lib.bytes_to_hex(msge.slice(25, msge.length));
      Posts[room].push({tick, user, data});
      if (on_post_callback) {
        on_post_callback({room, tick, user, data}, Posts);
      }
    };
    if (msge[0] === lib.TIME) {
      var reported_server_time = lib.hex_to_u64(lib.bytes_to_hex(msge.slice(1, 9)));
      var reply_numb = lib.hex_to_u64(lib.bytes_to_hex(msge.slice(9, 17)));
      if (last_ask_time !== null && last_ask_numb === reply_numb) {
        ping = (Date.now() - last_ask_time) / 2;
        var local_time = Date.now();
        var estimated_server_time = reported_server_time + ping;
        if (ping < best_ask_ping) {
          delta_time = estimated_server_time - local_time;
          best_ask_ping = ping;
        }
      }
    };
  };

  return {
    on_init,
    on_post,
    send_post,
    watch_room,
    unwatch_room,
    get_time,
    get_tick,
    lib,
  };
};

