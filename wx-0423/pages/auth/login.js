const services = require('../../services/index')
const { getPendingAuthTarget, markLoginPageReady, handleAuthSuccess } = require('../../utils/auth')

Page({
  data: {
    submitting: false,
    reason: '',
  },

  onLoad(options) {
    markLoginPageReady()
    const pendingTarget = getPendingAuthTarget()
    this.setData({
      reason: options.reason || (pendingTarget && pendingTarget.reason) || '登录后即可继续当前操作',
    })
  },

  async handleLogin() {
    if (this.data.submitting) {
      return
    }

    this.setData({ submitting: true })
    try {
      await services.loginWithWeChat()
      await getApp().syncGlobalData()
      handleAuthSuccess()
    } catch (error) {
      wx.showToast({
        title: error && error.message ? error.message : '微信登录失败',
        icon: 'none',
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  handleBack() {
    wx.navigateBack()
  },
})
