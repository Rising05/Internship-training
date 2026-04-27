const services = require('../../services/index')
const { requireLogin } = require('../../utils/auth')

Page({
  data: {
    loading: true,
    wallet: null,
  },

  onLoad() {
    this._pageActive = true
    this._requestToken = 0
    if (!this.ensurePageAccess()) {
      return
    }
    this.loadWallet()
  },

  onUnload() {
    this._pageActive = false
    this._requestToken += 1
  },

  async loadWallet() {
    const requestToken = ++this._requestToken
    this.setData({ loading: true })

    try {
      const wallet = await services.getWalletData()
      if (!this._pageActive || requestToken !== this._requestToken) {
        return
      }
      this.setData({
        loading: false,
        wallet,
      })
    } catch (error) {
      if (!this._pageActive || requestToken !== this._requestToken) {
        return
      }
      this.setData({ loading: false })
      if (!error || !error.isAuthError) {
        wx.showToast({
          title: error && error.message ? error.message : '加载钱包失败',
          icon: 'none',
        })
      }
    }
  },

  ensurePageAccess() {
    return requireLogin({
      targetType: 'redirect',
      targetUrl: '/pages/wallet/wallet',
      reason: '登录后才能查看钱包信息',
    })
  },
})
