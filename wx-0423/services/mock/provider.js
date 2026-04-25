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
  profileMenuItems,
  policyHighlights,
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
      targetUrl: '/package-sub/detail/detail?id=xc001',
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

function getProductById(id) {
  return getAllProducts().find((item) => item.id === id) || null
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

function createProductCard(product, favorites) {
  return {
    ...product,
    isFavorite: favorites.includes(product.id),
    seller: {
      avatarText: '星',
      ...product.seller,
    },
  }
}

function sortProductsByCreatedAt(list) {
  return list.slice().sort((prev, next) => new Date(next.createdAt).getTime() - new Date(prev.createdAt).getTime())
}

function getGlobalSummarySync() {
  const favorites = getFavorites()
  const recentViews = getRecentViews()
  const profile = getProfile()
  const messageState = getMessageState()
  const unreadConversationCount = getConversationListSync().filter(
    (item) => !messageState.conversationReadIds.includes(item.id) && item.unread
  ).length

  return {
    favoriteCount: favorites.length,
    recentCount: recentViews.length,
    unreadConversationCount,
    publishedCount: profile.publishedCount,
  }
}

function getConversationListSync() {
  const messageState = getMessageState()
  const favorites = getFavorites()
  const threads = getMergedThreads()

  return conversationMessages.map((item) => {
    const thread = threads[item.id]
    const lastMessage = thread && thread.messages.length ? thread.messages[thread.messages.length - 1] : null
    const relatedProduct = getProductById(item.relatedProductId)
    const previewText = lastMessage
      ? (lastMessage.type === 'product' ? '发来了一张商品卡片' : lastMessage.content)
      : item.content

    return {
      ...item,
      content: previewText,
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

  let filtered = sortProductsByCreatedAt(getAllProducts()).filter((item) => {
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

  const totalCount = getAllProducts().length
  const matchedCount = filtered.length
  const sliced = filtered.slice(0, pageIndex * pageSize).map((item) => createProductCard(item, favorites))

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
    hasMore: sliced.length < matchedCount,
    items: sliced,
  })
}

function getProductDetail(id) {
  const product = getProductById(id)
  if (!product) {
    return simulate(null)
  }

  addRecentView(product)

  return simulate({
    ...createProductCard(product, getFavorites()),
    seller: {
      ...product.seller,
      publishedCount: 12,
      responseRate: '95%',
    },
    policies: [
      '支持私聊沟通细节与补图',
      '正式购买流程将在后端接入后开放',
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
    createdAt: new Date().toISOString(),
  })

  addPublishedProduct(nextProduct)
  setProfile({
    ...profile,
    publishedCount: profile.publishedCount + 1,
  })

  return simulate({
    success: true,
    product: nextProduct,
    summary: getGlobalSummarySync(),
  }, { delay: 180 })
}

function getMessagesPageData(activeTab = 'conversation') {
  const sourceMap = {
    conversation: getConversationListSync(),
    trade: tradeNotifications.map((item) => ({
      ...item,
      avatarText: item.type.slice(0, 1),
      unread: getMessageState().tradeReadIds.includes(item.id) ? 0 : item.unread,
    })),
    system: systemMessages.map((item) => ({
      ...item,
      avatarText: item.type.slice(0, 1),
      unread: getMessageState().systemReadIds.includes(item.id) ? 0 : item.unread,
    })),
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
    thread: data,
    summary: getGlobalSummarySync(),
  }))
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
