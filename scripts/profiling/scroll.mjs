// Flings any element of a Chromium page through the real input pipeline, over the debugging port (#2228).
// agent-browser's own `scroll` is a script scrollBy and its `mouse wheel` lands at (0, 0), so neither shows a compositor gap.
import { parseArgs } from 'node:util'

const USAGE =
  'Usage: node scripts/profiling/scroll.mjs --port <debugPort> [--page <URL part>] [--distance <px>] [--speed <px/s>] [--up] <selector>'

function positiveNumber(name, text) {
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`--${name} must be a positive number, not "${text}".`)
  return value
}

function readArguments() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: 'string' },
      page: { type: 'string', default: '' },
      distance: { type: 'string', default: '20000' },
      speed: { type: 'string', default: '6000' },
      up: { type: 'boolean', default: false },
    },
  })
  if (!values.port || positionals.length !== 1) throw new Error(USAGE)
  return {
    port: positiveNumber('port', values.port),
    page: values.page,
    distance: positiveNumber('distance', values.distance),
    speed: positiveNumber('speed', values.speed),
    up: values.up,
    selector: positionals[0],
  }
}

async function findPage(port, urlPart) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  const page = targets.find((target) => target.type === 'page' && target.url.includes(urlPart))
  if (!page) throw new Error(`No page on port ${port} has a URL that contains "${urlPart}".`)
  return page
}

function connect(url) {
  const socket = new WebSocket(url)
  const pending = new Map()
  let nextId = 1
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  })
  const send = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({ send, close: () => socket.close() }))
    socket.addEventListener('error', () => reject(new Error(`Cannot connect to ${url}.`)))
  })
}

async function measure(cdp, selector) {
  const expression = `(() => {
    const element = document.querySelector(${JSON.stringify(selector)})
    if (!element) return null
    const box = element.getBoundingClientRect()
    const left = Math.max(box.left, 0), right = Math.min(box.right, innerWidth)
    const top = Math.max(box.top, 0), bottom = Math.min(box.bottom, innerHeight)
    if (right <= left || bottom <= top) return { offscreen: true }
    let scroller = element
    while (scroller && scroller.scrollHeight <= scroller.clientHeight) scroller = scroller.parentElement
    const scrollTop = Math.round(scroller ? scroller.scrollTop : scrollY)
    return { x: Math.round((left + right) / 2), y: Math.round((top + bottom) / 2), scrollTop }
  })()`
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  })
  if (exceptionDetails)
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
  if (!result.value) throw new Error(`No element matches ${selector}.`)
  if (result.value.offscreen) throw new Error(`${selector} is outside the window.`)
  return result.value
}

async function fling(options) {
  const page = await findPage(options.port, options.page)
  const cdp = await connect(page.webSocketDebuggerUrl)
  try {
    const before = await measure(cdp, options.selector)
    const started = performance.now()
    // A positive yDistance scrolls up.
    await cdp.send('Input.synthesizeScrollGesture', {
      x: before.x,
      y: before.y,
      yDistance: options.up ? options.distance : -options.distance,
      speed: options.speed,
      gestureSourceType: 'mouse',
    })
    const milliseconds = Math.round(performance.now() - started)
    const after = await measure(cdp, options.selector)
    return {
      page: page.url,
      at: [before.x, before.y],
      scrollTop: [before.scrollTop, after.scrollTop],
      milliseconds,
    }
  } finally {
    cdp.close()
  }
}

try {
  console.log(JSON.stringify(await fling(readArguments())))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
