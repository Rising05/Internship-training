const services = require('./services/index')
const { cloudEnv } = require('./services/http/config')
const {
  ensureStorageDefaults,
  getAuthSession,
  setAuthSession,
  clearAuthSession,
} = require('./utils/storage')
const { getNavMetrics } = require('./utils/system')

const defaultSummary = {
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

function normalizeSummary(summary = {}) {
  const unreadDetail = {
    ...defaultSummary.unreadDetail,
    ...((summary && summary.unreadDetail) || {}),
  }
  const unreadConversationCount = Number(summary.unreadConversationCount)
  const unreadCount = Number(summary.unreadCount)

  return {
    ...defaultSummary,
    ...summary,
    unreadConversationCount: Number.isFinite(unreadConversationCount)
      ? unreadConversationCount
      : unreadDetail.conversation,
    unreadCount: Number.isFinite(unreadCount)
      ? unreadCount
      : unreadDetail.conversation + unreadDetail.trade + unreadDetail.system,
    unreadDetail,
  }
}

function deferUiUpdate(callback) {
  if (typeof wx !== 'undefined' && typeof wx.nextTick === 'function') {
    wx.nextTick(callback)
    return
  }

  setTimeout(callback, 0)
}

App({
  async onLaunch() {
    ensureStorageDefaults()
    this.globalData.system = getNavMetrics()
    this.initCloud()
    this.globalData.authSession = getAuthSession()
    await this.syncGlobalData()
  },

  initCloud() {
    if (!cloudEnv || !wx.cloud || !wx.cloud.init) {
      return
    }

    wx.cloud.init({
      env: cloudEnv,
      traceUser: true,
    })

    this.globalData.cloudReady = true
  },

  async syncGlobalData() {
    const appData = await services.bootstrapApp()
    if (appData && appData.authSession && appData.authSession.loggedIn) {
      setAuthSession(appData.authSession)
    } else {
      clearAuthSession()
    }
    this.globalData.profile = appData && appData.profile ? appData.profile : null
    this.globalData.authSession = getAuthSession()
    this.applySummary((appData && appData.summary) || defaultSummary)
    return appData
  },

  applySummary(summary) {
    this.globalData.summary = normalizeSummary(summary)
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    if (!currentPage || typeof currentPage.getTabBar !== 'function') {
      return this.globalData.summary
    }

    const tabBar = currentPage.getTabBar()
    if (!tabBar || typeof tabBar.syncState !== 'function') {
      return this.globalData.summary
    }

    deferUiUpdate(() => {
      const latestPages = getCurrentPages()
      const latestPage = latestPages[latestPages.length - 1]
      if (!latestPage || typeof latestPage.getTabBar !== 'function') {
        return
      }

      const latestTabBar = latestPage.getTabBar()
      if (!latestTabBar || typeof latestTabBar.syncState !== 'function') {
        return
      }

      latestTabBar.syncState({
        route: `/${latestPage.route || ''}`,
        unreadCount: this.globalData.summary.unreadCount,
      })
    })
    return this.globalData.summary
  },

  globalData: {
    profile: null,
    authSession: null,
    cloudReady: false,
    system: null,
    summary: defaultSummary,
  }
})
