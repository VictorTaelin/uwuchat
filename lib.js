const WATCH = 0;
const UNWATCH = 1;
const POST = 2;
const SHOW = 3;
const TIME = 4;

// type RoomID    = U64
// type PostID    = U64
// type Time      = U64
// type Address   = U64
// type PostData  = Vec<U64>

function hex_to_bytes(hex) {
  var arr = [];
  for (var i = 0; i < hex.length/2; ++i) {
    arr.push((parseInt(hex[i*2+0],16)<<4)|parseInt(hex[i*2+1],16));
  };
  return new Uint8Array(arr);
};

const hex_char = "0123456789abcdef".split("");
function bytes_to_hex(buf) {
  var hex = "";
  for (var i = 0; i < buf.length; ++i) {
    hex += hex_char[buf[i]>>>4] + hex_char[buf[i]&0xF];
  };
  return hex;
};

function hex_join(arr) {
  let res = "";
  for (var i = 0; i < arr.length; ++i) {
    res += arr[i];
  }
  return res;
};

function hexs_to_bytes(arr) {
  return hex_to_bytes(hex_join(arr));
};

function u8_to_hex(num) {
  return ("00" + num.toString(16)).slice(-2);
};

function hex_to_u8(hex) {
  return parseInt(hex, 16);
};

function hex_to_u32(hex) {
  return parseInt(hex.slice(-32), 16);
};

function hex_to_u64(hex) {
  return parseInt(hex.slice(-64), 16);
};

function uN_to_hex(N, num) {
  var hex = "";
  for (var i = 0; i < N/4; ++i) {
    hex += hex_char[(num / (2**((N/4-i-1)*4))) & 0xF];
  };
  return hex;
};

function u32_to_hex(num) {
  return uN_to_hex(32, num);
};

function u64_to_hex(num) {
  return uN_to_hex(64, num);
};

function check_hex(bits, hex) {
  if (typeof hex !== "string") {
    return null;
  }
  if (!/^[a-fA-F0-9]*$/.test(hex)) {
    return null;
  }
  if (bits) {
    while (hex.length * 4 < bits) {
      hex = "0" + hex;
    }
    if (hex.length * 4 > bits) {
      hex = hex.slice(0, Math.floor(bits / 4));
    }
    return hex.toLowerCase();
  } else {
    hex = hex.length % 2 === 1 ? "0" + hex : hex;
    return hex.toLowerCase();
  }
};

var utf8_encoder = new TextEncoder("utf-8");
function string_to_bytes(str) {
  return utf8_encoder.encode(str);
};

var utf8_decoder = new TextDecoder("utf-8");
function bytes_to_string(buf) {
  return utf8_decoder.decode(buf);
};

function string_to_hex(str) {
  return bytes_to_hex(string_to_bytes(str));
};

function hex_to_string(hex) {
  return bytes_to_string(hex_to_bytes(hex));
};

function states_new() {
  return null;
}

// Adds a state to the list of states
// It only keeps log(N) states, where N is the amount of ticks recorded
function states_push(states, new_state) {
  if (states === null) {
    return {bit: 0, current: new_state, older: null};
  } else {
    var {bit, current, older} = states;
    if (bit === 0) {
      return {bit: 1, current, older};
    } else {
      return {bit: 0, current: new_state, older: states_push(older, current)};
    }
  }
}

// Finds the latest state that happened before a tick
function states_before(states, tick) {
  if (states === null) {
    return null;
  } else {
    if (states.current.tick < tick) {
      return states.current;
    } else {
      return latest(states.older, tick);
    }
  }
}

module.exports = {
  WATCH,
  UNWATCH,
  POST,
  SHOW,
  TIME,
  hex_to_bytes,
  bytes_to_hex,
  hexs_to_bytes,
  hex_join,
  u8_to_hex,
  hex_to_u8,
  u32_to_hex,
  hex_to_u32,
  u64_to_hex,
  hex_to_u64,
  string_to_hex,
  hex_to_string,
  check_hex,
  states_new,
  states_push,
  states_before,
};
