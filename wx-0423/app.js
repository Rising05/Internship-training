const services = require('./services/index')
const { cloudEnv } = require('./services/http/config')
const { setAuthSession } = require('./utils/storage')
const { getNavMetrics } = require('./utils/system')

App({
  async onLaunch() {
    this.globalData.system = getNavMetrics()
    this.initCloud()
    await services.ensureSession()
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
    cloudReady: false,
    system: null,
    summary: {
      favoriteCount: 0,
      recentCount: 0,
      unreadConversationCount: 0,
      publishedCount: 0,
    },
  }
})
