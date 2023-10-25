import client from "./../client.js";
const uwuchat = client({url: "wss://server.uwu.games"});

// Counter
var roller = uwuchat.roller({

  // Room ID
  room: 0x500,

  // User ID
  user: 0x123,

  // Initial state is just a counter
  on_init: (time, post) => {
    return {
      count: 0,
    };
  },

  // When a post is made, add it to the state.
  on_post: (state, time, user, data) => {
    return {
      count: state.count + data.add,
    };
  },

  // Every second, add 1 to the state.
  on_pass: (state, time, dt) => {
    return {
      count: state.count + dt,
    };
  },

});

// Every second, add 100 to the global counter.
setInterval(() => {
  roller.post({add: 100});
}, 1000);

// At 30 FPS,  show the curent global counter.
setInterval(() => {
  let state = roller.get_state();
  if (state) {
    console.log(state.count);
  } else {
    console.log("game hasn't started!");
  }
}, 1000 / 30);

process.on("SIGINT", function() {
  console.log("Closing client...");
  wss.close();
  process.exit();
});
