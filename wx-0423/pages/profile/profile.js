const { PRODUCT_IMAGE_FALLBACK, withCoverImage } = require('../../utils/media')
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
    this._pageActive = true
    this._profileRequestToken = 0
    this.loadProfilePage()
  },

  onShow() {
    syncTabBar(getCurrentRoute())
    this.loadProfilePage({ silent: true })
  },

  onUnload() {
    this._pageActive = false
    this._profileRequestToken += 1
  },

  async loadProfilePage(options = {}) {
    const requestToken = ++this._profileRequestToken
    if (!options.silent) {
      this.setData({ loading: true })
    }

    const data = await services.getProfilePageData()
    if (!this._pageActive || requestToken !== this._profileRequestToken) {
      return
    }
    this.setData({
      loading: false,
      profile: data.profile,
      profileInitial: data.profileInitial,
      stats: data.stats,
      orderShortcuts: data.orderShortcuts,
      menuItems: data.menuItems,
      favoriteProducts: withCoverImage(data.favoriteProducts),
      recentViews: withCoverImage(data.recentViews),
      latestPublished: withCoverImage(data.latestPublished),
      policyHighlights: data.policyHighlights,
    })
    getApp().syncGlobalData()
  },

  handleOpenDetail(event) {
    wx.navigateTo({
      url: `/package-sub/detail/detail?id=${event.currentTarget.dataset.id}`,
    })
  },

  handleMiniImageError(event) {
    const { list, index } = event.currentTarget.dataset
    if (!list && list !== 0) {
      return
    }

    if (!this.data[list] || !this.data[list][index] || this.data[list][index].coverImage === PRODUCT_IMAGE_FALLBACK) {
      return
    }

    this.setData({
      [`${list}[${index}].coverImage`]: PRODUCT_IMAGE_FALLBACK,
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
    if (!this._pageActive) {
      return
    }
    await getApp().syncGlobalData()
    if (!this._pageActive) {
      return
    }
    this.loadProfilePage({ silent: true })
  },
})
