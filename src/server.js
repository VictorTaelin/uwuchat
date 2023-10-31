import ws from "ws";
import fs from "fs-extra";
import path from "path";
import lib from "./lib.js";
const port = Number(process.argv[2] || "7171");
var RoomPosts = {};
var Watchlist = {};
var Connected = 0;
// Startup
// =======
// Creates the data directory
if (!fs.existsSync("data")) {
    fs.mkdirSync("data");
}
// Loads existing posts
var files = fs.readdirSync("data");
for (let file of files) {
    if (file.slice(-5) === ".room") {
        var room_name = file.slice(0, -5);
        var file_data = fs.readFileSync(path.join("data", file));
        var room_posts = [];
        for (let i = 0; i < file_data.length; i += 4 + size) {
            var size = lib.hex_to_u32(file_data.slice(i, i + 4).toString("hex"));
            var head = Buffer.from([lib.SHOW]);
            var body = file_data.slice(i + 4, i + 4 + size);
            room_posts.push(new Uint8Array(Buffer.concat([head, body])));
        }
        console.log(`Loaded ${room_posts.length} posts on room ${room_name}.`);
        RoomPosts[room_name] = room_posts;
    }
}
// Methods
// =======
// Returns current time
function get_time() {
    return Date.now();
}
// Adds a user to a room's watchlist
function watch_room(room_name, wsRecevier) {
    // Creates watcher list
    if (!Watchlist[room_name]) {
        Watchlist[room_name] = [];
    }
    // Gets watcher list
    var watchlist = Watchlist[room_name];
    // Makes sure user isn't watching already
    for (let i = 0; i < watchlist.length; ++i) {
        if (watchlist[i] === wsRecevier) {
            return;
        }
    }
    // Sends old messages
    if (RoomPosts[room_name]) {
        for (let i = 0; i < RoomPosts[room_name].length; ++i) {
            wsRecevier.send(RoomPosts[room_name][i]);
        }
    }
    // Adds user to watcher list
    watchlist.push(wsRecevier);
}
// Removes a user from a room's watchlist
function unwatch_room(room_name, wsRecevier) {
    // Gets watcher list
    var watchlist = Watchlist[room_name] || [];
    // Removes user from watcher list
    for (let i = 0; i < watchlist.length; ++i) {
        if (watchlist[i] === wsRecevier) {
            for (let j = i; j < watchlist.length - 1; ++j) {
                watchlist[j] = watchlist[j + 1];
            }
            return;
        }
    }
}
// Saves a post (room id, user address, data)
function save_post(post_room, post_user, post_data) {
    if (!post_room || !post_user || !post_data) {
        console.error("Invalid post information.");
        return;
    }
    var post_room = lib.check_hex(64, post_room);
    var post_time = lib.u64_to_hex(get_time());
    var post_user = lib.check_hex(64, post_user);
    var post_data = lib.check_hex(null, post_data);
    var valid_post_room = post_room;
    var valid_post_user = post_user;
    var valid_post_data = post_data;
    var post_list = [valid_post_room, post_time, valid_post_user, valid_post_data];
    var post_buff = lib.hexs_to_bytes([lib.u8_to_hex(lib.SHOW)].concat(post_list));
    var post_seri = lib.hexs_to_bytes([lib.u32_to_hex(post_buff.length - 1)].concat(post_list));
    var post_file = path.join("data", valid_post_room + ".room");
    var log_msg = "";
    log_msg += "Saving post!\n";
    log_msg += "- post_room: " + valid_post_room + "\n";
    log_msg += "- post_user: " + valid_post_user + "\n";
    log_msg += "- post_data: " + valid_post_data + "\n";
    log_msg += "- post_file: " + valid_post_room + ".room" + "\n";
    // Creates reconnection array for this room
    if (!RoomPosts[valid_post_room]) {
        RoomPosts[valid_post_room] = [];
    }
    // Adds post to reconnection array
    RoomPosts[valid_post_room].push(post_buff);
    // Broadcasts
    if (Watchlist[valid_post_room]) {
        log_msg += "- broadcasting to " + Watchlist[valid_post_room].length + " watcher(s).\n";
        for (let wsRecevier of Watchlist[valid_post_room]) {
            wsRecevier.send(post_buff);
        }
    }
    // Create file for this room
    if (!fs.existsSync(post_file)) {
        fs.closeSync(fs.openSync(post_file, "w"));
    }
    // Adds post to file
    fs.appendFileSync(post_file, Buffer.from(post_seri));
    // Log messages
    console.log(log_msg);
}
// TCP API
// =======
const wsServer = new ws.Server({ port });
// wss.binaryType = "arraybuffer"
wsServer.on("connection", function connection(wsRecevier) {
    console.log("[" + (++Connected) + " connected]");
    wsRecevier.on("message", function incoming(data) {
        var msge = new Uint8Array(data);
        switch (msge[0]) {
            // User wants to watch a room
            case lib.WATCH:
                var room = lib.bytes_to_hex(msge.slice(1, 9));
                watch_room(room, wsRecevier);
                break;
            // User wants to unwatch a room
            case lib.UNWATCH:
                var room = lib.bytes_to_hex(msge.slice(1, 9));
                unwatch_room(room, wsRecevier);
                break;
            // User wants to know the time
            case lib.TIME:
                var msge_buff = lib.hexs_to_bytes([
                    lib.u8_to_hex(lib.TIME),
                    lib.u64_to_hex(Date.now()),
                    lib.bytes_to_hex(msge.slice(1, 9)),
                ]);
                wsRecevier.send(msge_buff);
                break;
            // User wants to post a message
            case lib.POST:
                var post_room = lib.bytes_to_hex(msge.slice(1, 9));
                var post_user = lib.bytes_to_hex(msge.slice(9, 17));
                var post_data = lib.bytes_to_hex(msge.slice(17, msge.length));
                save_post(post_room, post_user, post_data);
                break;
        }
    });
    wsRecevier.on("close", function () {
        for (let room_name in Watchlist) {
            Watchlist[room_name] = Watchlist[room_name].filter((watcher) => watcher !== wsRecevier);
        }
        console.log("[" + (--Connected) + " connected]");
    });
});
process.on("SIGINT", function () {
    console.log("\nClosing server...");
    wsServer.close();
    process.exit();
});
console.log("Started server on ws://localhost:" + port + ".");
