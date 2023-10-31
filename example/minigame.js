// This is a simple online minigame with a map with 32 tiles, and a boss that
// moves through the map. Players can move left/right. The goal is to dodge the
// boss by passing through it. If the boss hits you, you lose.

import client from "./../src/client.js";
import readline from "readline";

const uwuchat = client({url: "ws://server.uwu.games:7171"});

// Server Logic
// ------------

var roller = uwuchat.roller({
  room: 0x600,
  user: 0x2,

  // Initial state:
  // - empty map of players
  // - boss in position 0
  on_init: (time, user, data) => {
    return {
      players: {},
      boss: {name: "@", pos: {x: 0, y: 0}}
    };
  },

  // When a post is made...
  on_post: (state, time, user, data) => {
    // If player doesn't exist, create it
    if (state.players[user] === undefined) {
      state.players[user] = {
        name: String(user),
        pos: {x: 16, y: 0},
      };

    // Otherwise, move it
    } else {
      if (data.cmd === "left") {
        state.players[user].pos.x -= 2;
      }
      if (data.cmd === "right") {
        state.players[user].pos.x += 2;
      }
    }

    return state;
  },

  // When a tick happens...
  on_tick: [20, (state) => {
    // Moves the boss...
    state.boss.pos.x = (state.boss.pos.x + 1) % 32;

    // For each player...
    for (var player_id in state.players) {
      var player = state.players[player_id];

      // Moves it to inside the map
      if (player.pos.x >= 31) { player.pos.x = 31; }
      if (player.pos.x <   0) { player.pos.x = 0; }

      // Kills it if boss is over it
      if (player.pos.x == state.boss.pos.x) {
        player.pos.x = 0;
      }
    }

    return state;
  }]
  
});

// Client Inputs
// -------------

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

process.stdin.on("keypress", (str, key) => {
  if (key.name === "a") {
    roller.post({cmd: "left"});
  }

  if (key.name === "d") {
    roller.post({cmd: "right"});
  }

  if (key.sequence === "\u0003") {
    process.exit();
  }
});

// Client Render
// -------------

function draw(state) {
  var map = [];

  for (var i = 0; i < 32; ++i) {
    map.push("_");
  }

  if (state) {
    for (var player_id in state.players) {
      var player = state.players[player_id];
      map[player.pos.x] = player.name;
    }
    map[state.boss.pos.x] = state.boss.name;
  }

  return map.join("");
}

setInterval(function render() {
  console.clear();
  console.log(draw(roller.get_state()));
}, 1000 / 30);
