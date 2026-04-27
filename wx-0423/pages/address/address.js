const services = require('../../services/index')
const { requireLogin } = require('../../utils/auth')

Page({
  data: {
    loading: true,
    list: [],
    defaultId: '',
  },

  onLoad() {
    this._pageActive = true
    this._requestToken = 0
    if (!this.ensurePageAccess()) {
      return
    }
    this.loadAddresses()
  },

  onUnload() {
    this._pageActive = false
    this._requestToken += 1
  },

  async loadAddresses() {
    const requestToken = ++this._requestToken
    this.setData({ loading: true })

    try {
      const data = await services.getAddressList()
      if (!this._pageActive || requestToken !== this._requestToken) {
        return
      }
      this.setData({
        loading: false,
        list: data.list || [],
        defaultId: data.defaultId || '',
      })
    } catch (error) {
      if (!this._pageActive || requestToken !== this._requestToken) {
        return
      }
      this.setData({ loading: false })
      if (!error || !error.isAuthError) {
        wx.showToast({
          title: error && error.message ? error.message : '加载地址失败',
          icon: 'none',
        })
      }
    }
  },

  ensurePageAccess() {
    return requireLogin({
      targetType: 'redirect',
      targetUrl: '/pages/address/address',
      reason: '登录后才能查看地址信息',
    })
  },
})
