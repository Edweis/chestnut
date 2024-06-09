import Koa from 'koa';
import route from 'koa-route';
import websockify from 'koa-websocket';
import fs from 'fs/promises'
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

app.use(async (ctx, next) => {
  try {
    return await next()
  } catch (err) {
    console.log(err)
    throw err
  }
})

app.ws.use(route.all('/join/:roomId/:userId', async (ctx, roomId, userId) => {
  const room = rooms.getOrCreate(roomId, new Map());
  room.set(userId, ctx.websocket) // joined the room 
  const chatPath = './chats/' + roomId + '.txt'

  // Hello everyone
  const history = await fs.readFile(chatPath).catch(() => '(no history)').then(r => r.toString())
  history.split('\n').forEach(l => ctx.websocket.send(l))
  room.forEach((ws) => ws.send(`# ${userId} has joined the chat`));

  // Message sent
  ctx.websocket.on('message', function (message) {
    const formated = `[${new Date().toISOString()}|${userId}]${message}`
    fs.appendFile(chatPath, formated + '\n')
    room.forEach((ws, participantId) => {
      if (participantId === userId) return // not sending the message to oneself !
      ws.send(formated)
    })
  });

  ctx.websocket.on('error', err => console.warn('FAILED', err))
  ctx.websocket.on('close', err => console.warn('CLOSED', err))
}));


app.listen(3000);