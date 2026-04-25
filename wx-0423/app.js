const services = require('./services/index')
const { setAuthSession } = require('./utils/storage')
const { getNavMetrics } = require('./utils/system')

App({
  async onLaunch() {
    this.globalData.system = getNavMetrics()
    await services.ensureSession()
    await this.syncGlobalData()
  },

  async syncGlobalData() {
    const appData = await services.bootstrapApp()
    if (appData && appData.authSession) {
      setAuthSession(appData.authSession)
    }
    this.globalData.profile = appData.profile
    this.globalData.authSession = appData.authSession
    this.globalData.summary = appData.summary
    return appData
  },

  globalData: {
    profile: null,
    authSession: null,
    system: null,
    summary: {
      favoriteCount: 0,
      recentCount: 0,
      unreadConversationCount: 0,
      publishedCount: 0,
    },
  }
})
