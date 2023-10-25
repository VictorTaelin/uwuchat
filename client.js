import lib from "./lib.js";
import WebSocket from "isomorphic-ws";

function clone(json) {
  return JSON.parse(JSON.stringify(json));
}

export default function client({url = "wss://server.uwu.games"} = {}) {
  var ws = new WebSocket(url);
  //var Posts = {};
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
  function send_post(post_room, post_user, post_json) {
    var post_room = lib.u64_to_hex(post_room);
    var post_user = lib.u64_to_hex(post_user);
    var post_data = lib.json_to_hex(post_json);
    var msge_buff = lib.hexs_to_bytes([
      lib.u8_to_hex(lib.POST),
      post_room,
      post_user,
      post_data,
    ]);
    ws_send(msge_buff);
  };

  // Starts watching a room
  function watch_room(room_id) {
    if (!watching[room_id]) {
      watching[room_id] = true;
      var msge_buff = lib.hexs_to_bytes([
        lib.u8_to_hex(lib.WATCH),
        lib.u64_to_hex(room_id),
      ]);
      ws_send(msge_buff); 
    }
  };

  // Stops watching a room
  function unwatch_room(room_id) {
    if (watching[room_id]) {
      watching[room_id] = false;
      var msge_buff = lib.hexs_to_bytes([
        lib.u8_to_hex(lib.UNWATCH),
        lib.u64_to_hex(room_id),
      ]);
      ws_send(msge_buff);
    }
  };

  // Returns the best estimative of the server's current time
  function get_time() {
    return Date.now() + delta_time;  
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
  // - room: the room to watch
  // - on_init(time,user,data): return the initial state
  // - on_post(state,time,user,data): processes events, returning a new state
  // - on_pass(state,time,delta): processes passage of time, returning a new state
  // Optionally, instead of 'on_pass', you can instead pass a:
  // - [fps,on_tick(state)]: processes a single tick, returning a new state
  // Currently it only caches the last post's state.
  function roller({room, user, on_init, on_pass, on_post, on_tick}) {
    var state = null;

    watch_room(room);

    // Utility: let user implement on_tick+fps, rather than on_pass
    if (on_tick !== undefined) {
      var fps = on_tick[0];
      on_pass = function(state, time, dt) {
        var init_tick = Math.floor((time +  0) * fps);
        var last_tick = Math.floor((time + dt) * fps);
        for (var t = init_tick; t < last_tick; ++t) {
          state = on_tick[1](state);
        }
        return state;
      }
    }

    on_post_callback = function(post) {
      // If it is the first post, initialize the state
      if (state === null) {
        state = {
          time: post.time,
          value: on_init(post.time / 1000, post.user, post.data),
        };
      // Otherwise, advance it up to the post's time, and handle the post
      } else {
        state.value = on_pass(state.value, state.time / 1000, (post.time - state.time) / 1000);
        state.value = on_post(state.value, post.time / 1000, post.user, post.data);
        state.time = post.time;
      }
    };

    return {
      post: (data) => {
        return send_post(room, user, data);
      },
      get_state: () => {
        if (state) {
          var send_state = clone(state);
          return on_pass(send_state.value, send_state.time / 1000, (get_time() - send_state.time) / 1000);
        } else {
          return null;
        }
      },
      get_time: () => {
        return get_time();
      },
      get_ping: () => {
        return ping;
      },
      destroy: () => {
        unwatch_room(room);
      },
    };
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
      var room = lib.hex_to_u64(lib.bytes_to_hex(msge.slice(1, 9)));
      var time = lib.hex_to_u64(lib.bytes_to_hex(msge.slice(9, 17)));
      var user = lib.hex_to_u64(lib.bytes_to_hex(msge.slice(17, 25)));
      var data = lib.hex_to_json(lib.bytes_to_hex(msge.slice(25, msge.length)));
      //Posts[room].push({time, user, data});
      if (on_post_callback) {
        on_post_callback({room, time, user, data});
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
    roller,
    on_init,
    on_post,
    send_post,
    watch_room,
    unwatch_room,
    get_time,
    lib,
  };
};
