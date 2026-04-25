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
} = require('../../utils/mock')

const DEMO_OPENID = 'demo-openid'

function buildInitialDb() {
  const now = new Date().toISOString()

  return {
    meta: {
      version: 1,
      seededAt: now,
      updatedAt: now,
    },
    dictionaries: {
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
    },
    users: [
      {
        id: 'user001',
        openid: DEMO_OPENID,
        nickname: '小星星',
        bio: '饭圈周边交易、交换与收藏记录都在这里。',
        location: '上海',
        publishedCount: 8,
        soldCount: 25,
        favoriteCount: 18,
        dealCount: 8,
        createdAt: now,
        updatedAt: now,
      },
    ],
    products: products.map((item) => ({
      ...item,
      ownerUserId: null,
      status: 'active',
      createdAt: item.createdAt || now,
      updatedAt: item.createdAt || now,
    })),
    favorites: [
      { userId: 'user001', productId: 'xc001', createdAt: now },
      { userId: 'user001', productId: 'xc003', createdAt: now },
    ],
    recentViews: [],
    conversations: conversationMessages.map((item) => {
      const thread = chatThreads[item.id] || {}
      return {
        id: item.id,
        relatedProductId: item.relatedProductId,
        seedPreview: item.content,
        seedTime: item.time,
        seedUnread: item.unread,
        user: thread.user || {
          id: `${item.id}-peer`,
          name: item.name,
          avatarText: item.initial || item.name.slice(0, 1),
          subtitle: '',
        },
        createdAt: now,
        updatedAt: now,
      }
    }),
    messages: Object.values(chatThreads).reduce((result, thread) => {
      const items = (thread.messages || []).map((message, index) => ({
        id: message.id,
        conversationId: thread.id,
        type: message.type,
        from: message.from,
        content: message.content || '',
        productId: message.productId || '',
        time: message.time || '',
        order: index,
        createdAt: now,
      }))
      return result.concat(items)
    }, []),
    tradeNotifications: tradeNotifications.map((item) => ({ ...item, createdAt: now })),
    systemNotifications: systemMessages.map((item) => ({ ...item, createdAt: now })),
    messageReads: [],
    uploads: [],
  }
}

module.exports = {
  DEMO_OPENID,
  buildInitialDb,
}
