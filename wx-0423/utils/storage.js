const { normalizeIdolPayload } = require('./idol')

const STORAGE_KEYS = {
  favorites: 'xingcang_favorites',
  recentViews: 'xingcang_recent_views',
  profile: 'xingcang_profile',
  messageState: 'xingcang_message_state',
  publishedProducts: 'xingcang_published_products',
  chatThreads: 'xingcang_chat_threads',
  authSession: 'xingcang_auth_session',
}

const defaultProfile = {
  id: 'user001',
  nickname: '小星星',
  bio: '饭圈周边交易、交换与收藏记录都在这里。',
  location: '上海',
  publishedCount: 8,
  soldCount: 25,
  favoriteCount: 18,
  dealCount: 8,
}

const defaultAuthSession = {
  loggedIn: false,
  nickname: '小星星',
  openid: '',
}

const defaultMessageState = {
  conversationReadIds: [],
  tradeReadIds: [],
  systemReadIds: [],
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function normalizeLegacyCategoryLabel(value) {
  return value === '谷子' ? '其他' : value
}

function normalizeLegacyTags(tags) {
  if (!Array.isArray(tags)) {
    return []
  }

  return tags.map((item) => item === '官方谷' ? '官方大物' : item)
}

function normalizeProductLike(item) {
  return {
    ...item,
    ...normalizeIdolPayload(item),
    category: normalizeLegacyCategoryLabel(item.category),
    tags: normalizeLegacyTags(item.tags),
  }
}

function normalizeFavorites(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item) : []
}

function normalizeRecentViews(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item) => isPlainObject(item) && typeof item.id === 'string')
    .map((item) => ({
      ...normalizeProductLike(item),
      images: Array.isArray(item.images) ? item.images : [],
    }))
}

function normalizeProfile(value) {
  return isPlainObject(value) ? { ...defaultProfile, ...value } : { ...defaultProfile }
}

function normalizeAuthSession(value) {
  return isPlainObject(value) ? { ...defaultAuthSession, ...value } : { ...defaultAuthSession }
}

function normalizeMessageState(value) {
  const source = isPlainObject(value) ? value : {}

  return {
    conversationReadIds: normalizeFavorites(source.conversationReadIds),
    tradeReadIds: normalizeFavorites(source.tradeReadIds),
    systemReadIds: normalizeFavorites(source.systemReadIds),
  }
}

function normalizeProducts(value) {
  return Array.isArray(value)
    ? value
      .filter((item) => isPlainObject(item) && typeof item.id === 'string')
      .map((item) => normalizeProductLike(item))
    : []
}

function normalizeThreadMap(value) {
  if (!isPlainObject(value)) {
    return {}
  }

  return Object.keys(value).reduce((result, key) => {
    const item = value[key]
    if (!isPlainObject(item)) {
      return result
    }

    result[key] = {
      ...item,
      messages: Array.isArray(item.messages) ? item.messages.filter((message) => isPlainObject(message)) : [],
    }
    return result
  }, {})
}

function readStorage(key, fallback) {
  try {
    const value = wx.getStorageSync(key)
    return value === '' || value === undefined || value === null ? fallback : value
  } catch (error) {
    return fallback
  }
}

function writeStorage(key, value) {
  wx.setStorageSync(key, value)
  return value
}

function ensureStorageDefaults() {
  writeStorage(STORAGE_KEYS.favorites, normalizeFavorites(readStorage(STORAGE_KEYS.favorites, ['xc001', 'xc003'])))
  writeStorage(STORAGE_KEYS.recentViews, normalizeRecentViews(readStorage(STORAGE_KEYS.recentViews, [])))
  writeStorage(STORAGE_KEYS.profile, normalizeProfile(readStorage(STORAGE_KEYS.profile, defaultProfile)))
  writeStorage(STORAGE_KEYS.messageState, normalizeMessageState(readStorage(STORAGE_KEYS.messageState, defaultMessageState)))
  writeStorage(STORAGE_KEYS.publishedProducts, normalizeProducts(readStorage(STORAGE_KEYS.publishedProducts, [])))
  writeStorage(STORAGE_KEYS.chatThreads, normalizeThreadMap(readStorage(STORAGE_KEYS.chatThreads, {})))
  writeStorage(STORAGE_KEYS.authSession, normalizeAuthSession(readStorage(STORAGE_KEYS.authSession, defaultAuthSession)))
}

function getFavorites() {
  return normalizeFavorites(readStorage(STORAGE_KEYS.favorites, []))
}

function toggleFavorite(id) {
  const favorites = getFavorites()
  const nextFavorites = favorites.includes(id)
    ? favorites.filter((item) => item !== id)
    : [id, ...favorites]

  return writeStorage(STORAGE_KEYS.favorites, nextFavorites)
}

function getRecentViews() {
  return normalizeRecentViews(readStorage(STORAGE_KEYS.recentViews, []))
}

function addRecentView(product) {
  const current = getRecentViews().filter((item) => item.id !== product.id)
  const nextViews = [{
    ...product,
    images: Array.isArray(product.images) ? product.images.slice(0, 1) : [],
  }, ...current].slice(0, 8)

  return writeStorage(STORAGE_KEYS.recentViews, nextViews)
}

function clearRecentViews() {
  return writeStorage(STORAGE_KEYS.recentViews, [])
}

function getProfile() {
  return normalizeProfile(readStorage(STORAGE_KEYS.profile, defaultProfile))
}

function setProfile(profile) {
  return writeStorage(STORAGE_KEYS.profile, normalizeProfile(profile))
}

function getAuthSession() {
  return normalizeAuthSession(readStorage(STORAGE_KEYS.authSession, defaultAuthSession))
}

function setAuthSession(session) {
  return writeStorage(STORAGE_KEYS.authSession, normalizeAuthSession(session))
}

function clearAuthSession() {
  return writeStorage(STORAGE_KEYS.authSession, { ...defaultAuthSession })
}

function getMessageState() {
  return normalizeMessageState(readStorage(STORAGE_KEYS.messageState, defaultMessageState))
}

function markMessageRead(type, id) {
  const messageState = getMessageState()
  const keyMap = {
    conversation: 'conversationReadIds',
    trade: 'tradeReadIds',
    system: 'systemReadIds',
  }
  const targetKey = keyMap[type]
  if (!targetKey) {
    return messageState
  }

  const nextIds = messageState[targetKey].includes(id)
    ? messageState[targetKey]
    : [...messageState[targetKey], id]

  return writeStorage(STORAGE_KEYS.messageState, {
    ...messageState,
    [targetKey]: nextIds,
  })
}

function getPublishedProducts() {
  return normalizeProducts(readStorage(STORAGE_KEYS.publishedProducts, []))
}

function addPublishedProduct(product) {
  const current = getPublishedProducts()
  return writeStorage(STORAGE_KEYS.publishedProducts, [product, ...current])
}

function getChatThreads() {
  return normalizeThreadMap(readStorage(STORAGE_KEYS.chatThreads, {}))
}

function setChatThreads(threadMap) {
  return writeStorage(STORAGE_KEYS.chatThreads, normalizeThreadMap(threadMap))
}

function appendChatMessage(conversationId, message) {
  const threads = getChatThreads()
  const currentThread = isPlainObject(threads[conversationId]) ? threads[conversationId] : { messages: [] }
  const now = new Date().toISOString()
  const nextThread = {
    ...currentThread,
    updatedAt: now,
    messages: [...(currentThread.messages || []), {
      ...message,
      time: message.time || '刚刚',
    }],
  }

  return setChatThreads({
    ...threads,
    [conversationId]: nextThread,
  })
}

module.exports = {
  STORAGE_KEYS,
  ensureStorageDefaults,
  getFavorites,
  toggleFavorite,
  getRecentViews,
  addRecentView,
  clearRecentViews,
  getProfile,
  setProfile,
  getAuthSession,
  setAuthSession,
  clearAuthSession,
  getMessageState,
  markMessageRead,
  getPublishedProducts,
  addPublishedProduct,
  getChatThreads,
  setChatThreads,
  appendChatMessage,
}
