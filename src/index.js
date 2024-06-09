import Koa from 'koa';
import route from 'koa-route';
import websockify from 'koa-websocket';
import fs from 'fs'
const app = websockify(new Koa());

class BetterMap extends Map {
  getOrCreate(key, value) {
    const current = this.get(key)
    if (current != null) return current;
    this.set(key, value)
    return value
  }
}

const rooms = new BetterMap()

app.ws.use(route.all('/join/:roomId/:userId', function (ctx, roomId, userId) {
  const room = rooms.getOrCreate(roomId, new Map());
  room.set(userId, ctx.websocket) // joined the room 

  // Hello everyone
  room.forEach((ws) => ws.send(`# ${userId} has joined the chat`));

  // Message sent
  ctx.websocket.on('message', function (message) {
    const formated = `[${new Date().toISOString()}|${userId}]${message}`
    fs.appendFileSync('./chats/' + roomId + '.txt', formated+'\n')
    room.forEach((ws, participantId) => {
      if (participantId === userId) return // not sending the message to oneself !
      ws.send(formated)
    })
  });
}));

app.listen(3000);