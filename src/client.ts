import WebSocket from "isomorphic-ws"
import lib from "./lib.js"

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export default function client({ url = "ws://server.uwu.games" }: { url?: string } = {}) {
  const ws = new WebSocket(url)
  const watching: { [room: string]: boolean } = {}

  function ws_send(buffer: Uint8Array) {
    if (ws.readyState === 1) {
      ws.send(buffer)
    } else {
      setTimeout(() => ws_send(buffer), 20)
    }
  }

  let last_ask_time: number | null = null
  let last_ask_numb: number = 0
  let best_ask_ping: number = Infinity
  let delta_time: number = 0
  let ping: number = 0

  let on_init_callback: (() => void) | null = null
  let on_post_callback: ((post: any) => void) | null = null

  function on_init(callback: () => void) {
    on_init_callback = callback
  }

  function on_post(callback: (post: any) => void) {
    on_post_callback = callback
  }

  function send_post(post_room: number, post_user: number, post_json: any) {
    const postRoom = lib.u64_to_hex(post_room)
    const postUser = lib.u64_to_hex(post_user)
    const post_data = lib.json_to_hex(post_json)
    const msge_buff = lib.hexs_to_bytes([
      lib.u8_to_hex(lib.POST),
      postRoom,
      postUser,
      post_data,
    ])
    ws_send(msge_buff)
  }

  function watch_room(room_id: number) {
    if (!watching[room_id]) {
      watching[room_id] = true
      const msge_buff = lib.hexs_to_bytes([
        lib.u8_to_hex(lib.WATCH),
        lib.u64_to_hex(room_id),
      ])
      ws_send(msge_buff)
    }
  }

  function unwatch_room(room_id: number) {
    if (watching[room_id]) {
      watching[room_id] = false
      const msge_buff = lib.hexs_to_bytes([
        lib.u8_to_hex(lib.UNWATCH),
        lib.u64_to_hex(room_id),
      ])
      ws_send(msge_buff)
    }
  }

  function get_time() {
    return Date.now() + delta_time
  }

  function ask_time() {
    last_ask_time = Date.now()
    last_ask_numb = ++last_ask_numb
    ws_send(lib.hexs_to_bytes([
      lib.u8_to_hex(lib.TIME),
      lib.u64_to_hex(last_ask_numb),
    ]))
  }

  function roller({
    room,
    user,
    on_init,
    on_pass,
    on_post,
    on_tick,
  }: {
    room: number
    user: number
    on_init: (time: number, user: number, data: any) => any
    on_pass: (state: any, time: number, delta: number) => any
    on_post: (state: any, time: number, user: number, data: any) => any
    on_tick?: [number, (state: any) => any]
  }) {
    let state: any | null = null
    watch_room(room)

    if (on_tick !== undefined) {
      const fps = on_tick[0]
      on_pass = function (state, time, dt) {
        const init_tick = Math.floor((time + 0) * fps)
        const last_tick = Math.floor((time + dt) * fps)
        for (let t = init_tick; t < last_tick; ++t) {
          state = on_tick[1](state)
        }
        return state
      }
    }

    on_post_callback = function (post) {
      if (state === null) {
        state = {
          time: post.time,
          value: on_init(post.time / 1000, post.user, post.data),
        }
      } else {
        state.value = on_pass(state.value, state.time / 1000, (post.time - state.time) / 1000)
        state.value = on_post(state.value, post.time / 1000, post.user, post.data)
        state.time = post.time
      }
    }

    return {
      post: (data: any) => {
        return send_post(room, user, data)
      },
      get_state: () => {
        if (state) {
          const send_state = clone(state)
          return on_pass(send_state.value, send_state.time / 1000, (get_time() - send_state.time) / 1000)
        } else {
          return null
        }
      },
      get_time: () => {
        return get_time()
      },
      get_ping: () => {
        return ping
      },
      destroy: () => {
        unwatch_room(room)
      },
    }
  }

  ws.binaryType = "arraybuffer"

  ws.onopen = function () {
    if (on_init_callback) {
      on_init_callback()
    }
    setTimeout(ask_time, 0)
    setTimeout(ask_time, 500)
    setTimeout(ask_time, 1000)
    setInterval(ask_time, 2000)
  }

  ws.onmessage = (msge : any) => {
    const msgeData = new Uint8Array(msge.data)
    if (msgeData[0] === lib.SHOW) {
      const room = lib.hex_to_u64(lib.bytes_to_hex(msgeData.slice(1, 9)))
      const time = lib.hex_to_u64(lib.bytes_to_hex(msgeData.slice(9, 17)))
      const user = lib.hex_to_u64(lib.bytes_to_hex(msgeData.slice(17, 25)))
      const data = lib.hex_to_json(lib.bytes_to_hex(msgeData.slice(25, msgeData.length)))
      if (on_post_callback) {
        on_post_callback({ room, time, user, data })
      }
    }
    if (msgeData[0] === lib.TIME) {
      const reported_server_time = lib.hex_to_u64(lib.bytes_to_hex(msgeData.slice(1, 9)))
      const reply_numb = lib.hex_to_u64(lib.bytes_to_hex(msgeData.slice(9, 17)))
      if (last_ask_time !== null && last_ask_numb === reply_numb) {
        ping = (Date.now() - last_ask_time) / 2
        const local_time = Date.now()
        const estimated_server_time = reported_server_time + ping
        if (ping < best_ask_ping) {
          delta_time = estimated_server_time - local_time
          best_ask_ping = ping
        }
      }
    }
  }

  return {
    roller,
    on_init,
    on_post,
    send_post,
    watch_room,
    unwatch_room,
    get_time,
    lib,
  }
}
