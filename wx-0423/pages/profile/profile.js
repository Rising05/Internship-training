const services = require('../../services/index')
const { getCurrentRoute, syncTabBar } = require('../../utils/tabbar')

Page({
  data: {
    loading: true,
    profile: {},
    profileInitial: '星',
    stats: {},
    orderShortcuts: [],
    menuItems: [],
    favoriteProducts: [],
    recentViews: [],
    latestPublished: [],
    policyHighlights: [],
  },

  onLoad() {
    this.loadProfilePage()
  },

  onShow() {
    syncTabBar(getCurrentRoute())
    this.loadProfilePage({ silent: true })
  },

  async loadProfilePage(options = {}) {
    if (!options.silent) {
      this.setData({ loading: true })
    }

    const data = await services.getProfilePageData()
    this.setData({
      loading: false,
      profile: data.profile,
      profileInitial: data.profileInitial,
      stats: data.stats,
      orderShortcuts: data.orderShortcuts,
      menuItems: data.menuItems,
      favoriteProducts: data.favoriteProducts,
      recentViews: data.recentViews,
      latestPublished: data.latestPublished,
      policyHighlights: data.policyHighlights,
    })
    getApp().syncGlobalData()
  },

  handleOpenDetail(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}`,
    })
  },

  handleMenuTap(event) {
    wx.showToast({
      title: `${event.currentTarget.dataset.title} 已预留正式入口`,
      icon: 'none',
    })
  },

  async handleClearRecent() {
    await services.clearProfileRecentViews()
    await getApp().syncGlobalData()
    this.loadProfilePage({ silent: true })
  },
})
