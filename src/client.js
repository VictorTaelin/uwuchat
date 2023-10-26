"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var WebSocket = require("isomorphic-ws");
var lib_1 = require("./lib");
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
function client(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.url, url = _c === void 0 ? "wss://server.uwu.games" : _c;
    var ws = new WebSocket(url);
    var watching = {};
    function ws_send(buffer) {
        if (ws.readyState === 1) {
            ws.send(buffer);
        }
        else {
            setTimeout(function () { return ws_send(buffer); }, 20);
        }
    }
    var last_ask_time = null;
    var last_ask_numb = 0;
    var best_ask_ping = Infinity;
    var delta_time = 0;
    var ping = 0;
    var on_init_callback = null;
    var on_post_callback = null;
    function on_init(callback) {
        on_init_callback = callback;
    }
    function on_post(callback) {
        on_post_callback = callback;
    }
    function send_post(post_room, post_user, post_json) {
        var postRoom = lib_1.default.u64_to_hex(post_room);
        var postUser = lib_1.default.u64_to_hex(post_user);
        var post_data = lib_1.default.json_to_hex(post_json);
        var msge_buff = lib_1.default.hexs_to_bytes([
            lib_1.default.u8_to_hex(lib_1.default.POST),
            postRoom,
            postUser,
            post_data,
        ]);
        ws_send(msge_buff);
    }
    function watch_room(room_id) {
        if (!watching[room_id]) {
            watching[room_id] = true;
            var msge_buff = lib_1.default.hexs_to_bytes([
                lib_1.default.u8_to_hex(lib_1.default.WATCH),
                lib_1.default.u64_to_hex(room_id),
            ]);
            ws_send(msge_buff);
        }
    }
    function unwatch_room(room_id) {
        if (watching[room_id]) {
            watching[room_id] = false;
            var msge_buff = lib_1.default.hexs_to_bytes([
                lib_1.default.u8_to_hex(lib_1.default.UNWATCH),
                lib_1.default.u64_to_hex(room_id),
            ]);
            ws_send(msge_buff);
        }
    }
    function get_time() {
        return Date.now() + delta_time;
    }
    function ask_time() {
        last_ask_time = Date.now();
        last_ask_numb = ++last_ask_numb;
        ws_send(lib_1.default.hexs_to_bytes([
            lib_1.default.u8_to_hex(lib_1.default.TIME),
            lib_1.default.u64_to_hex(last_ask_numb),
        ]));
    }
    function roller(_a) {
        var room = _a.room, user = _a.user, on_init = _a.on_init, on_pass = _a.on_pass, on_post = _a.on_post, on_tick = _a.on_tick;
        var state = null;
        watch_room(room);
        if (on_tick !== undefined) {
            var fps_1 = on_tick[0];
            on_pass = function (state, time, dt) {
                var init_tick = Math.floor((time + 0) * fps_1);
                var last_tick = Math.floor((time + dt) * fps_1);
                for (var t = init_tick; t < last_tick; ++t) {
                    state = on_tick[1](state);
                }
                return state;
            };
        }
        on_post_callback = function (post) {
            if (state === null) {
                state = {
                    time: post.time,
                    value: on_init(post.time / 1000, post.user, post.data),
                };
            }
            else {
                state.value = on_pass(state.value, state.time / 1000, (post.time - state.time) / 1000);
                state.value = on_post(state.value, post.time / 1000, post.user, post.data);
                state.time = post.time;
            }
        };
        return {
            post: function (data) {
                return send_post(room, user, data);
            },
            get_state: function () {
                if (state) {
                    var send_state = clone(state);
                    return on_pass(send_state.value, send_state.time / 1000, (get_time() - send_state.time) / 1000);
                }
                else {
                    return null;
                }
            },
            get_time: function () {
                return get_time();
            },
            get_ping: function () {
                return ping;
            },
            destroy: function () {
                unwatch_room(room);
            },
        };
    }
    ws.binaryType = "arraybuffer";
    ws.onopen = function () {
        if (on_init_callback) {
            on_init_callback();
        }
        setTimeout(ask_time, 0);
        setTimeout(ask_time, 500);
        setTimeout(ask_time, 1000);
        setInterval(ask_time, 2000);
    };
    ws.onmessage = function (msge) {
        var msgeData = new Uint8Array(msge.data);
        if (msgeData[0] === lib_1.default.SHOW) {
            var room = lib_1.default.hex_to_u64(lib_1.default.bytes_to_hex(msgeData.slice(1, 9)));
            var time = lib_1.default.hex_to_u64(lib_1.default.bytes_to_hex(msgeData.slice(9, 17)));
            var user = lib_1.default.hex_to_u64(lib_1.default.bytes_to_hex(msgeData.slice(17, 25)));
            var data = lib_1.default.hex_to_json(lib_1.default.bytes_to_hex(msgeData.slice(25, msgeData.length)));
            if (on_post_callback) {
                on_post_callback({ room: room, time: time, user: user, data: data });
            }
        }
        if (msgeData[0] === lib_1.default.TIME) {
            var reported_server_time = lib_1.default.hex_to_u64(lib_1.default.bytes_to_hex(msgeData.slice(1, 9)));
            var reply_numb = lib_1.default.hex_to_u64(lib_1.default.bytes_to_hex(msgeData.slice(9, 17)));
            if (last_ask_time !== null && last_ask_numb === reply_numb) {
                ping = (Date.now() - last_ask_time) / 2;
                var local_time = Date.now();
                var estimated_server_time = reported_server_time + ping;
                if (ping < best_ask_ping) {
                    delta_time = estimated_server_time - local_time;
                    best_ask_ping = ping;
                }
            }
        }
    };
    return {
        roller: roller,
        on_init: on_init,
        on_post: on_post,
        send_post: send_post,
        watch_room: watch_room,
        unwatch_room: unwatch_room,
        get_time: get_time,
        lib: lib_1.default,
    };
}
exports.default = client;
