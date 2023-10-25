var client = require("./../client.js")({url: "ws://localhost:7171"});

// Counter
var roller = client.roller({

  // Room ID
  room: "0000000000000556",

  // User ID
  user: "0000000000000000",

  // Initial state is just a counter
  on_init: (time, post) => {
    return {
      begin: time,
      count: 0,
    };
  },

  // When a post is made, add it to the state.
  on_post: (state, post) => {
    return {
      begin: state.begin,
      count: state.count + parseInt(post.data, 16),
    };
  },

  // Every second, add 1 to the state.
  on_tick: (state, dt) => {
    return {
      begin: state.begin,
      count: state.count + dt,
    };
  },
});

// Every second, add 255 to the global counter.
setInterval(() => {
  roller.post("FF");
}, 1000);

// At 30 FPS,  show the curent global counter.
setInterval(() => {
  console.log(roller.get_state());
}, 100);

process.on("SIGINT", function() {
  console.log("Closing client...");
  wss.close();
  process.exit();
});
