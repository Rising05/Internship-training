const services = require('../../services/index')
const { getCurrentRoute, syncTabBar } = require('../../utils/tabbar')
const { requireLogin } = require('../../utils/auth')

function formatUnreadCount(count) {
  const numeric = Number(count) || 0
  if (numeric <= 0) {
    return ''
  }
  if (numeric > 99) {
    return '99+'
  }
  return String(numeric)
}

function decorateTabs(tabs = [], summary = {}) {
  const unreadDetail = {
    conversation: 0,
    trade: 0,
    system: 0,
    ...((summary && summary.unreadDetail) || {}),
  }

  return tabs.map((tab) => ({
    ...tab,
    unreadCount: formatUnreadCount(unreadDetail[tab.key]),
  }))
}

Page({
  data: {
    loading: true,
    tabs: [],
    activeTab: 'conversation',
    activeList: [],
  },

  onLoad() {
    this._pageActive = true
    this._hasLoadedData = false
    this._hasShownOnce = false
    this._messagesRequestToken = 0
    if (!this.ensurePageAccess()) {
      return
    }
    this.loadMessages()
  },

  onShow() {
    syncTabBar(getCurrentRoute())
    if (!this.ensurePageAccess()) {
      return
    }
    if (!this._hasLoadedData) {
      this.loadMessages()
      return
    }
    if (!this._hasShownOnce) {
      this._hasShownOnce = true
      return
    }
    this.loadMessages({ silent: true })
  },

  onUnload() {
    this._pageActive = false
    this._messagesRequestToken += 1
  },

  async loadMessages(options = {}) {
    const requestToken = ++this._messagesRequestToken
    if (!options.silent) {
      this.setData({ loading: true })
    }
    try {
      const data = await services.getMessagesPageData(this.data.activeTab)
      if (!this._pageActive || requestToken !== this._messagesRequestToken) {
        return
      }
      this._hasLoadedData = true
      this.setData(
        {
          loading: false,
          tabs: decorateTabs(data.tabs, data.summary),
          activeList: data.list,
        },
        () => {
          getApp().applySummary(data.summary)
        }
      )
    } catch (error) {
      if (!this._pageActive || requestToken !== this._messagesRequestToken) {
        return
      }
      this.setData({ loading: false })
      if (!error || !error.isAuthError) {
        wx.showToast({
          title: error && error.message ? error.message : '加载消息失败',
          icon: 'none',
        })
      }
    }
  },

  ensurePageAccess() {
    return requireLogin({
      targetType: 'tab',
      targetUrl: '/pages/messages/messages',
      reason: '登录后才能查看消息和未读提醒',
    })
  },

  handleTabSwitch(event) {
    this.setData({
      activeTab: event.currentTarget.dataset.tab,
    })
    this.loadMessages()
  },

  async handleMessageTap(event) {
    const { id } = event.currentTarget.dataset
    if (this.data.activeTab === 'conversation') {
      wx.navigateTo({
        url: `/pages/chat/chat?id=${id}`,
      })
      return
    }

    const result = await services.markMessageAsRead(this.data.activeTab, id)
    if (!this._pageActive) {
      return
    }
    getApp().applySummary(result.summary)
    this.loadMessages({ silent: true })
    wx.showToast({
      title: '通知已标记为已读',
      icon: 'none',
    })
  },
})
