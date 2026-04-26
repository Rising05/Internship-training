const { request, uploadImages } = require('./request')
const { submitTimeout } = require('./config')
const { getAuthSession, setAuthSession } = require('../../utils/storage')

function getWechatLoginCode() {
  return new Promise((resolve) => {
    if (!wx.login) {
      resolve('dev-code')
      return
    }

    wx.login({
      success(response) {
        resolve(response.code || 'dev-code')
      },
      fail() {
        resolve('dev-code')
      },
    })
  })
}

async function ensureSession() {
  const current = getAuthSession()
  if (current && current.loggedIn && current.openid) {
    return current
  }

  const code = await getWechatLoginCode()
  const session = await request({
    url: '/auth/wechat/login',
    method: 'POST',
    data: {
      code,
    },
  })

  setAuthSession(session)
  return session
}

function bootstrapApp() {
  return request({
    url: '/app/bootstrap',
  })
}

function getHomeData(params = {}) {
  return request({
    url: '/home',
    data: params,
  })
}

function getProductDetail(id) {
  return request({
    url: `/products/${id}`,
  })
}

function toggleProductFavorite(id) {
  return request({
    url: `/favorites/products/${id}/toggle`,
    method: 'POST',
  })
}

function getPublishPageData() {
  return request({
    url: '/publish/meta',
  })
}

async function submitProduct(payload) {
  const nextImages = await uploadImages(payload.images || [])

  return request({
    url: '/products',
    method: 'POST',
    timeout: submitTimeout,
    data: {
      ...payload,
      images: nextImages,
    },
  })
}

function getMessagesPageData(activeTab = 'conversation') {
  return request({
    url: '/messages',
    data: {
      tab: activeTab,
    },
  })
}

function markMessageAsRead(type, id) {
  return request({
    url: '/messages/read',
    method: 'POST',
    data: {
      type,
      id,
    },
  })
}

function getChatDetail(conversationId) {
  return request({
    url: `/conversations/${conversationId}`,
  })
}

function sendChatMessage(conversationId, content) {
  return request({
    url: `/conversations/${conversationId}/messages`,
    method: 'POST',
    data: {
      content,
      type: 'text',
    },
  })
}

function getProfilePageData() {
  return request({
    url: '/profile',
  })
}

function clearProfileRecentViews() {
  return request({
    url: '/profile/recent-views',
    method: 'DELETE',
  })
}

function getNavigationSummary() {
  return request({
    url: '/navigation/summary',
  })
}

function resetThreadStore() {
  return request({
    url: '/debug/chat-threads',
    method: 'DELETE',
  })
}

module.exports = {
  ensureSession,
  bootstrapApp,
  getHomeData,
  getProductDetail,
  toggleProductFavorite,
  getPublishPageData,
  submitProduct,
  getMessagesPageData,
  markMessageAsRead,
  getChatDetail,
  sendChatMessage,
  getProfilePageData,
  clearProfileRecentViews,
  getNavigationSummary,
  resetThreadStore,
}
