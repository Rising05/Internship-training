const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { normalizeIdolPayload } = require('../../utils/idol')
const { DEMO_OPENID } = require('./seed')
const { readDb, withDb, resetDb } = require('./database')

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads')
const DEFAULT_PAGE_SIZE = 6

function ensureUploadsDir() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

function createId(prefix) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 8)}`
}

function getNowIso() {
  return new Date().toISOString()
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
      targetUrl: '/package-sub/detail/detail?id=xc001',
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

function getUserByOpenid(db, openid = DEMO_OPENID) {
  return db.users.find((item) => item.openid === openid) || db.users[0]
}

function ensureUser(db, openid = DEMO_OPENID) {
  const existing = getUserByOpenid(db, openid)
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

function getReadIds(db, userId, type) {
  return db.messageReads
    .filter((item) => item.userId === userId && item.type === type)
    .map((item) => item.targetId)
}

function getActiveProducts(db) {
  return db.products.filter((item) => item.status !== 'hidden')
}

function getProductById(db, id) {
  return getActiveProducts(db).find((item) => item.id === id) || null
}

function createProductCard(product, favoriteIds) {
  return {
    ...product,
    isFavorite: favoriteIds.includes(product.id),
    seller: {
      avatarText: '星',
      ...(product.seller || {}),
    },
  }
}

function sortProductsByCreatedAt(list) {
  return list.slice().sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function getConversationLastMessage(db, conversationId) {
  return db.messages
    .filter((item) => item.conversationId === conversationId)
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order
      }
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    })
    .slice(-1)[0] || null
}

function buildConversationList(db, user) {
  const favoriteIds = getFavoriteIds(db, user.id)
  const readIds = getReadIds(db, user.id, 'conversation')

  return db.conversations.map((conversation) => {
    const lastMessage = getConversationLastMessage(db, conversation.id)
    const relatedProduct = getProductById(db, conversation.relatedProductId)
    const previewText = lastMessage
      ? (lastMessage.type === 'product' ? '发来了一张商品卡片' : lastMessage.content)
      : conversation.seedPreview

    return {
      id: conversation.id,
      name: conversation.user.name,
      initial: conversation.user.avatarText || conversation.user.name.slice(0, 1),
      content: previewText,
      time: lastMessage ? (lastMessage.time || '刚刚') : conversation.seedTime,
      unread: readIds.includes(conversation.id) ? 0 : conversation.seedUnread,
      relatedProductId: conversation.relatedProductId,
      avatarText: conversation.user.avatarText || conversation.user.name.slice(0, 1),
      isFavoriteProduct: relatedProduct ? favoriteIds.includes(relatedProduct.id) : false,
    }
  })
}

function buildGlobalSummary(db, user) {
  const favoriteIds = getFavoriteIds(db, user.id)
  const recentViews = db.recentViews.filter((item) => item.userId === user.id)
  const unreadConversationCount = buildConversationList(db, user).filter((item) => item.unread).length

  return {
    favoriteCount: favoriteIds.length,
    recentCount: recentViews.length,
    unreadConversationCount,
    publishedCount: getPublishedProducts(db, user.id).length,
  }
}

function buildProfile(db, user) {
  return {
    id: user.id,
    nickname: user.nickname,
    bio: user.bio,
    location: user.location,
    publishedCount: getPublishedProducts(db, user.id).length,
    soldCount: user.soldCount,
    favoriteCount: user.favoriteCount,
    dealCount: user.dealCount,
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
    const matchKeyword = !normalizedKeyword
      || item.title.toLowerCase().includes(normalizedKeyword)
      || item.idolDisplayName.toLowerCase().includes(normalizedKeyword)
      || item.idolGroup.toLowerCase().includes(normalizedKeyword)
      || item.idolMember.toLowerCase().includes(normalizedKeyword)
      || item.category.toLowerCase().includes(normalizedKeyword)
    const matchIdol = idolTypeTab === 'group'
      ? (
        (activeGroup === '全部' || item.idolGroup.toLowerCase().includes(normalizedGroup))
        && (activeMember === '全部' || item.idolMember.toLowerCase().includes(normalizedMember))
      )
      : (activeSolo === '全部' || (
        item.idolType === 'solo'
        && item.idolDisplayName.toLowerCase().includes(normalizedSolo)
      ))
    const matchCategory = activeCategory === '全部' || [
      item.category,
      item.title,
      item.note,
      ...(item.tags || []),
    ].join(' ').toLowerCase().includes(normalizedCategory)
    const matchFeed = activeFeed === 'hot' ? item.isHot : item.isLatest
    return matchKeyword && matchIdol && matchCategory && matchFeed
  })
}

function getCurrentUserFromHeaders(headers) {
  return headers['x-openid'] || headers['X-Openid'] || DEMO_OPENID
}

function loginWithWeChat(body = {}) {
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const fallbackOpenid = code
    ? `demo-${crypto.createHash('md5').update(code).digest('hex').slice(0, 8)}`
    : DEMO_OPENID

  const db = withDb((current) => {
    ensureUser(current, DEMO_OPENID)
    return current
  })
  const user = getUserByOpenid(db, DEMO_OPENID)

  return {
    loggedIn: true,
    openid: user.openid || fallbackOpenid,
    nickname: user.nickname,
  }
}

function bootstrapApp(headers) {
  const db = readDb()
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))
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

function getHomeData(headers, params = {}) {
  const db = readDb()
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))
  const favoriteIds = getFavoriteIds(db, user.id)
  const pageIndex = Number(params.pageIndex || 1)
  const pageSize = Number(params.pageSize || DEFAULT_PAGE_SIZE)
  const filtered = filterProducts(db, params)
  const sliced = filtered.slice(0, pageIndex * pageSize).map((item) => createProductCard(item, favoriteIds))

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
    hasMore: sliced.length < filtered.length,
    items: sliced,
  }
}

function getProductDetail(headers, id) {
  const db = withDb((current) => {
    const user = getUserByOpenid(current, getCurrentUserFromHeaders(headers))
    const product = getProductById(current, id)
    if (product) {
      addRecentView(current, user, product.id)
    }
    return current
  })
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))
  const product = getProductById(db, id)
  if (!product) {
    return null
  }

  const publishedCount = product.ownerUserId
    ? getPublishedProducts(db, product.ownerUserId).length
    : 12

  return {
    ...createProductCard(product, getFavoriteIds(db, user.id)),
    seller: {
      ...product.seller,
      publishedCount,
      responseRate: '95%',
    },
    policies: [
      '支持私聊沟通细节与补图',
      '正式购买流程将在后端接入后开放',
      '请在确认品相与价格后再发起交易',
    ],
  }
}

function toggleProductFavorite(headers, id) {
  const db = withDb((current) => {
    const user = getUserByOpenid(current, getCurrentUserFromHeaders(headers))
    const existing = current.favorites.find((item) => item.userId === user.id && item.productId === id)
    if (existing) {
      current.favorites = current.favorites.filter((item) => !(item.userId === user.id && item.productId === id))
    } else {
      current.favorites.unshift({
        userId: user.id,
        productId: id,
        createdAt: getNowIso(),
      })
    }
    return current
  })
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))
  const favoriteIds = getFavoriteIds(db, user.id)

  return {
    favoriteIds,
    isFavorite: favoriteIds.includes(id),
    summary: buildGlobalSummary(db, user),
  }
}

function getPublishMeta(headers) {
  const db = readDb()
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))
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

function submitProduct(headers, payload = {}) {
  const db = withDb((current) => {
    const user = getUserByOpenid(current, getCurrentUserFromHeaders(headers))
    const tradeType = payload.tradeType || '出物'
    const nextProduct = normalizeIdolPayload({
      id: createId('ugc'),
      title: String(payload.title || '').trim(),
      category: payload.category,
      price: Number(payload.price),
      quantity: Number(payload.quantity) || 1,
      images: Array.isArray(payload.images) ? payload.images.slice(0, 9) : [],
      condition: payload.condition,
      tradeType,
      shippingFee: Number(payload.shippingFee || 0),
      tags: [payload.category, tradeType].filter(Boolean),
      note: String(payload.note || '').trim(),
      idolType: payload.idolType,
      idolGroup: payload.idolGroup,
      idolMember: payload.idolMember,
      idolDisplayName: payload.idolDisplayName,
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

    current.products.unshift(nextProduct)
    const targetUser = current.users.find((item) => item.id === user.id)
    if (targetUser) {
      targetUser.publishedCount = getPublishedProducts(current, user.id).length
      targetUser.updatedAt = getNowIso()
    }

    return current
  })
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))

  return {
    success: true,
    product: getPublishedProducts(db, user.id)[0],
    summary: buildGlobalSummary(db, user),
  }
}

function getMessagesPage(headers, activeTab = 'conversation') {
  const db = readDb()
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))
  const tradeReadIds = getReadIds(db, user.id, 'trade')
  const systemReadIds = getReadIds(db, user.id, 'system')

  const listMap = {
    conversation: buildConversationList(db, user),
    trade: db.tradeNotifications.map((item) => ({
      ...item,
      avatarText: item.type.slice(0, 1),
      unread: tradeReadIds.includes(item.id) ? 0 : item.unread,
    })),
    system: db.systemNotifications.map((item) => ({
      ...item,
      avatarText: item.type.slice(0, 1),
      unread: systemReadIds.includes(item.id) ? 0 : item.unread,
    })),
  }

  return {
    tabs: db.dictionaries.messageTabs,
    activeTab,
    list: listMap[activeTab] || listMap.conversation,
    summary: buildGlobalSummary(db, user),
  }
}

function markMessageAsRead(headers, body = {}) {
  const type = body.type
  const id = body.id
  const db = withDb((current) => {
    const user = getUserByOpenid(current, getCurrentUserFromHeaders(headers))
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
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))

  return {
    success: true,
    summary: buildGlobalSummary(db, user),
  }
}

function getChatDetail(headers, conversationId) {
  const db = withDb((current) => {
    const user = getUserByOpenid(current, getCurrentUserFromHeaders(headers))
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
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))
  const conversation = db.conversations.find((item) => item.id === conversationId)
  if (!conversation) {
    return null
  }

  const relatedProduct = getProductById(db, conversation.relatedProductId)
  const messages = db.messages
    .filter((item) => item.conversationId === conversationId)
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order
      }
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    })
    .map((item) => ({
      id: item.id,
      type: item.type,
      from: item.from,
      content: item.content,
      time: item.time || '刚刚',
      product: item.productId ? createProductCard(getProductById(db, item.productId), getFavoriteIds(db, user.id)) : null,
    }))

  return {
    id: conversation.id,
    title: conversation.user.name,
    subtitle: conversation.user.subtitle,
    user: conversation.user,
    relatedProduct: relatedProduct ? createProductCard(relatedProduct, getFavoriteIds(db, user.id)) : null,
    messages,
  }
}

function sendChatMessage(headers, conversationId, body = {}) {
  const safeContent = String(body.content || '').trim()
  if (!safeContent) {
    return {
      success: false,
      thread: getChatDetail(headers, conversationId),
      summary: buildGlobalSummary(readDb(), getUserByOpenid(readDb(), getCurrentUserFromHeaders(headers))),
    }
  }

  const db = withDb((current) => {
    const conversation = current.conversations.find((item) => item.id === conversationId)
    if (!conversation) {
      return current
    }
    const order = current.messages.filter((item) => item.conversationId === conversationId).length
    current.messages.push({
      id: createId('msg'),
      conversationId,
      type: 'text',
      from: 'self',
      content: safeContent,
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
    thread: getChatDetail(headers, conversationId),
    summary: buildGlobalSummary(db, user),
  }
}

function getProfilePage(headers) {
  const db = readDb()
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))
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
    recentViews: getProductsByIds(db, recentViewIds).map((item) => createProductCard(item, favoriteIds)),
    latestPublished: publishedProducts.slice(0, 2).map((item) => createProductCard(item, favoriteIds)),
  }
}

function clearProfileRecentViews(headers) {
  const db = withDb((current) => {
    const user = getUserByOpenid(current, getCurrentUserFromHeaders(headers))
    current.recentViews = current.recentViews.filter((item) => item.userId !== user.id)
    return current
  })
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))

  return {
    success: true,
    summary: buildGlobalSummary(db, user),
  }
}

function getNavigationSummary(headers) {
  const db = readDb()
  const user = getUserByOpenid(db, getCurrentUserFromHeaders(headers))
  return buildGlobalSummary(db, user)
}

function resetThreadStore() {
  const db = resetDb()
  const user = getUserByOpenid(db, DEMO_OPENID)
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

function registerUpload(headers, file, host) {
  const db = withDb((current) => {
    const user = getUserByOpenid(current, getCurrentUserFromHeaders(headers))
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
  bootstrapApp,
  clearProfileRecentViews,
  getChatDetail,
  getCurrentUserFromHeaders,
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
}
