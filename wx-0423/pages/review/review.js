const services = require('../../services/index')
const { requireLogin } = require('../../utils/auth')

Page({
  data: {
    loading: true,
    stats: null,
    list: [],
  },

  onLoad() {
    this._pageActive = true
    this._requestToken = 0
    if (!this.ensurePageAccess()) {
      return
    }
    this.loadReviews()
  },

  onUnload() {
    this._pageActive = false
    this._requestToken += 1
  },

  async loadReviews() {
    const requestToken = ++this._requestToken
    this.setData({ loading: true })

    try {
      const data = await services.getMyReviews()
      if (!this._pageActive || requestToken !== this._requestToken) {
        return
      }
      this.setData({
        loading: false,
        stats: data.stats || null,
        list: data.list || [],
      })
    } catch (error) {
      if (!this._pageActive || requestToken !== this._requestToken) {
        return
      }
      this.setData({ loading: false })
      if (!error || !error.isAuthError) {
        wx.showToast({
          title: error && error.message ? error.message : '加载评价失败',
          icon: 'none',
        })
      }
    }
  },

  ensurePageAccess() {
    return requireLogin({
      targetType: 'redirect',
      targetUrl: '/pages/review/review',
      reason: '登录后才能查看评价记录',
    })
  },
})
