const {
  idolDirectory,
  memberDirectory,
  idolOptions,
  categoryOptions,
  conditionOptions,
  tradeTypeOptions,
  homeQuickEntries,
  feedModes,
  searchSuggestions,
  messageTabs,
  orderShortcuts,
  orderStatuses,
  profileMenuItems,
  policyHighlights,
  orderRecords,
  walletSnapshot,
  addressBook,
  reviewRecords,
  products,
  conversationMessages,
  tradeNotifications,
  systemMessages,
  chatThreads,
  getBaseProductById,
  getBaseConversationById,
} = require('../../utils/mock')
const { normalizeIdolPayload } = require('../../utils/idol')
const {
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
  getMessageState,
  markMessageRead,
  getPublishedProducts,
  addPublishedProduct,
  getChatThreads,
  setChatThreads,
  appendChatMessage,
} = require('../../utils/storage')

const PRODUCT_CARD_PREVIEW = '发来了一张商品卡片'
const PRODUCT_STATUS_META = {
  active: { label: '在售', tone: 'active', description: '商品正在展示中，可继续沟通与成交。', canPurchase: true },
  reserved: { label: '已预留', tone: 'reserved', description: '商品已被预留，仍可进入聊天查看进度。', canPurchase: false },
  sold: { label: '已售出', tone: 'sold', description: '商品已完成成交，仅保留记录与会话。', canPurchase: false },
  hidden: { label: '已下架', tone: 'hidden', description: '商品已从首页隐藏，仅发布者可查看。', canPurchase: false },
}

function simulate(data, options = {}) {
  const delay = typeof options.delay === 'number' ? options.delay : 80
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay)
  })
}

function buildHomeBanners() {
  return [
    {
      id: 'banner-home-01',
      title: '星仓开站引导',
      subtitle: '发布你的第一条交易信息',
      image: '/static/image/cropped/home-hero-cover.jpg',
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
      image: '/static/image/cropped/home-hero-cover.jpg',
      targetType: 'navigate',
      targetUrl: '/pages/detail/detail?id=xc001',
      ctaText: '查看专题',
      enabled: true,
      sort: 20,
      startAt: '2026-01-01T00:00:00+08:00',
      endAt: '2027-01-01T00:00:00+08:00',
      analyticsName: 'home_campaign_banner',
      imagePosition: '68% center',
    },
    {
      id: 'banner-home-03',
      title: '消息触达预留',
      subtitle: '也可以接公告、福利和广告跳转',
      image: '/static/image/cropped/home-hero-cover.jpg',
      targetType: 'switchTab',
      targetUrl: '/pages/messages/messages',
      ctaText: '查看消息',
      enabled: true,
      sort: 30,
      startAt: '2026-01-01T00:00:00+08:00',
      endAt: '2027-01-01T00:00:00+08:00',
      analyticsName: 'home_message_banner',
      imagePosition: '32% center',
    },
  ]
}

function createId(prefix) {
  return `${prefix}${Date.now()}`
}

function getAllProducts() {
  return [...getPublishedProducts(), ...products]
}

function getVisibleProducts() {
  return getAllProducts().filter((item) => item.status !== 'hidden')
}

function getProductById(id) {
  return getAllProducts().find((item) => item.id === id) || null
}

function getProductStatusMeta(status) {
  return PRODUCT_STATUS_META[status] || PRODUCT_STATUS_META.active
}

function syncProfileProductStats(nextPublishedProducts = getPublishedProducts()) {
  const profile = getProfile()
  const visiblePublishedCount = nextPublishedProducts.filter((item) => item.status !== 'hidden').length
  const soldCount = nextPublishedProducts.filter((item) => item.status === 'sold').length
  setProfile({
    ...profile,
    publishedCount: visiblePublishedCount,
    soldCount,
  })
}

function getProductsByIds(ids = []) {
  return ids.map((id) => getProductById(id)).filter(Boolean)
}

function getMergedThreads() {
  const storedThreads = getChatThreads()
  const merged = { ...chatThreads }

  Object.keys(storedThreads).forEach((key) => {
    const current = merged[key] || {}
    merged[key] = {
      ...current,
      ...storedThreads[key],
      user: {
        ...(current.user || {}),
        ...((storedThreads[key] && storedThreads[key].user) || {}),
      },
      messages: [...((current.messages || [])), ...((storedThreads[key] && storedThreads[key].messages) || [])],
    }
  })

  return merged
}

function getThreadLastMessage(thread) {
  return thread && Array.isArray(thread.messages) && thread.messages.length
    ? thread.messages[thread.messages.length - 1]
    : null
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

function buildNotificationList(items = [], type) {
  const readIds = getMessageState()[`${type}ReadIds`] || []

  return items.map((item) => ({
    ...item,
    avatarText: item.type.slice(0, 1),
    unread: readIds.includes(item.id) ? 0 : item.unread,
  }))
}

function createProductCard(product, favorites) {
  const statusMeta = getProductStatusMeta(product.status)
  return {
    ...product,
    isFavorite: favorites.includes(product.id),
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    canPurchase: statusMeta.canPurchase,
    seller: {
      avatarText: '星',
      ...product.seller,
    },
  }
}

function sortProductsByCreatedAt(list) {
  return list.slice().sort((prev, next) => new Date(next.createdAt).getTime() - new Date(prev.createdAt).getTime())
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

function getMockOrders() {
  const profile = getProfile()
  return orderRecords.map((item) => ({
    ...item,
    buyerUserId: item.buyerUserId || profile.id,
    buyerName: profile.nickname,
  }))
}

function buildOrderStatuses(list = getMockOrders()) {
  return orderStatuses.map((item) => ({
    ...item,
    count: item.key === 'all'
      ? list.length
      : list.filter((order) => order.status === item.key).length,
  }))
}

function buildOrderItem(order) {
  const product = getProductById(order.productId) || getBaseProductById(order.productId)
  const favoriteIds = getFavorites()
  const productCard = product ? createProductCard(product, favoriteIds) : null
  const statusMeta = orderStatuses.find((item) => item.key === order.status)
  const profile = getProfile()

  return {
    id: order.id,
    status: order.status,
    statusLabel: statusMeta ? statusMeta.label : order.status,
    price: Number(order.price) || 0,
    createdAt: order.createdAt,
    createdAtLabel: formatDateLabel(order.createdAt),
    actionLabel: getOrderActionLabel(order.status),
    seller: {
      id: order.sellerId || '',
      name: order.sellerName || '',
      city: order.sellerCity || '',
    },
    buyer: {
      id: order.buyerUserId || profile.id,
      name: order.buyerName || profile.nickname,
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

function buildReviewStats(list = []) {
  if (!list.length) {
    return {
      averageScore: 0,
      totalCount: 0,
      positiveRate: '0%',
    }
  }

  const scoreTotal = list.reduce((result, item) => result + (Number(item.score) || 0), 0)
  const positiveCount = list.filter((item) => Number(item.score) >= 4).length
  return {
    averageScore: Number((scoreTotal / list.length).toFixed(1)),
    totalCount: list.length,
    positiveRate: `${Math.round((positiveCount / list.length) * 100)}%`,
  }
}

function getGlobalSummarySync() {
  const favorites = getFavorites()
  const recentViews = getRecentViews()
  const profile = getProfile()
  const conversationList = getConversationListSync()
  const tradeList = buildNotificationList(tradeNotifications, 'trade')
  const systemList = buildNotificationList(systemMessages, 'system')
  const unreadConversationCount = sumUnreadCount(conversationList)
  const unreadTradeCount = sumUnreadCount(tradeList)
  const unreadSystemCount = sumUnreadCount(systemList)

  return {
    favoriteCount: favorites.length,
    recentCount: recentViews.length,
    unreadCount: unreadConversationCount + unreadTradeCount + unreadSystemCount,
    unreadConversationCount,
    unreadDetail: {
      conversation: unreadConversationCount,
      trade: unreadTradeCount,
      system: unreadSystemCount,
    },
    publishedCount: profile.publishedCount,
  }
}

function getConversationListSync() {
  const messageState = getMessageState()
  const favorites = getFavorites()
  const threads = getMergedThreads()
  const conversationOrder = conversationMessages.reduce((result, item, index) => {
    result[item.id] = index
    return result
  }, {})

  return conversationMessages.slice().sort((left, right) => {
    const leftThread = threads[left.id]
    const rightThread = threads[right.id]
    const leftTimestamp = Date.parse((leftThread && leftThread.updatedAt) || '')
    const rightTimestamp = Date.parse((rightThread && rightThread.updatedAt) || '')
    const leftHasTimestamp = Number.isFinite(leftTimestamp)
    const rightHasTimestamp = Number.isFinite(rightTimestamp)

    if (leftHasTimestamp && rightHasTimestamp && leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp
    }

    if (leftHasTimestamp !== rightHasTimestamp) {
      return leftHasTimestamp ? -1 : 1
    }

    return conversationOrder[left.id] - conversationOrder[right.id]
  }).map((item) => {
    const thread = threads[item.id]
    const lastMessage = getThreadLastMessage(thread)
    const relatedProduct = getProductById(item.relatedProductId)

    return {
      ...item,
      content: getMessagePreviewText(lastMessage, item.content),
      time: lastMessage ? (lastMessage.time || '刚刚') : item.time,
      unread: messageState.conversationReadIds.includes(item.id) ? 0 : item.unread,
      avatarText: item.initial || item.name.slice(0, 1),
      isFavoriteProduct: relatedProduct ? favorites.includes(relatedProduct.id) : false,
    }
  })
}

function bootstrapApp() {
  ensureStorageDefaults()
  return simulate({
    authSession: getAuthSession(),
    profile: getProfile(),
    summary: getGlobalSummarySync(),
  }, { delay: 20 })
}

function ensureSession() {
  ensureStorageDefaults()
  const current = getAuthSession()
  if (current.loggedIn && current.openid) {
    return simulate(current, { delay: 20 })
  }

  const profile = getProfile()
  return simulate(setAuthSession({
    loggedIn: true,
    nickname: profile.nickname,
    openid: 'mock-openid',
  }), { delay: 20 })
}

function getHomeData(params = {}) {
  const {
    keyword = '',
    idolTypeTab = 'group',
    activeGroup = '全部',
    activeMember = '全部',
    activeSolo = '全部',
    activeCategory = '全部',
    activeFeed = 'latest',
    pageIndex = 1,
    pageSize = 6,
  } = params
  const favorites = getFavorites()
  const normalizedKeyword = keyword.trim().toLowerCase()
  const normalizedGroup = activeGroup.trim().toLowerCase()
  const normalizedMember = activeMember.trim().toLowerCase()
  const normalizedSolo = activeSolo.trim().toLowerCase()
  const normalizedCategory = activeCategory.trim().toLowerCase()

  let filtered = sortProductsByCreatedAt(getVisibleProducts()).filter((item) => {
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

  const totalCount = getVisibleProducts().length
  const matchedCount = filtered.length
  const startIndex = (pageIndex - 1) * pageSize
  const endIndex = startIndex + pageSize
  const sliced = filtered.slice(startIndex, endIndex).map((item) => createProductCard(item, favorites))

  return simulate({
    banners: buildHomeBanners(),
    quickEntries: homeQuickEntries,
    searchSuggestions,
    idolOptions,
    idolDirectory,
    memberDirectory,
    categoryOptions,
    feedModes,
    totalCount,
    matchedCount,
    hasMore: endIndex < matchedCount,
    items: sliced,
  })
}

function getProductDetail(id) {
  const product = getProductById(id)
  if (!product) {
    return simulate(null)
  }

  addRecentView(product)

  const favorites = getFavorites()
  const statusMeta = getProductStatusMeta(product.status)

  return simulate({
    ...createProductCard(product, favorites),
    seller: {
      ...product.seller,
      publishedCount: 12,
      responseRate: '95%',
    },
    isOwner: product.ownerUserId === getProfile().id,
    statusDescription: statusMeta.description,
    relatedProducts: sortProductsByCreatedAt(getVisibleProducts())
      .filter((item) => item.id !== product.id)
      .filter((item) => item.category === product.category || item.idolDisplayName === product.idolDisplayName)
      .slice(0, 4)
      .map((item) => createProductCard(item, favorites)),
    policies: [
      '支持私聊沟通细节与补图',
      '支持商品状态管理、上下架与已售标记',
      '请在确认品相与价格后再发起交易',
    ],
  })
}

function toggleProductFavorite(id) {
  const favorites = toggleFavorite(id)
  return simulate({
    favoriteIds: favorites,
    isFavorite: favorites.includes(id),
    summary: getGlobalSummarySync(),
  }, { delay: 40 })
}

function getPublishPageData() {
  const profile = getProfile()
  const publishCategoryOptions = categoryOptions.slice(1)
  return simulate({
    idolOptions: idolOptions.slice(1),
    idolDirectory,
    memberDirectory,
    categoryOptions: publishCategoryOptions,
    categorySections: {
      common: publishCategoryOptions.slice(0, 5),
      extra: publishCategoryOptions.slice(5),
    },
    conditionOptions,
    tradeTypeOptions,
    seller: {
      nickname: profile.nickname,
      location: profile.location,
    },
    tips: [
      '发布前建议补充清晰封面、价格、数量和成色信息。',
      '当前已按正式版结构预留图片上传与审核字段。',
      '后续接后端后可直接切换真实发布接口。',
    ],
  })
}

function submitProduct(payload) {
  const profile = getProfile()
  const tradeType = payload.tradeType || '出物'
  const nextProduct = normalizeIdolPayload({
    id: createId('ugc'),
    title: payload.title.trim(),
    category: payload.category,
    price: Number(payload.price),
    quantity: Number(payload.quantity) || 1,
    images: payload.images.slice(0, 9),
    condition: payload.condition,
    tradeType,
    shippingFee: Number(payload.shippingFee || 0),
    tags: [payload.category, tradeType].filter(Boolean),
    note: payload.note.trim(),
    idolType: payload.idolType,
    idolGroup: payload.idolGroup,
    idolMember: payload.idolMember,
    idolDisplayName: payload.idolDisplayName,
    seller: {
      id: profile.id,
      name: profile.nickname,
      city: profile.location,
      level: '新发布',
      intro: profile.bio,
      avatarText: profile.nickname.slice(0, 1),
    },
    isHot: false,
    isLatest: true,
    conversationId: 'conv001',
    ownerUserId: profile.id,
    status: 'active',
    createdAt: new Date().toISOString(),
  })

  addPublishedProduct(nextProduct)
  syncProfileProductStats(getPublishedProducts())

  return simulate({
    success: true,
    product: nextProduct,
    summary: getGlobalSummarySync(),
  }, { delay: 180 })
}

function updateProduct(id, payload = {}) {
  const target = getPublishedProducts().find((item) => item.id === id)
  if (!target) {
    return simulate(null)
  }

  Object.assign(target, normalizeIdolPayload({
    ...target,
    ...payload,
  }))
  syncProfileProductStats(getPublishedProducts())

  return simulate({
    success: true,
    product: createProductCard(target, getFavorites()),
    summary: getGlobalSummarySync(),
  }, { delay: 80 })
}

function updateProductStatus(id, status) {
  const target = getPublishedProducts().find((item) => item.id === id)
  if (!target) {
    return simulate(null)
  }

  target.status = status
  syncProfileProductStats(getPublishedProducts())
  return simulate({
    success: true,
    product: createProductCard(target, getFavorites()),
    summary: getGlobalSummarySync(),
  }, { delay: 60 })
}

function deleteProduct(id) {
  const nextPublished = getPublishedProducts().filter((item) => item.id !== id)
  wx.setStorageSync(STORAGE_KEYS.publishedProducts, nextPublished)
  wx.setStorageSync(STORAGE_KEYS.favorites, getFavorites().filter((item) => item !== id))
  wx.setStorageSync(STORAGE_KEYS.recentViews, getRecentViews().filter((item) => item.id !== id))
  syncProfileProductStats(nextPublished)
  return simulate({
    success: true,
    deletedProductId: id,
    summary: getGlobalSummarySync(),
  }, { delay: 80 })
}

function getMessagesPageData(activeTab = 'conversation') {
  const sourceMap = {
    conversation: getConversationListSync(),
    trade: buildNotificationList(tradeNotifications, 'trade'),
    system: buildNotificationList(systemMessages, 'system'),
  }

  return simulate({
    tabs: messageTabs,
    activeTab,
    list: sourceMap[activeTab] || sourceMap.conversation,
    summary: getGlobalSummarySync(),
  })
}

function markMessageAsRead(type, id) {
  markMessageRead(type, id)
  return simulate({
    success: true,
    summary: getGlobalSummarySync(),
  }, { delay: 30 })
}

function getChatDetail(conversationId) {
  const thread = getMergedThreads()[conversationId]
  const baseConversation = getBaseConversationById(conversationId)

  if (!thread || !baseConversation) {
    return simulate(null)
  }

  markMessageRead('conversation', conversationId)
  const relatedProduct = getProductById(thread.relatedProductId) || getBaseProductById(thread.relatedProductId)

  return simulate({
    id: thread.id,
    title: thread.user.name,
    subtitle: thread.user.subtitle,
    user: thread.user,
    relatedProduct: relatedProduct ? createProductCard(relatedProduct, getFavorites()) : null,
    messages: thread.messages.map((item) => ({
      ...item,
      product: item.productId ? createProductCard(getProductById(item.productId) || getBaseProductById(item.productId), getFavorites()) : null,
    })),
    summary: getGlobalSummarySync(),
  })
}

function sendChatMessage(conversationId, content) {
  const safeContent = content.trim()
  if (!safeContent) {
    return simulate({ success: false })
  }

  appendChatMessage(conversationId, {
    id: createId('msg'),
    type: 'text',
    from: 'self',
    content: safeContent,
    time: '刚刚',
  })

  return getChatDetail(conversationId).then((data) => ({
    success: true,
    thread: data ? {
      id: data.id,
      title: data.title,
      subtitle: data.subtitle,
      user: data.user,
      relatedProduct: data.relatedProduct,
      messages: data.messages,
    } : null,
    summary: getGlobalSummarySync(),
  }))
}

function getOrders(status = 'all') {
  const orders = getMockOrders()
  const normalizedStatus = String(status || 'all').trim() || 'all'
  const filtered = normalizedStatus === 'all'
    ? orders
    : orders.filter((item) => item.status === normalizedStatus)

  return simulate({
    activeStatus: normalizedStatus,
    statuses: buildOrderStatuses(orders),
    list: filtered.map((item) => buildOrderItem(item)),
  }, { delay: 60 })
}

function getOrderSummary() {
  const orders = getMockOrders()
  return simulate({
    totalCount: orders.length,
    statuses: buildOrderStatuses(orders),
  }, { delay: 30 })
}

function getWalletData() {
  return simulate({
    ...walletSnapshot,
    bills: walletSnapshot.bills.map((item) => ({ ...item })),
    tips: walletSnapshot.tips.slice(),
  }, { delay: 40 })
}

function getAddressList() {
  const list = addressBook.map((item) => ({ ...item }))
  const defaultAddress = list.find((item) => item.isDefault)
  return simulate({
    list,
    defaultId: defaultAddress ? defaultAddress.id : '',
  }, { delay: 40 })
}

function getMyReviews() {
  const list = reviewRecords.map((item) => {
    const product = getProductById(item.productId) || getBaseProductById(item.productId)
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

  return simulate({
    stats: buildReviewStats(list),
    list,
  }, { delay: 40 })
}

function getProfilePageData() {
  const profile = getProfile()
  const favoriteIds = getFavorites()
  const recentViews = getRecentViews()
  const publishedProducts = getPublishedProducts()

  return simulate({
    profile,
    profileInitial: profile.nickname.slice(0, 1),
    stats: {
      publishedCount: profile.publishedCount,
      soldCount: profile.soldCount,
      favoriteCount: favoriteIds.length,
      dealCount: profile.dealCount,
    },
    orderShortcuts,
    menuItems: profileMenuItems,
    policyHighlights,
    favoriteProducts: getProductsByIds(favoriteIds).slice(0, 4).map((item) => createProductCard(item, favoriteIds)),
    recentViews: recentViews.map((item) => createProductCard(item, favoriteIds)),
    latestPublished: publishedProducts.slice(0, 2).map((item) => createProductCard(item, favoriteIds)),
  })
}

function clearProfileRecentViews() {
  clearRecentViews()
  return simulate({
    success: true,
    summary: getGlobalSummarySync(),
  }, { delay: 40 })
}

function getNavigationSummary() {
  return simulate(getGlobalSummarySync(), { delay: 20 })
}

function resetThreadStore() {
  setChatThreads({})
  return simulate({ success: true }, { delay: 20 })
}

module.exports = {
  ensureSession,
  bootstrapApp,
  getHomeData,
  getProductDetail,
  updateProduct,
  updateProductStatus,
  deleteProduct,
  toggleProductFavorite,
  getPublishPageData,
  submitProduct,
  getMessagesPageData,
  markMessageAsRead,
  getChatDetail,
  sendChatMessage,
  getProfilePageData,
  getOrders,
  getOrderSummary,
  getWalletData,
  getAddressList,
  getMyReviews,
  clearProfileRecentViews,
  getNavigationSummary,
  resetThreadStore,
}
