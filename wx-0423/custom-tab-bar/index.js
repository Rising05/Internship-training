Component({
  data: {
    selected: '/pages/index/index',
    unreadCount: 0,
    tabs: [
      {
        key: 'home',
        pagePath: '/pages/index/index',
        text: '首页',
        iconPath: '/static/image/cropped/tab-home-default.png',
        selectedIconPath: '/static/image/cropped/tab-home-active.png',
      },
      {
        key: 'publish',
        pagePath: '/pages/publish/publish',
        text: '发布',
        iconPath: '/static/image/cropped/tab-publish-default.png',
        selectedIconPath: '/static/image/cropped/tab-publish-active.png',
      },
      {
        key: 'messages',
        pagePath: '/pages/messages/messages',
        text: '消息',
        iconPath: '/static/image/cropped/tab-message-default.png',
        selectedIconPath: '/static/image/cropped/tab-message-active.png',
      },
      {
        key: 'profile',
        pagePath: '/pages/profile/profile',
        text: '我的',
        iconPath: '/static/image/cropped/tab-profile-default.png',
        selectedIconPath: '/static/image/cropped/tab-profile-active.png',
      },
    ],
  },

  methods: {
    syncState(payload = {}) {
      this.setData({
        selected: payload.route || this.data.selected,
        unreadCount: payload.unreadCount || 0,
      })
    },

    switchTab(event) {
      const { path } = event.currentTarget.dataset
      if (!path || path === this.data.selected) {
        return
      }

      wx.switchTab({ url: path })
    },
  },
})
