const { PRODUCT_IMAGE_FALLBACK, withCoverImage } = require('../../utils/media')
const services = require('../../services/index')
const { getCurrentRoute, syncTabBar } = require('../../utils/tabbar')
const { requireLogin } = require('../../utils/auth')

const ORDER_TARGETS = {
  'pending-pay': '/pages/orders/orders?status=pending-pay',
  shipping: '/pages/orders/orders?status=shipping',
  receiving: '/pages/orders/orders?status=receiving',
  done: '/pages/orders/orders?status=done',
}

const MENU_TARGETS = {
  wallet: '/pages/wallet/wallet',
  address: '/pages/address/address',
  review: '/pages/review/review',
  help: '/pages/help/help',
  policy: '/pages/policy/policy',
  about: '/pages/about/about',
}

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
    this._hasLoadedData = false
    this._profileRequestToken = 0
    if (!this.ensurePageAccess()) {
      return
    }
    this.loadProfilePage()
  },

  onShow() {
    syncTabBar(getCurrentRoute())
    if (!this.ensurePageAccess()) {
      return
    }
    if (!this._hasLoadedData) {
      this.loadProfilePage()
      return
    }
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

    try {
      const data = await services.getProfilePageData()
      if (!this._pageActive || requestToken !== this._profileRequestToken) {
        return
      }
      this._hasLoadedData = true
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
    } catch (error) {
      if (!this._pageActive || requestToken !== this._profileRequestToken) {
        return
      }
      this.setData({ loading: false })
      if (!error || !error.isAuthError) {
        wx.showToast({
          title: error && error.message ? error.message : '加载个人中心失败',
          icon: 'none',
        })
      }
    }
  },

  handleOpenDetail(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}`,
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
    const nextUrl = MENU_TARGETS[event.currentTarget.dataset.key]
    if (!nextUrl) {
      return
    }

    wx.navigateTo({
      url: nextUrl,
    })
  },

  handleOrderShortcutTap(event) {
    const nextUrl = ORDER_TARGETS[event.currentTarget.dataset.key]
    if (!nextUrl) {
      return
    }

    wx.navigateTo({
      url: nextUrl,
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

  ensurePageAccess() {
    return requireLogin({
      targetType: 'tab',
      targetUrl: '/pages/profile/profile',
      reason: '登录后才能查看个人中心',
    })
  },
})
