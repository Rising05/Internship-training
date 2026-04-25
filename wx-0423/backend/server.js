const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { URL } = require('node:url')
const {
  UPLOADS_DIR,
  bootstrapApp,
  clearProfileRecentViews,
  getChatDetail,
  getHomeData,
  getMessagesPage,
  getNavigationSummary,
  getProductDetail,
  getProfilePage,
  getPublishMeta,
  loginWithWeChat,
  markMessageAsRead,
  registerUpload,
  resetThreadStore,
  sendChatMessage,
  submitProduct,
  toggleProductFavorite,
} = require('./src/service')
const { ensureDbFile } = require('./src/database')

const PORT = Number(process.env.PORT || 4000)

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload))
}

function sendError(res, statusCode, code, message, details) {
  sendJson(res, statusCode, {
    code,
    message,
    details,
  })
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function parseJsonBody(buffer) {
  if (!buffer.length) {
    return {}
  }
  try {
    return JSON.parse(buffer.toString('utf8'))
  } catch (error) {
    return null
  }
}

function parseMultipart(buffer, boundary) {
  const body = buffer.toString('latin1')
  const marker = `--${boundary}`
  const sections = body.split(marker).slice(1, -1)
  const result = []

  sections.forEach((section) => {
    const normalized = section.replace(/^\r\n/, '')
    const headerEnd = normalized.indexOf('\r\n\r\n')
    if (headerEnd === -1) {
      return
    }

    const headerText = normalized.slice(0, headerEnd)
    let contentText = normalized.slice(headerEnd + 4)
    if (contentText.endsWith('\r\n')) {
      contentText = contentText.slice(0, -2)
    }

    const nameMatch = headerText.match(/name="([^"]+)"/)
    const filenameMatch = headerText.match(/filename="([^"]+)"/)
    const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i)

    result.push({
      name: nameMatch ? nameMatch[1] : '',
      filename: filenameMatch ? filenameMatch[1] : '',
      contentType: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
      buffer: Buffer.from(contentText, 'latin1'),
    })
  })

  return result
}

function serveUpload(req, res, pathname) {
  const target = path.join(UPLOADS_DIR, pathname.replace(/^\/uploads\//, ''))
  if (!target.startsWith(UPLOADS_DIR) || !fs.existsSync(target)) {
    sendError(res, 404, 'NOT_FOUND', 'Upload file not found')
    return
  }

  const stream = fs.createReadStream(target)
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
  })
  stream.pipe(res)
}

async function handleRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`)
  const pathname = requestUrl.pathname
  const query = Object.fromEntries(requestUrl.searchParams.entries())

  try {
    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'GET' && pathname.startsWith('/uploads/')) {
      serveUpload(req, res, pathname)
      return
    }

    if (req.method === 'POST' && pathname === '/auth/wechat/login') {
      const body = parseJsonBody(await collectBody(req))
      if (body === null) {
        sendError(res, 400, 'INVALID_JSON', 'Request body must be valid JSON')
        return
      }
      sendJson(res, 200, await loginWithWeChat(body))
      return
    }

    if (req.method === 'GET' && pathname === '/app/bootstrap') {
      sendJson(res, 200, bootstrapApp(req.headers))
      return
    }

    if (req.method === 'GET' && pathname === '/home') {
      sendJson(res, 200, getHomeData(req.headers, query))
      return
    }

    if (req.method === 'GET' && pathname === '/publish/meta') {
      sendJson(res, 200, getPublishMeta(req.headers))
      return
    }

    if (req.method === 'GET' && pathname === '/messages') {
      sendJson(res, 200, getMessagesPage(req.headers, query.tab || 'conversation'))
      return
    }

    if (req.method === 'POST' && pathname === '/messages/read') {
      const body = parseJsonBody(await collectBody(req))
      if (body === null) {
        sendError(res, 400, 'INVALID_JSON', 'Request body must be valid JSON')
        return
      }
      sendJson(res, 200, markMessageAsRead(req.headers, body))
      return
    }

    if (req.method === 'GET' && pathname === '/profile') {
      sendJson(res, 200, getProfilePage(req.headers))
      return
    }

    if (req.method === 'DELETE' && pathname === '/profile/recent-views') {
      sendJson(res, 200, clearProfileRecentViews(req.headers))
      return
    }

    if (req.method === 'GET' && pathname === '/navigation/summary') {
      sendJson(res, 200, getNavigationSummary(req.headers))
      return
    }

    if (req.method === 'POST' && pathname === '/products') {
      const body = parseJsonBody(await collectBody(req))
      if (body === null) {
        sendError(res, 400, 'INVALID_JSON', 'Request body must be valid JSON')
        return
      }
      sendJson(res, 200, submitProduct(req.headers, body))
      return
    }

    if (req.method === 'POST' && pathname === '/uploads/images') {
      const contentType = req.headers['content-type'] || ''
      const boundaryMatch = contentType.match(/boundary=([^;]+)/)
      if (!boundaryMatch) {
        sendError(res, 400, 'INVALID_UPLOAD', 'Multipart boundary is required')
        return
      }
      const parts = parseMultipart(await collectBody(req), boundaryMatch[1])
      const file = parts.find((item) => item.name === 'file')
      if (!file) {
        sendError(res, 400, 'INVALID_UPLOAD', 'file field is required')
        return
      }
      sendJson(res, 200, registerUpload(req.headers, file, `http://${req.headers.host}`))
      return
    }

    const favoriteMatch = pathname.match(/^\/favorites\/products\/([^/]+)\/toggle$/)
    if (req.method === 'POST' && favoriteMatch) {
      sendJson(res, 200, toggleProductFavorite(req.headers, decodeURIComponent(favoriteMatch[1])))
      return
    }

    const productMatch = pathname.match(/^\/products\/([^/]+)$/)
    if (req.method === 'GET' && productMatch) {
      const payload = getProductDetail(req.headers, decodeURIComponent(productMatch[1]))
      if (!payload) {
        sendError(res, 404, 'NOT_FOUND', 'Product not found')
        return
      }
      sendJson(res, 200, payload)
      return
    }

    const conversationMessageMatch = pathname.match(/^\/conversations\/([^/]+)\/messages$/)
    if (req.method === 'POST' && conversationMessageMatch) {
      const body = parseJsonBody(await collectBody(req))
      if (body === null) {
        sendError(res, 400, 'INVALID_JSON', 'Request body must be valid JSON')
        return
      }
      sendJson(res, 200, sendChatMessage(req.headers, decodeURIComponent(conversationMessageMatch[1]), body))
      return
    }

    const conversationMatch = pathname.match(/^\/conversations\/([^/]+)$/)
    if (req.method === 'GET' && conversationMatch) {
      const payload = getChatDetail(req.headers, decodeURIComponent(conversationMatch[1]))
      if (!payload) {
        sendError(res, 404, 'NOT_FOUND', 'Conversation not found')
        return
      }
      sendJson(res, 200, payload)
      return
    }

    if (req.method === 'DELETE' && pathname === '/debug/chat-threads') {
      sendJson(res, 200, resetThreadStore())
      return
    }

    sendError(res, 404, 'NOT_FOUND', 'Route not found')
  } catch (error) {
    sendError(
      res,
      Number(error.statusCode || 500),
      error.code || 'INTERNAL_ERROR',
      error.message || 'Unexpected server error',
      error.details
    )
  }
}

ensureDbFile()
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

http.createServer(handleRequest).listen(PORT, '127.0.0.1', () => {
  console.log(`Backend server listening on http://127.0.0.1:${PORT}`)
})
