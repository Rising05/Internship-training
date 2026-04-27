const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const https = require('node:https')
const { normalizeIdolPayload } = require('../../utils/idol')
const {
  orderStatuses: defaultOrderStatuses,
  orderRecords: defaultOrderRecords,
  walletSnapshot: defaultWalletSnapshot,
  addressBook: defaultAddressBook,
  reviewRecords: defaultReviewRecords,
} = require('../../utils/mock')
const { DEMO_OPENID } = require('./seed')
const { readDb, withDb, resetDb } = require('./database')
const { readBackendConfig } = require('./config')
const {
  clearCloudRecentViews,
  removeCloudFavorite,
  removeCloudProduct,
  upsertCloudFavorite,
  upsertCloudMessageRead,
  upsertCloudProduct,
  upsertCloudRecentView,
  upsertCloudUser,
} = require('./cloudbase-store')

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads')
const DEFAULT_PAGE_SIZE = 6
const MAX_PAGE_SIZE = 60
const MAX_PRODUCT_IMAGES = 9
const MAX_PRODUCT_TITLE_LENGTH = 60
const MAX_PRODUCT_NOTE_LENGTH = 500
const MAX_MESSAGE_LENGTH = 500
const VALID_MESSAGE_TABS = new Set(['conversation', 'trade', 'system'])
const VALID_MESSAGE_READ_TYPES = new Set(['conversation', 'trade', 'system'])
const VALID_PRODUCT_STATUSES = new Set(['active', 'reserved', 'sold', 'hidden'])
const VALID_ORDER_STATUSES = new Set(['all', 'pending-pay', 'shipping', 'receiving', 'done'])
const PRODUCT_CARD_PREVIEW = '发来了一张商品卡片'
const DEFAULT_WALLET_TIPS = [
  '钱包页首版仅提供余额和账单只读展示。',
  '后续可接入提现、优惠券和售后退款流转。',
]
const PRODUCT_STATUS_META = {
  active: {
    label: '在售',
    tone: 'active',
    description: '商品正在展示中，可继续沟通与成交。',
    canPurchase: true,
  },
  reserved: {
    label: '已预留',
    tone: 'reserved',
    description: '商品已被预留，仍可进入聊天查看进度。',
    canPurchase: false,
  },
  sold: {
    label: '已售出',
    tone: 'sold',
    description: '商品已完成成交，仅保留记录与会话。',
    canPurchase: false,
  },
  hidden: {
    label: '已下架',
    tone: 'hidden',
    description: '商品已从首页隐藏，仅发布者可查看。',
    canPurchase: false,
  },
}

function ensureUploadsDir() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

function createId(prefix) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 8)}`
}

function getNowIso() {
  return new Date().toISOString()
}

function cloneItems(items = []) {
  return items.map((item) => ({ ...item }))
}

function createEmptyWallet() {
  return {
    balance: 0,
    pendingSettlement: 0,
    couponCount: 0,
    bills: [],
    tips: DEFAULT_WALLET_TIPS.slice(),
  }
}

function isDemoUser(user) {
  return !!(user && (user.openid === DEMO_OPENID || user.id === 'user001'))
}

function getDefaultOrders(user) {
  return isDemoUser(user) ? cloneItems(defaultOrderRecords) : []
}

function getDefaultWallet(user) {
  if (!isDemoUser(user)) {
    return createEmptyWallet()
  }

  return {
    ...defaultWalletSnapshot,
    bills: cloneItems(defaultWalletSnapshot.bills),
    tips: (defaultWalletSnapshot.tips || []).slice(),
  }
}

function getDefaultAddresses(user) {
  return isDemoUser(user) ? cloneItems(defaultAddressBook) : []
}

function getDefaultReviews(user) {
  return isDemoUser(user) ? cloneItems(defaultReviewRecords) : []
}

function parsePositiveNumber(value, field, options = {}) {
  const {
    allowZero = false,
    integer = false,
    max = Number.POSITIVE_INFINITY,
  } = options
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    throw createServiceError(400, 'INVALID_ARGUMENT', `${field} must be a valid number`, { field })
  }

  if (integer && !Number.isInteger(numeric)) {
    throw createServiceError(400, 'INVALID_ARGUMENT', `${field} must be an integer`, { field })
  }

  if (numeric < 0 || (!allowZero && numeric <= 0)) {
    throw createServiceError(400, 'INVALID_ARGUMENT', `${field} must be greater than ${allowZero ? 'or equal to ' : ''}0`, { field })
  }

  if (numeric > max) {
    throw createServiceError(400, 'INVALID_ARGUMENT', `${field} exceeds the allowed maximum`, { field, max })
  }

  return numeric
}

function requireTrimmedString(value, field, options = {}) {
  const {
    maxLength = Number.POSITIVE_INFINITY,
  } = options
  const normalized = String(value || '').trim()

  if (!normalized) {
    throw createServiceError(400, 'INVALID_ARGUMENT', `${field} is required`, { field })
  }

  if (normalized.length > maxLength) {
    throw createServiceError(400, 'INVALID_ARGUMENT', `${field} exceeds the allowed length`, {
      field,
      maxLength,
    })
  }

  return normalized
}

function validateMessageTab(tab) {
  const normalized = String(tab || 'conversation').trim()
  if (!VALID_MESSAGE_TABS.has(normalized)) {
    throw createServiceError(400, 'INVALID_ARGUMENT', 'tab is invalid', { field: 'tab' })
  }
  return normalized
}

function validateMessageReadBody(body = {}) {
  const type = String(body.type || '').trim()
  const id = String(body.id || '').trim()

  if (!VALID_MESSAGE_READ_TYPES.has(type)) {
    throw createServiceError(400, 'INVALID_ARGUMENT', 'type is invalid', { field: 'type' })
  }

  if (!id) {
    throw createServiceError(400, 'INVALID_ARGUMENT', 'id is required', { field: 'id' })
  }

  return { type, id }
}

function validateOrderStatus(value) {
  const normalized = String(value || 'all').trim().toLowerCase()
  if (!VALID_ORDER_STATUSES.has(normalized)) {
    throw createServiceError(400, 'INVALID_ARGUMENT', 'status is invalid', { field: 'status' })
  }
  return normalized
}

function validateConversationMessageBody(body = {}) {
  return {
    content: requireTrimmedString(body.content, 'content', { maxLength: MAX_MESSAGE_LENGTH }),
  }
}

function validateProductStatus(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!VALID_PRODUCT_STATUSES.has(normalized)) {
    throw createServiceError(400, 'INVALID_ARGUMENT', 'status is invalid', { field: 'status' })
  }
  return normalized
}

function validateProductUpdatePayload(payload = {}) {
  const nextPayload = {}

  if (payload.title !== undefined) {
    nextPayload.title = requireTrimmedString(payload.title, 'title', { maxLength: MAX_PRODUCT_TITLE_LENGTH })
  }
  if (payload.category !== undefined) {
    nextPayload.category = requireTrimmedString(payload.category, 'category')
  }
  if (payload.condition !== undefined) {
    nextPayload.condition = requireTrimmedString(payload.condition, 'condition')
  }
  if (payload.tradeType !== undefined) {
    nextPayload.tradeType = requireTrimmedString(payload.tradeType, 'tradeType')
  }
  if (payload.price !== undefined) {
    nextPayload.price = parsePositiveNumber(payload.price, 'price', { max: 999999 })
  }
  if (payload.quantity !== undefined) {
    nextPayload.quantity = parsePositiveNumber(payload.quantity, 'quantity', { integer: true, max: 99 })
  }
  if (payload.shippingFee !== undefined) {
    nextPayload.shippingFee = parsePositiveNumber(payload.shippingFee, 'shippingFee', { allowZero: true, max: 99999 })
  }
  if (payload.note !== undefined) {
    nextPayload.note = String(payload.note || '').trim().slice(0, MAX_PRODUCT_NOTE_LENGTH)
  }
  if (payload.images !== undefined) {
    const images = Array.isArray(payload.images) ? payload.images.filter(Boolean) : []
    if (!images.length) {
      throw createServiceError(400, 'INVALID_ARGUMENT', 'images is required', { field: 'images' })
    }
    if (images.length > MAX_PRODUCT_IMAGES) {
      throw createServiceError(400, 'INVALID_ARGUMENT', 'images exceeds the allowed count', {
        field: 'images',
        maxCount: MAX_PRODUCT_IMAGES,
      })
    }
    nextPayload.images = images.slice(0, MAX_PRODUCT_IMAGES)
  }
  if (payload.idolType !== undefined) {
    nextPayload.idolType = String(payload.idolType || '').trim()
  }
  if (payload.idolGroup !== undefined) {
    nextPayload.idolGroup = String(payload.idolGroup || '').trim()
  }
  if (payload.idolMember !== undefined) {
    nextPayload.idolMember = String(payload.idolMember || '').trim()
  }
  if (payload.idolDisplayName !== undefined) {
    nextPayload.idolDisplayName = String(payload.idolDisplayName || '').trim()
  }

  if (!Object.keys(nextPayload).length) {
    throw createServiceError(400, 'INVALID_ARGUMENT', 'No editable product fields were provided')
  }

  return nextPayload
}

function validateProductPayload(payload = {}) {
  const title = requireTrimmedString(payload.title, 'title', { maxLength: MAX_PRODUCT_TITLE_LENGTH })
  const category = requireTrimmedString(payload.category, 'category')
  const condition = requireTrimmedString(payload.condition, 'condition')
  const tradeType = requireTrimmedString(payload.tradeType || '出物', 'tradeType')
  const idolDisplayName = String(payload.idolDisplayName || '').trim()
  const idolGroup = String(payload.idolGroup || '').trim()
  const idolMember = String(payload.idolMember || '').trim()

  if (!idolDisplayName && !idolGroup && !idolMember) {
    throw createServiceError(400, 'INVALID_ARGUMENT', 'idolDisplayName or idolGroup/idolMember is required', {
      field: 'idolDisplayName',
    })
  }

  const images = Array.isArray(payload.images) ? payload.images.filter(Boolean) : []
  if (!images.length) {
    throw createServiceError(400, 'INVALID_ARGUMENT', 'images is required', { field: 'images' })
  }
  if (images.length > MAX_PRODUCT_IMAGES) {
    throw createServiceError(400, 'INVALID_ARGUMENT', 'images exceeds the allowed count', {
      field: 'images',
      maxCount: MAX_PRODUCT_IMAGES,
    })
  }

  return {
    ...payload,
    title,
    category,
    condition,
    tradeType,
    idolDisplayName,
    idolGroup,
    idolMember,
    price: parsePositiveNumber(payload.price, 'price', { max: 999999 }),
    quantity: parsePositiveNumber(payload.quantity || 1, 'quantity', { integer: true, max: 99 }),
    shippingFee: parsePositiveNumber(payload.shippingFee || 0, 'shippingFee', { allowZero: true, max: 99999 }),
    note: String(payload.note || '').trim().slice(0, MAX_PRODUCT_NOTE_LENGTH),
    images: images.slice(0, MAX_PRODUCT_IMAGES),
  }
}

function buildBannerImage(text, background, foreground) {
  return `https://dummyimage.com/1200x520/${background}/${foreground}.png&text=${encodeURIComponent(text).replace(/%20/g, '+')}`
}

function getHomeBanners() {
  return [
    {
      id: 'banner-home-01',
      title: '星仓开站引导',
      subtitle: '发布你的第一条交易信息',
      image: buildBannerImage('星仓+立即发布', 'f7dbe6', '805e6b'),
      targetType: 'switchTab',
      targetUrl: '/pages/publish/publish',
      ctaText: '立即发布',
      enabled: true,
      sort: 10,
      startAt: '2026-01-01T00:00:00+08:00',
      endAt: '2027-01-01T00:00:00+08:00',
      analyticsName: 'home_publish_banner',
      imagePosition: 'center center',
    },
    {
      id: 'banner-home-02',
      title: '活动专题预留',
      subtitle: '后续可直接接运营活动与限时专区',
      image: buildBannerImage('活动专区', 'efe6ff', '635a83'),
      targetType: 'navigate',
      targetUrl: '/pages/detail/detail?id=xc001',
      ctaText: '查看专题',
      enabled: true,
      sort: 20,
      startAt: '2026-01-01T00:00:00+08:00',
      endAt: '2027-01-01T00:00:00+08:00',
      analyticsName: 'home_campaign_banner',
      imagePosition: 'center center',
    },
    {
      id: 'banner-home-03',
      title: '消息触达预留',
      subtitle: '也可以接公告、福利和广告跳转',
      image: buildBannerImage('消息中心', 'dfeef6', '597886'),
      targetType: 'switchTab',
      targetUrl: '/pages/messages/messages',
      ctaText: '查看消息',
      enabled: true,
      sort: 30,
      startAt: '2026-01-01T00:00:00+08:00',
      endAt: '2027-01-01T00:00:00+08:00',
      analyticsName: 'home_message_banner',
      imagePosition: 'center center',
    },
  ]
}

function findUserByOpenid(db, openid = '') {
  const normalizedOpenid = typeof openid === 'string' ? openid.trim() : ''
  if (!normalizedOpenid) {
    return null
  }
  return db.users.find((item) => item.openid === normalizedOpenid) || null
}

function getUserByOpenid(db, openid = '') {
  return findUserByOpenid(db, openid)
}

function ensureUser(db, openid = DEMO_OPENID) {
  const existing = findUserByOpenid(db, openid)
  if (existing) {
    return existing
  }

  const now = getNowIso()
  const nextUser = {
    id: createId('user'),
    openid,
    nickname: '新用户',
    bio: '欢迎来到星仓。',
    location: '上海',
    publishedCount: 0,
    soldCount: 0,
    favoriteCount: 0,
    dealCount: 0,
    orders: [],
    wallet: createEmptyWallet(),
    addresses: [],
    reviews: [],
    createdAt: now,
    updatedAt: now,
  }
  db.users.unshift(nextUser)
  return nextUser
}

function getFavoriteIds(db, userId) {
  return db.favorites
    .filter((item) => item.userId === userId)
    .map((item) => item.productId)
}

function getAnonymousSummary() {
  return {
    favoriteCount: 0,
    recentCount: 0,
    unreadCount: 0,
    unreadConversationCount: 0,
    unreadDetail: {
      conversation: 0,
      trade: 0,
      system: 0,
    },
    publishedCount: 0,
  }
}

async function createUserRecord(db, openid) {
  if (!openid) {
    return {
      db,
      user: null,
    }
  }

  const config = readBackendConfig()
  if (config.dataProvider === 'cloudbase') {
    const user = ensureUser(db, openid)
    await upsertCloudUser(user)
    return {
      db,
      user,
    }
  }

  const nextDb = await withDb((snapshot) => {
    ensureUser(snapshot, openid)
    return snapshot
  })

  return {
    db: nextDb,
    user: getUserByOpenid(nextDb, openid),
  }
}

async function readDbWithOptionalUser(headers, options = {}) {
  const { createIfMissing = false } = options
  const openid = getCurrentUserFromHeaders(headers)
  let db = await readDb()
  let user = getUserByOpenid(db, openid)

  if (!user && openid && createIfMissing) {
    const created = await createUserRecord(db, openid)
    db = created.db
    user = created.user
  }

  return {
    db,
    user,
    openid,
  }
}

async function requireAuthenticatedUser(headers, options = {}) {
  const context = await readDbWithOptionalUser(headers, {
    createIfMissing: true,
    ...options,
  })

  if (!context.openid || !context.user) {
    throw createServiceError(401, 'AUTH_REQUIRED', 'Login required')
  }

  return context
}

function getReadIds(db, userId, type) {
  return db.messageReads
    .filter((item) => item.userId === userId && item.type === type)
    .map((item) => item.targetId)
}

function getActiveProducts(db) {
  return db.products.filter((item) => item.status !== 'hidden')
}

function getStoredProductById(db, id) {
  return db.products.find((item) => item.id === id) || null
}

function getProductById(db, id) {
  return getActiveProducts(db).find((item) => item.id === id) || null
}

function getProductStatusMeta(status) {
  return PRODUCT_STATUS_META[status] || PRODUCT_STATUS_META.active
}

function createProductCard(product, favoriteIds) {
  const statusMeta = getProductStatusMeta(product.status)
  return {
    ...product,
    isFavorite: favoriteIds.includes(product.id),
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    canPurchase: statusMeta.canPurchase,
    seller: {
      avatarText: '星',
      ...(product.seller || {}),
    },
  }
}

function sortProductsByCreatedAt(list) {
  return list.slice().sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function getConversationMessages(db, conversationId) {
  return db.messages
    .filter((item) => item.conversationId === conversationId)
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order
      }
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    })
}

function getConversationLastMessage(db, conversationId) {
  return getConversationMessages(db, conversationId).slice(-1)[0] || null
}

function getMessagePreviewText(message, fallback = '') {
  if (!message) {
    return fallback
  }

  return message.type === 'product' ? PRODUCT_CARD_PREVIEW : (message.content || fallback)
}

function sumUnreadCount(list = []) {
  return list.reduce((result, item) => result + (Number(item.unread) || 0), 0)
}

function buildNotificationList(items = [], readIds = []) {
  return items.map((item) => ({
    ...item,
    avatarText: item.type.slice(0, 1),
    unread: readIds.includes(item.id) ? 0 : item.unread,
  }))
}

function buildConversationList(db, user) {
  if (!user) {
    return []
  }

  const favoriteIds = getFavoriteIds(db, user.id)
  const readIds = getReadIds(db, user.id, 'conversation')

  return db.conversations.slice().sort((left, right) => {
    const rightLastMessage = getConversationLastMessage(db, right.id)
    const leftLastMessage = getConversationLastMessage(db, left.id)
    const rightActiveAt = new Date(
      (rightLastMessage && rightLastMessage.createdAt) || right.updatedAt || right.createdAt || 0
    ).getTime()
    const leftActiveAt = new Date(
      (leftLastMessage && leftLastMessage.createdAt) || left.updatedAt || left.createdAt || 0
    ).getTime()

    return rightActiveAt - leftActiveAt
  }).map((conversation) => {
    const lastMessage = getConversationLastMessage(db, conversation.id)
    const relatedProduct = getProductById(db, conversation.relatedProductId)

    return {
      id: conversation.id,
      name: conversation.user.name,
      initial: conversation.user.avatarText || conversation.user.name.slice(0, 1),
      content: getMessagePreviewText(lastMessage, conversation.seedPreview),
      time: lastMessage ? (lastMessage.time || '刚刚') : conversation.seedTime,
      unread: readIds.includes(conversation.id) ? 0 : conversation.seedUnread,
      relatedProductId: conversation.relatedProductId,
      avatarText: conversation.user.avatarText || conversation.user.name.slice(0, 1),
      isFavoriteProduct: relatedProduct ? favoriteIds.includes(relatedProduct.id) : false,
    }
  })
}

function buildGlobalSummary(db, user) {
  if (!user) {
    return getAnonymousSummary()
  }

  const favoriteIds = getFavoriteIds(db, user.id)
  const recentViews = db.recentViews.filter((item) => item.userId === user.id)
  const conversationList = buildConversationList(db, user)
  const tradeList = buildNotificationList(db.tradeNotifications, getReadIds(db, user.id, 'trade'))
  const systemList = buildNotificationList(db.systemNotifications, getReadIds(db, user.id, 'system'))
  const unreadConversationCount = sumUnreadCount(conversationList)
  const unreadTradeCount = sumUnreadCount(tradeList)
  const unreadSystemCount = sumUnreadCount(systemList)

  return {
    favoriteCount: favoriteIds.length,
    recentCount: recentViews.length,
    unreadCount: unreadConversationCount + unreadTradeCount + unreadSystemCount,
    unreadConversationCount,
    unreadDetail: {
      conversation: unreadConversationCount,
      trade: unreadTradeCount,
      system: unreadSystemCount,
    },
    publishedCount: getPublishedProducts(db, user.id).length,
  }
}

function buildChatThread(db, user, conversationId) {
  const conversation = db.conversations.find((item) => item.id === conversationId)
  if (!conversation) {
    return null
  }

  const favoriteIds = getFavoriteIds(db, user.id)
  const relatedProduct = getProductById(db, conversation.relatedProductId)
  const messages = getConversationMessages(db, conversationId).map((item) => ({
    id: item.id,
    type: item.type,
    from: item.from,
    content: item.content,
    time: item.time || '刚刚',
    product: item.productId ? createProductCard(getProductById(db, item.productId), favoriteIds) : null,
  }))

  return {
    id: conversation.id,
    title: conversation.user.name,
    subtitle: conversation.user.subtitle,
    user: conversation.user,
    relatedProduct: relatedProduct ? createProductCard(relatedProduct, favoriteIds) : null,
    messages,
  }
}

function buildProfile(db, user) {
  const favoriteCount = getFavoriteIds(db, user.id).length
  const soldCount = db.products.filter((item) => item.ownerUserId === user.id && item.status === 'sold').length

  return {
    id: user.id,
    nickname: user.nickname,
    bio: user.bio,
    location: user.location,
    publishedCount: getPublishedProducts(db, user.id).length,
    soldCount,
    favoriteCount,
    dealCount: user.dealCount,
  }
}

function getUserOrders(user) {
  if (Array.isArray(user.orders) && user.orders.length) {
    return cloneItems(user.orders)
  }
  return getDefaultOrders(user)
}

function getUserWallet(user) {
  const fallback = getDefaultWallet(user)
  const current = user.wallet || {}
  return {
    ...fallback,
    ...current,
    bills: Array.isArray(current.bills) && current.bills.length ? cloneItems(current.bills) : fallback.bills,
    tips: Array.isArray(current.tips) && current.tips.length ? current.tips.slice() : fallback.tips,
  }
}

function getUserAddresses(user) {
  if (Array.isArray(user.addresses) && user.addresses.length) {
    return cloneItems(user.addresses)
  }
  return getDefaultAddresses(user)
}

function getUserReviews(user) {
  if (Array.isArray(user.reviews) && user.reviews.length) {
    return cloneItems(user.reviews)
  }
  return getDefaultReviews(user)
}

function getOrderStatuses(db) {
  const current = db.dictionaries && Array.isArray(db.dictionaries.orderStatuses)
    ? db.dictionaries.orderStatuses
    : []
  return current.length ? current : defaultOrderStatuses
}

function getOrderStatusMap(db) {
  return getOrderStatuses(db).reduce((result, item) => {
    result[item.key] = item.label
    return result
  }, {})
}

function buildOrderStatusSummary(db, orders) {
  return getOrderStatuses(db).map((item) => ({
    ...item,
    count: item.key === 'all'
      ? orders.length
      : orders.filter((order) => order.status === item.key).length,
  }))
}

function formatDateLabel(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function getOrderActionLabel(status) {
  const mapping = {
    'pending-pay': '去付款',
    shipping: '提醒发货',
    receiving: '确认收货',
    done: '再次联系',
  }
  return mapping[status] || '查看详情'
}

function buildOrderItem(db, user, order, favoriteIds) {
  const statusMap = getOrderStatusMap(db)
  const product = getStoredProductById(db, order.productId) || getProductById(db, order.productId)
  const productCard = product ? createProductCard(product, favoriteIds) : null

  return {
    id: order.id,
    status: order.status,
    statusLabel: statusMap[order.status] || order.status,
    price: Number(order.price) || 0,
    createdAt: order.createdAt,
    createdAtLabel: formatDateLabel(order.createdAt),
    actionLabel: getOrderActionLabel(order.status),
    seller: {
      id: order.sellerId || (product && product.seller && product.seller.id) || '',
      name: order.sellerName || (product && product.seller && product.seller.name) || '',
      city: order.sellerCity || (product && product.seller && product.seller.city) || '',
    },
    buyer: {
      id: order.buyerUserId || user.id,
      name: order.buyerName || user.nickname,
    },
    product: productCard ? {
      id: productCard.id,
      title: productCard.title,
      idolDisplayName: productCard.idolDisplayName || productCard.idol,
      category: productCard.category,
      images: productCard.images,
    } : null,
  }
}

function buildReviewStats(reviews = []) {
  if (!reviews.length) {
    return {
      averageScore: 0,
      totalCount: 0,
      positiveRate: '0%',
    }
  }

  const scoreTotal = reviews.reduce((result, item) => result + (Number(item.score) || 0), 0)
  const positiveCount = reviews.filter((item) => Number(item.score) >= 4).length
  return {
    averageScore: Number((scoreTotal / reviews.length).toFixed(1)),
    totalCount: reviews.length,
    positiveRate: `${Math.round((positiveCount / reviews.length) * 100)}%`,
  }
}

function getPublishedProducts(db, userId) {
  return sortProductsByCreatedAt(db.products.filter((item) => item.ownerUserId === userId && item.status !== 'hidden'))
}

function getProductsByIds(db, ids) {
  return ids.map((id) => getProductById(db, id)).filter(Boolean)
}

function addRecentView(db, user, productId) {
  db.recentViews = db.recentViews.filter((item) => !(item.userId === user.id && item.productId === productId))
  db.recentViews.unshift({
    userId: user.id,
    productId,
    viewedAt: getNowIso(),
  })
  db.recentViews = db.recentViews.slice(0, 8)
}

function buildRelatedProducts(db, user, product, favoriteIds) {
  return sortProductsByCreatedAt(getActiveProducts(db))
    .filter((item) => item.id !== product.id)
    .filter((item) => item.category === product.category || item.idolDisplayName === product.idolDisplayName)
    .slice(0, 4)
    .map((item) => createProductCard(item, favoriteIds))
}

function ensureProductOwner(product, user) {
  if (!product || product.ownerUserId !== user.id) {
    throw createServiceError(403, 'FORBIDDEN', 'Only the product owner can manage this product')
  }
}

function normalizeQueryValue(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function filterProducts(db, params) {
  const {
    keyword = '',
    idolTypeTab = 'group',
    activeGroup = '全部',
    activeMember = '全部',
    activeSolo = '全部',
    activeCategory = '全部',
    activeFeed = 'latest',
  } = params

  const normalizedKeyword = normalizeQueryValue(keyword)
  const normalizedGroup = normalizeQueryValue(activeGroup)
  const normalizedMember = normalizeQueryValue(activeMember)
  const normalizedSolo = normalizeQueryValue(activeSolo)
  const normalizedCategory = normalizeQueryValue(activeCategory)

  return sortProductsByCreatedAt(getActiveProducts(db)).filter((item) => {
    const keywordTarget = [
      item.title,
      item.idolDisplayName,
      item.idolGroup,
      item.idolMember,
      item.category,
      item.note,
      ...(item.tags || []),
    ].join(' ').toLowerCase()
    const matchKeyword = !normalizedKeyword
      || keywordTarget.includes(normalizedKeyword)
    const matchIdol = idolTypeTab === 'group'
      ? (
        (activeGroup === '全部' || item.idolGroup.toLowerCase().includes(normalizedGroup))
        && (
          activeGroup === '全部'
          || activeMember === '全部'
          || item.idolMember.toLowerCase().includes(normalizedMember)
        )
      )
      : (activeSolo === '全部' || (
        item.idolType === 'solo'
        && item.idolDisplayName.toLowerCase().includes(normalizedSolo)
      ))
    const matchCategory = activeCategory === '全部' || item.category.toLowerCase() === normalizedCategory
    const matchFeed = activeFeed === 'hot' ? item.isHot : item.isLatest
    return matchKeyword && matchIdol && matchCategory && matchFeed
  })
}

function getCurrentUserFromHeaders(headers = {}) {
  const openid = headers['x-openid'] || headers['X-Openid'] || ''
  return typeof openid === 'string' ? openid.trim() : ''
}

function createServiceError(statusCode, code, message, details) {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  error.details = details
  return error
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (error) {
          reject(createServiceError(502, 'WECHAT_RESPONSE_INVALID', 'WeChat login response is not valid JSON'))
        }
      })
    })

    request.setTimeout(10000, () => {
      request.destroy(createServiceError(504, 'WECHAT_REQUEST_TIMEOUT', 'WeChat login request timed out'))
    })
    request.on('error', (error) => {
      if (error && error.code && String(error.code).startsWith('WECHAT_')) {
        reject(error)
        return
      }
      reject(createServiceError(502, 'WECHAT_REQUEST_FAILED', 'WeChat login request failed', error.message))
    })
  })
}

function shouldUseRealWeChatLogin(config, code) {
  if (config.wechat.loginMode === 'code2session') {
    return true
  }

  if (config.wechat.loginMode === 'stub') {
    return false
  }

  return Boolean(config.wechat.appId && config.wechat.appSecret && code && code !== 'dev-code')
}

function shouldFallbackToStubSession(config) {
  return config.envProfile === 'local-file' || config.dataProvider === 'file'
}

async function buildStubLoginSession(code) {
  const fallbackOpenid = code
    ? `demo-${crypto.createHash('md5').update(code).digest('hex').slice(0, 8)}`
    : DEMO_OPENID
  const db = await withDb((current) => {
    ensureUser(current, DEMO_OPENID)
    return current
  })
  const user = getUserByOpenid(db, DEMO_OPENID)

  return {
    loggedIn: true,
    openid: user.openid || fallbackOpenid,
    nickname: user.nickname,
    sessionSource: 'stub',
  }
}

async function resolveWeChatSession(code) {
  const config = readBackendConfig()
  if (!config.wechat.appId || !config.wechat.appSecret) {
    throw createServiceError(
      500,
      'WECHAT_CONFIG_MISSING',
      'WECHAT_APP_ID and WECHAT_APP_SECRET are required for real WeChat login'
    )
  }

  const query = new URLSearchParams({
    appid: config.wechat.appId,
    secret: config.wechat.appSecret,
    js_code: code,
    grant_type: 'authorization_code',
  })
  const payload = await requestJson(`https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`)

  if (!payload || payload.errcode) {
    throw createServiceError(
      401,
      'WECHAT_LOGIN_FAILED',
      (payload && payload.errmsg) || 'WeChat code2Session failed',
      payload || null
    )
  }

  return payload
}

async function loginWithWeChat(body = {}) {
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const config = readBackendConfig()

  if (shouldUseRealWeChatLogin(config, code)) {
    if (!code) {
      throw createServiceError(400, 'WECHAT_CODE_REQUIRED', 'wx.login code is required')
    }

    let session
    try {
      session = await resolveWeChatSession(code)
    } catch (error) {
      if (!shouldFallbackToStubSession(config)) {
        throw error
      }

      return buildStubLoginSession(code)
    }

    let db

    if (config.dataProvider === 'cloudbase') {
      db = await readDb()
      let user = findUserByOpenid(db, session.openid)
      if (!user) {
        user = ensureUser(db, session.openid)
      }
      user.unionId = session.unionid || user.unionId || ''
      user.updatedAt = getNowIso()
      await upsertCloudUser(user)
    } else {
      db = await withDb((current) => {
        const user = ensureUser(current, session.openid)
        user.unionId = session.unionid || user.unionId || ''
        user.updatedAt = getNowIso()
        return current
      })
    }

    const user = getUserByOpenid(db, session.openid)

    return {
      loggedIn: true,
      openid: user.openid,
      nickname: user.nickname,
      sessionSource: 'wechat',
    }
  }

  return buildStubLoginSession(code)
}

async function bootstrapApp(headers) {
  const { db, user } = await readDbWithOptionalUser(headers, { createIfMissing: true })
  if (!user) {
    return {
      authSession: {
        loggedIn: false,
        nickname: '',
        openid: '',
      },
      profile: null,
      summary: getAnonymousSummary(),
    }
  }

  return {
    authSession: {
      loggedIn: true,
      nickname: user.nickname,
      openid: user.openid,
    },
    profile: buildProfile(db, user),
    summary: buildGlobalSummary(db, user),
  }
}

async function getHomeData(headers, params = {}) {
  const { db, user } = await readDbWithOptionalUser(headers, { createIfMissing: true })
  const favoriteIds = user ? getFavoriteIds(db, user.id) : []
  const pageIndex = parsePositiveNumber(params.pageIndex || 1, 'pageIndex', { integer: true, max: 999 })
  const pageSize = parsePositiveNumber(params.pageSize || DEFAULT_PAGE_SIZE, 'pageSize', {
    integer: true,
    max: MAX_PAGE_SIZE,
  })
  const filtered = filterProducts(db, params)
  const startIndex = (pageIndex - 1) * pageSize
  const endIndex = startIndex + pageSize
  const sliced = filtered.slice(startIndex, endIndex).map((item) => createProductCard(item, favoriteIds))

  return {
    banners: getHomeBanners(),
    quickEntries: db.dictionaries.homeQuickEntries,
    searchSuggestions: db.dictionaries.searchSuggestions,
    idolOptions: db.dictionaries.idolOptions,
    idolDirectory: db.dictionaries.idolDirectory,
    memberDirectory: db.dictionaries.memberDirectory,
    categoryOptions: db.dictionaries.categoryOptions,
    feedModes: db.dictionaries.feedModes,
    totalCount: getActiveProducts(db).length,
    matchedCount: filtered.length,
    hasMore: endIndex < filtered.length,
    items: sliced,
  }
}

async function getProductDetail(headers, id) {
  const config = readBackendConfig()
  const { db, user, openid } = await readDbWithOptionalUser(headers, { createIfMissing: true })
  const ownedProduct = user ? getStoredProductById(db, id) : null
  const product = ownedProduct && user && ownedProduct.ownerUserId === user.id
    ? ownedProduct
    : getProductById(db, id)
  if (!product) {
    return null
  }

  if (user && config.dataProvider === 'cloudbase') {
    const nextRecentView = {
      userId: user.id,
      productId: product.id,
      viewedAt: getNowIso(),
    }
    await upsertCloudRecentView(nextRecentView)
    addRecentView(db, user, product.id)
  } else if (user) {
    const nextDb = await withDb((current) => {
      const currentUser = ensureUser(current, openid)
      const currentProduct = getStoredProductById(current, id)
      if (currentProduct) {
        addRecentView(current, currentUser, currentProduct.id)
      }
      return current
    })
    db.recentViews = nextDb.recentViews
  }

  const publishedCount = product.ownerUserId
    ? getPublishedProducts(db, product.ownerUserId).length
    : 12
  const favoriteIds = user ? getFavoriteIds(db, user.id) : []
  const statusMeta = getProductStatusMeta(product.status)

  return {
    ...createProductCard(product, favoriteIds),
    seller: {
      ...product.seller,
      publishedCount,
      responseRate: '95%',
    },
    isOwner: !!(user && product.ownerUserId === user.id),
    statusDescription: statusMeta.description,
    relatedProducts: buildRelatedProducts(db, user, product, favoriteIds),
    policies: [
      '支持私聊沟通细节与补图',
      '支持商品状态管理、上下架与已售标记',
      '请在确认品相与价格后再发起交易',
    ],
  }
}

async function toggleProductFavorite(headers, id) {
  const config = readBackendConfig()
  const { db, user, openid } = await requireAuthenticatedUser(headers)
  const product = getProductById(db, id)
  if (!product) {
    throw createServiceError(404, 'NOT_FOUND', 'Product not found', { productId: id })
  }
  const existing = db.favorites.find((item) => item.userId === user.id && item.productId === id)

  if (config.dataProvider === 'cloudbase') {
    if (existing) {
      await removeCloudFavorite(user.id, id)
      db.favorites = db.favorites.filter((item) => !(item.userId === user.id && item.productId === id))
    } else {
      const nextFavorite = {
        userId: user.id,
        productId: id,
        createdAt: getNowIso(),
      }
      await upsertCloudFavorite(nextFavorite)
      db.favorites.unshift(nextFavorite)
    }
  } else {
    const nextDb = await withDb((current) => {
      const currentUser = ensureUser(current, openid)
      const currentExisting = current.favorites.find((item) => item.userId === currentUser.id && item.productId === id)
      if (currentExisting) {
        current.favorites = current.favorites.filter((item) => !(item.userId === currentUser.id && item.productId === id))
      } else {
        current.favorites.unshift({
          userId: currentUser.id,
          productId: id,
          createdAt: getNowIso(),
        })
      }
      return current
    })
    db.favorites = nextDb.favorites
  }

  const favoriteIds = getFavoriteIds(db, user.id)

  return {
    favoriteIds,
    isFavorite: favoriteIds.includes(id),
    summary: buildGlobalSummary(db, user),
  }
}

async function getPublishMeta(headers) {
  const { db, user } = await requireAuthenticatedUser(headers)
  const publishCategoryOptions = db.dictionaries.categoryOptions.slice(1)

  return {
    idolOptions: db.dictionaries.idolOptions.slice(1),
    idolDirectory: db.dictionaries.idolDirectory,
    memberDirectory: db.dictionaries.memberDirectory,
    categoryOptions: publishCategoryOptions,
    categorySections: {
      common: publishCategoryOptions.slice(0, 5),
      extra: publishCategoryOptions.slice(5),
    },
    conditionOptions: db.dictionaries.conditionOptions,
    tradeTypeOptions: db.dictionaries.tradeTypeOptions,
    seller: {
      nickname: user.nickname,
      location: user.location,
    },
    tips: [
      '发布前建议补充清晰封面、价格、数量和成色信息。',
      '当前已按正式版结构预留图片上传与审核字段。',
      '后续可直接替换为微信云存储正式地址。',
    ],
  }
}

async function submitProduct(headers, payload = {}) {
  const validated = validateProductPayload(payload)
  const { db, user, openid } = await requireAuthenticatedUser(headers)
  const tradeType = validated.tradeType || '出物'
  const nextProduct = normalizeIdolPayload({
    id: createId('ugc'),
    title: validated.title,
    category: validated.category,
    price: validated.price,
    quantity: validated.quantity,
    images: validated.images,
    condition: validated.condition,
    tradeType,
    shippingFee: validated.shippingFee,
    tags: [validated.category, tradeType].filter(Boolean),
    note: validated.note,
    idolType: validated.idolType,
    idolGroup: validated.idolGroup,
    idolMember: validated.idolMember,
    idolDisplayName: validated.idolDisplayName,
    seller: {
      id: user.id,
      name: user.nickname,
      city: user.location,
      level: '新发布',
      intro: user.bio,
      avatarText: user.nickname.slice(0, 1),
    },
    ownerUserId: user.id,
    status: 'active',
    isHot: false,
    isLatest: true,
    conversationId: 'conv001',
    createdAt: getNowIso(),
    updatedAt: getNowIso(),
  })

  if (readBackendConfig().dataProvider === 'cloudbase') {
    await upsertCloudProduct(nextProduct)
    db.products.unshift(nextProduct)
  } else {
    const nextDb = await withDb((current) => {
      current.products.unshift(nextProduct)
      return current
    })
    db.products = nextDb.products
  }

  return {
    success: true,
    product: getPublishedProducts(db, user.id)[0],
    summary: buildGlobalSummary(db, user),
  }
}

async function updateProduct(headers, id, payload = {}) {
  const updates = validateProductUpdatePayload(payload)
  const { db, user } = await requireAuthenticatedUser(headers)
  const product = getStoredProductById(db, id)
  if (!product) {
    throw createServiceError(404, 'NOT_FOUND', 'Product not found', { productId: id })
  }
  ensureProductOwner(product, user)

  const nextProduct = normalizeIdolPayload({
    ...product,
    ...updates,
    updatedAt: getNowIso(),
  })

  if (readBackendConfig().dataProvider === 'cloudbase') {
    await upsertCloudProduct(nextProduct)
    const productIndex = db.products.findIndex((item) => item.id === id)
    if (productIndex >= 0) {
      db.products.splice(productIndex, 1, nextProduct)
    }
  } else {
    const nextDb = await withDb((current) => {
      const currentProduct = getStoredProductById(current, id)
      Object.assign(currentProduct, nextProduct)
      return current
    })
    db.products = nextDb.products
  }

  return {
    success: true,
    product: createProductCard(nextProduct, getFavoriteIds(db, user.id)),
    summary: buildGlobalSummary(db, user),
  }
}

async function updateProductStatus(headers, id, body = {}) {
  const status = validateProductStatus(body.status)
  const { db, user } = await requireAuthenticatedUser(headers)
  const product = getStoredProductById(db, id)
  if (!product) {
    throw createServiceError(404, 'NOT_FOUND', 'Product not found', { productId: id })
  }
  ensureProductOwner(product, user)

  const nextProduct = {
    ...product,
    status,
    updatedAt: getNowIso(),
  }

  if (readBackendConfig().dataProvider === 'cloudbase') {
    await upsertCloudProduct(nextProduct)
    const productIndex = db.products.findIndex((item) => item.id === id)
    if (productIndex >= 0) {
      db.products.splice(productIndex, 1, nextProduct)
    }
  } else {
    const nextDb = await withDb((current) => {
      const currentProduct = getStoredProductById(current, id)
      currentProduct.status = status
      currentProduct.updatedAt = nextProduct.updatedAt
      return current
    })
    db.products = nextDb.products
  }

  return {
    success: true,
    product: createProductCard(nextProduct, getFavoriteIds(db, user.id)),
    summary: buildGlobalSummary(db, user),
  }
}

async function deleteProduct(headers, id) {
  const { db, user, openid } = await requireAuthenticatedUser(headers)
  const product = getStoredProductById(db, id)
  if (!product) {
    throw createServiceError(404, 'NOT_FOUND', 'Product not found', { productId: id })
  }
  ensureProductOwner(product, user)

  if (readBackendConfig().dataProvider === 'cloudbase') {
    await removeCloudProduct(id)
    db.products = db.products.filter((item) => item.id !== id)
    db.favorites = db.favorites.filter((item) => item.productId !== id)
    db.recentViews = db.recentViews.filter((item) => item.productId !== id)
  } else {
    const nextDb = await withDb((current) => {
      current.products = current.products.filter((item) => item.id !== id)
      current.favorites = current.favorites.filter((item) => item.productId !== id)
      current.recentViews = current.recentViews.filter((item) => item.productId !== id)
      return current
    })
    db.products = nextDb.products
    db.favorites = nextDb.favorites
    db.recentViews = nextDb.recentViews
  }

  return {
    success: true,
    deletedProductId: id,
    summary: buildGlobalSummary(db, user),
  }
}

async function getMessagesPage(headers, activeTab = 'conversation') {
  const { db, user } = await requireAuthenticatedUser(headers)
  const normalizedTab = validateMessageTab(activeTab)

  const listMap = {
    conversation: buildConversationList(db, user),
    trade: buildNotificationList(db.tradeNotifications, getReadIds(db, user.id, 'trade')),
    system: buildNotificationList(db.systemNotifications, getReadIds(db, user.id, 'system')),
  }

  return {
    tabs: db.dictionaries.messageTabs,
    activeTab: normalizedTab,
    list: listMap[normalizedTab] || listMap.conversation,
    summary: buildGlobalSummary(db, user),
  }
}

async function markMessageAsRead(headers, body = {}) {
  const { type, id } = validateMessageReadBody(body)
  const { openid } = await requireAuthenticatedUser(headers)
  let db

  if (readBackendConfig().dataProvider === 'cloudbase') {
    const context = await requireAuthenticatedUser(headers)
    db = context.db
    const user = context.user
    const exists = db.messageReads.find(
      (item) => item.userId === user.id && item.type === type && item.targetId === id
    )
    if (!exists) {
      const nextRead = {
        userId: user.id,
        type,
        targetId: id,
        readAt: getNowIso(),
      }
      await upsertCloudMessageRead(nextRead)
      db.messageReads.unshift(nextRead)
    }
  } else {
    db = await withDb((current) => {
      const user = ensureUser(current, openid)
      const exists = current.messageReads.find(
        (item) => item.userId === user.id && item.type === type && item.targetId === id
      )
      if (!exists) {
        current.messageReads.unshift({
          userId: user.id,
          type,
          targetId: id,
          readAt: getNowIso(),
        })
      }
      return current
    })
  }
  const user = getUserByOpenid(db, openid)

  return {
    success: true,
    summary: buildGlobalSummary(db, user),
  }
}

async function getChatDetail(headers, conversationId) {
  const config = readBackendConfig()
  const auth = await requireAuthenticatedUser(headers)
  const { openid } = auth
  let db

  if (config.dataProvider === 'cloudbase') {
    db = auth.db
    const user = auth.user
    const exists = db.messageReads.find(
      (item) => item.userId === user.id && item.type === 'conversation' && item.targetId === conversationId
    )
    if (!exists) {
      const nextRead = {
        userId: user.id,
        type: 'conversation',
        targetId: conversationId,
        readAt: getNowIso(),
      }
      await upsertCloudMessageRead(nextRead)
      db.messageReads.unshift(nextRead)
    }
  } else {
    db = await withDb((current) => {
      const user = ensureUser(current, openid)
      const exists = current.messageReads.find(
        (item) => item.userId === user.id && item.type === 'conversation' && item.targetId === conversationId
      )
      if (!exists) {
        current.messageReads.unshift({
          userId: user.id,
          type: 'conversation',
          targetId: conversationId,
          readAt: getNowIso(),
        })
      }
      return current
    })
  }

  const user = getUserByOpenid(db, openid)
  const thread = buildChatThread(db, user, conversationId)
  if (!thread) {
    return null
  }

  return {
    ...thread,
    summary: buildGlobalSummary(db, user),
  }
}

async function sendChatMessage(headers, conversationId, body = {}) {
  const { content } = validateConversationMessageBody(body)
  const { openid } = await requireAuthenticatedUser(headers)

  const db = await withDb((current) => {
    const conversation = current.conversations.find((item) => item.id === conversationId)
    if (!conversation) {
      throw createServiceError(404, 'NOT_FOUND', 'Conversation not found', { conversationId })
    }
    const order = current.messages.filter((item) => item.conversationId === conversationId).length
    current.messages.push({
      id: createId('msg'),
      conversationId,
      type: 'text',
      from: 'self',
      content,
      productId: '',
      time: '刚刚',
      order,
      createdAt: getNowIso(),
    })
    conversation.updatedAt = getNowIso()
    return current
  })
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))

  return {
    success: true,
    thread: buildChatThread(db, user, conversationId),
    summary: buildGlobalSummary(db, user),
  }
}

async function getProfilePage(headers) {
  const { db, user } = await requireAuthenticatedUser(headers)
  const favoriteIds = getFavoriteIds(db, user.id)
  const recentViewIds = db.recentViews
    .filter((item) => item.userId === user.id)
    .sort((left, right) => new Date(right.viewedAt).getTime() - new Date(left.viewedAt).getTime())
    .map((item) => item.productId)
  const publishedProducts = getPublishedProducts(db, user.id)
  const profile = buildProfile(db, user)

  return {
    profile,
    profileInitial: profile.nickname.slice(0, 1),
    stats: {
      publishedCount: publishedProducts.length,
      soldCount: profile.soldCount,
      favoriteCount: favoriteIds.length,
      dealCount: profile.dealCount,
    },
    orderShortcuts: db.dictionaries.orderShortcuts,
    menuItems: db.dictionaries.profileMenuItems,
    policyHighlights: db.dictionaries.policyHighlights,
    favoriteProducts: getProductsByIds(db, favoriteIds).slice(0, 4).map((item) => createProductCard(item, favoriteIds)),
    recentViews: getProductsByIds(db, recentViewIds.slice(0, 8)).map((item) => createProductCard(item, favoriteIds)),
    latestPublished: publishedProducts.slice(0, 2).map((item) => createProductCard(item, favoriteIds)),
  }
}

async function getOrderSummary(headers) {
  const { db, user } = await requireAuthenticatedUser(headers)
  const orders = getUserOrders(user)
  return {
    totalCount: orders.length,
    statuses: buildOrderStatusSummary(db, orders),
  }
}

async function getOrders(headers, query = {}) {
  const { db, user } = await requireAuthenticatedUser(headers)
  const activeStatus = validateOrderStatus(query.status)
  const favoriteIds = getFavoriteIds(db, user.id)
  const orders = getUserOrders(user)
  const filtered = activeStatus === 'all'
    ? orders
    : orders.filter((item) => item.status === activeStatus)

  return {
    activeStatus,
    statuses: buildOrderStatusSummary(db, orders),
    list: filtered
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map((item) => buildOrderItem(db, user, item, favoriteIds)),
  }
}

async function getWallet(headers) {
  const { user } = await requireAuthenticatedUser(headers)
  return getUserWallet(user)
}

async function getAddresses(headers) {
  const { user } = await requireAuthenticatedUser(headers)
  const list = getUserAddresses(user)
  const defaultAddress = list.find((item) => item.isDefault)
  return {
    list,
    defaultId: defaultAddress ? defaultAddress.id : '',
  }
}

async function getMyReviews(headers) {
  const { db, user } = await requireAuthenticatedUser(headers)
  const list = getUserReviews(user).map((item) => {
    const product = getStoredProductById(db, item.productId) || getProductById(db, item.productId)
    return {
      ...item,
      createdAtLabel: formatDateLabel(item.createdAt),
      product: product ? {
        id: product.id,
        title: product.title,
        idolDisplayName: product.idolDisplayName || product.idol,
        category: product.category,
      } : null,
    }
  })

  return {
    stats: buildReviewStats(list),
    list,
  }
}

async function clearProfileRecentViews(headers) {
  const { db, user, openid } = await requireAuthenticatedUser(headers)

  if (readBackendConfig().dataProvider === 'cloudbase') {
    await clearCloudRecentViews(user.id)
    db.recentViews = db.recentViews.filter((item) => item.userId !== user.id)
  } else {
    const nextDb = await withDb((current) => {
      const currentUser = ensureUser(current, openid)
      current.recentViews = current.recentViews.filter((item) => item.userId !== currentUser.id)
      return current
    })
    db.recentViews = nextDb.recentViews
  }

  return {
    success: true,
    summary: buildGlobalSummary(db, user),
  }
}

async function getNavigationSummary(headers) {
  const { db, user } = await requireAuthenticatedUser(headers)
  return buildGlobalSummary(db, user)
}

async function resetThreadStore() {
  const db = await resetDb()
  const user = ensureUser(db, DEMO_OPENID)
  return {
    success: true,
    summary: buildGlobalSummary(db, user),
  }
}

function saveUploadedFile(file) {
  ensureUploadsDir()
  const extension = path.extname(file.filename || '') || '.jpg'
  const basename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`
  const target = path.join(UPLOADS_DIR, basename)
  fs.writeFileSync(target, file.buffer)
  return basename
}

async function registerUpload(headers, file, host) {
  const { openid } = await requireAuthenticatedUser(headers)
  const db = await withDb((current) => {
    const user = ensureUser(current, openid)
    const filename = saveUploadedFile(file)
    const url = `${host}/uploads/${filename}`
    current.uploads.unshift({
      id: createId('upload'),
      userId: user.id,
      filename,
      originalName: file.filename,
      mimeType: file.contentType,
      url,
      createdAt: getNowIso(),
    })
    return current
  })
  const upload = db.uploads[0]
  return {
    url: upload.url,
  }
}

module.exports = {
  UPLOADS_DIR,
  getAddresses,
  bootstrapApp,
  clearProfileRecentViews,
  deleteProduct,
  getChatDetail,
  getCurrentUserFromHeaders,
  getHomeData,
  getMessagesPage,
  getNavigationSummary,
  getOrders,
  getOrderSummary,
  getProductDetail,
  getProfilePage,
  getPublishMeta,
  getMyReviews,
  getWallet,
  loginWithWeChat,
  markMessageAsRead,
  registerUpload,
  resetThreadStore,
  sendChatMessage,
  submitProduct,
  updateProduct,
  updateProductStatus,
  toggleProductFavorite,
}
