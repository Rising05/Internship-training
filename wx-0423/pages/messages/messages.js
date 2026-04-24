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
    this.loadMessages()
  },

  onShow() {
    syncTabBar(getCurrentRoute())
    this.loadMessages({ silent: true })
  },

  async loadMessages(options = {}) {
    if (!options.silent) {
      this.setData({ loading: true })
    }
    const data = await services.getMessagesPageData(this.data.activeTab)
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
    await getApp().syncGlobalData()

    if (this.data.activeTab === 'conversation') {
      wx.navigateTo({
        url: `/pages/chat/chat?id=${id}`,
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
