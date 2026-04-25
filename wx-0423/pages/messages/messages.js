const services = require('../../services/index')
const { getCurrentRoute, syncTabBar } = require('../../utils/tabbar')

Page({
  data: {
    loading: true,
    tabs: [],
    activeTab: 'conversation',
    activeList: [],
  },

  onLoad() {
    this._pageActive = true
    this._messagesRequestToken = 0
    this.loadMessages()
  },

  onShow() {
    syncTabBar(getCurrentRoute())
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
    const data = await services.getMessagesPageData(this.data.activeTab)
    if (!this._pageActive || requestToken !== this._messagesRequestToken) {
      return
    }
    this.setData({
      loading: false,
      tabs: data.tabs,
      activeList: data.list,
    })
    getApp().syncGlobalData()
  },

  handleTabSwitch(event) {
    this.setData({
      activeTab: event.currentTarget.dataset.tab,
    })
    this.loadMessages()
  },

  async handleMessageTap(event) {
    const { id } = event.currentTarget.dataset
    await services.markMessageAsRead(this.data.activeTab, id)
    if (!this._pageActive) {
      return
    }
    await getApp().syncGlobalData()
    if (!this._pageActive) {
      return
    }

    if (this.data.activeTab === 'conversation') {
      wx.navigateTo({
        url: `/package-sub/chat/chat?id=${id}`,
      })
      return
    }

    this.loadMessages({ silent: true })
    wx.showToast({
      title: '通知已标记为已读',
      icon: 'none',
    })
  },
})
