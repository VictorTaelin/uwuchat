uwuchat
=======

Allows posting messages to rooms identified by a 64-bit name. Clients can then
watch rooms, which are synchronized using WebSockets (and, in a future, WebRTC).
This is used as a sandboxed communication environment for
[Formality](http://github.com/moonad/formality) apps running on the
[Moonad](http://github.com/moonad/moonad) ecosystem.

Server
------

To start a server, just do:

```
git clone http://github.com/victortaelin/uwuchat
cd uwuchat
node server.js 7171
```

Client
------

The code below will connect to a server running on `localhost:7171`. It will
then watch the room `0` and make an example post to it. It will then display on
the console all posts of this room, and update in real-time whenever there is a
new post. See [example.js](example.js).
