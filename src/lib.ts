import { BSON } from "bson"
const WATCH: number = 0
const UNWATCH: number = 1
const POST: number = 2
const SHOW: number = 3
const TIME: number = 4

function hex_to_bytes(hex: string): Uint8Array {
  const arr = []
  for (let i = 0; i < hex.length / 2; ++i) {
    arr.push((parseInt(hex[i * 2 + 0], 16) << 4) | parseInt(hex[i * 2 + 1], 16))
  }
  return new Uint8Array(arr)
}

const hex_char = "0123456789abcdef".split("")
function bytes_to_hex(buf: Uint8Array): string {
  let hex = ""
  for (let i = 0; i < buf.length; ++i) {
    hex += hex_char[buf[i] >>> 4] + hex_char[buf[i] & 0xf]
  }
  return hex
}

function hex_join(arr: string[]): string {
  let res = ""
  for (let i = 0; i < arr.length; ++i) {
    res += arr[i]
  }
  return res
}

function hexs_to_bytes(arr: string[]): Uint8Array {
  return hex_to_bytes(hex_join(arr))
}

function u8_to_hex(num: number): string {
  return ("00" + num.toString(16)).slice(-2)
}

function hex_to_u8(hex: string): number {
  return parseInt(hex, 16)
}

function hex_to_u32(hex: string): number {
  return parseInt(hex.slice(-32), 16)
}

function hex_to_u64(hex: string): number {
  return parseInt(hex.slice(-64), 16)
}

function uN_to_hex(N: number, num: number): string {
  let hex = ""
  for (let i = 0; i < N / 4; ++i) {
    hex += hex_char[(num / (2 ** ((N / 4 - i - 1) * 4))) & 0xf]
  }
  return hex
}

function u32_to_hex(num: number): string {
  return uN_to_hex(32, num)
}

function u64_to_hex(num: number): string {
  return uN_to_hex(64, num)
}

function check_hex(bits: number | null, hex: string): string | null {
  if (typeof hex !== "string") {
    return null
  }
  if (!/^[a-fA-F0-9]*$/.test(hex)) {
    return null
  }
  if (bits) {
    while (hex.length * 4 < bits) {
      hex = "0" + hex
    }
    if (hex.length * 4 > bits) {
      hex = hex.slice(0, Math.floor(bits / 4))
    }
    return hex.toLowerCase()
  } else {
    hex = hex.length % 2 === 1 ? "0" + hex : hex
    return hex.toLowerCase()
  }
}

const utf8_encoder = new TextEncoder()
function string_to_bytes(str: string): Uint8Array {
  return utf8_encoder.encode(str)
}

const utf8_decoder = new TextDecoder()
function bytes_to_string(buf: Uint8Array): string {
  return utf8_decoder.decode(buf)
}

function string_to_hex(str: string): string {
  return bytes_to_hex(string_to_bytes(str))
}

function hex_to_string(hex: string): string {
  return bytes_to_string(hex_to_bytes(hex))
}

function states_new(): null {
  return null
}

function json_to_hex(json: Record<string, any>): string {
  return bytes_to_hex(BSON.serialize(json))
}

function hex_to_json(hex: string): Record<string, any> {
  return BSON.deserialize(hex_to_bytes(hex))
}

function states_push(states: null | { bit: number; current: any; older: null | any }, new_state: any): { bit: number; current: any; older: null | any } {
  if (states === null) {
    return { bit: 0, current: new_state, older: null }
  } else {
    const { bit, current, older } = states
    if (bit === 0) {
      return { bit: 1, current, older }
    } else {
      return { bit: 0, current: new_state, older: states_push(older, current) }
    }
  }
}

function states_before(states: null | { bit: number; current: { tick: number }; older: null | any }, tick: number): null | any {
  if (states === null) {
    return null
  } else {
    if (states.current.tick < tick) {
      return states.current
    } else {
      return states_before(states.older, tick)
    }
  }
}

export default {
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
  json_to_hex,
  hex_to_json,
  states_new,
  states_push,
  states_before,
}
