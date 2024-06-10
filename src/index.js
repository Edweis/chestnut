import Koa from 'koa';
import route from 'koa-route';
import websockify from 'koa-websocket';
import fs from 'fs/promises'
import hbs from 'handlebars'
import dayjs from 'dayjs'

const app = websockify(new Koa());

class BetterMap extends Map {
  getOrCreate(key, value) {
    const current = this.get(key)
    if (current != null) return current;
    this.set(key, value)
    return value
  }
}


// error handling
app.use(async (ctx, next) => {
  try {
    return await next()
  } catch (err) {
    console.log(err)
    throw err
  }
})

// helpers
const CLEAR_CHAT = `<div id="notifications"></div>`
const formater = (viewerId) => (message) => {
  const [, date, userId, content] = message.match(/^\[(.*?)\|(.*?)\](.*)$/) || [, , , message]
  if (!date) return `<div id="notifications" hx-swap-oob="afterbegin">
                      <div class="log">${content}</div>
                    </div>`
  return `<div id="notifications" hx-swap-oob="afterbegin">
            <div class="${userId===viewerId ? "me" : "them"}">
              <span class="date">${dayjs(date).format('MMM D[, ]HH:mm')}</span>
              <span class="content">${userId} : ${content}</span>
            </div>
          </div>`
}
const encode = (userId, content) => {
  const safeContent = content.trim().replace('\n', '<br/>')
  return `[${new Date().toISOString()}|${userId}]${safeContent}`
}

// frontend
const template = await fs.readFile('./src/main.hbs')
const mainPage = hbs.compile(template.toString())
app.use(route.get('/', async (ctx) => {
  ctx.body = mainPage()
}))

const rooms = new BetterMap()
app.ws.use(route.all('/join/:roomId/:userId', async (ctx, roomId, userId) => {
  const room = rooms.getOrCreate(roomId, new Map());
  room.set(userId, ctx.websocket) // joined the room 
  const chatPath = './chats/' + roomId + '.txt'

  // helpers
  const format = formater(userId)

  // Hello everyone
  const history = await fs.readFile(chatPath).catch(() => '(no history)').then(r => r.toString())
  ctx.websocket.send(CLEAR_CHAT)
  history.split('\n').forEach(l => ctx.websocket.send(format(l)))

  //Welcome message
  room.forEach((ws) => ws.send(format(`# ${userId} has joined the chat`)));

  // Message sent
  ctx.websocket.on('message', function (message) {
    console.log(message)
    const content = JSON.parse(message).message
    const nextMessage = encode(userId, content)
    fs.appendFile(chatPath, nextMessage + '\n')
    room.forEach((ws) => ws.send(format(nextMessage)))
  });

  ctx.websocket.on('close', () => {
    room.delete(userId); 
    room.forEach((ws) => ws.send(format(`# ${userId} left`)))
  })
}));


app.listen(3000);