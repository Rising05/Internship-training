const { getNavMetrics } = require('../../utils/system')

Component({
  properties: {
    title: {
      type: String,
      value: '',
    },
    showBack: {
      type: Boolean,
      value: false,
    },
    rightText: {
      type: String,
      value: '',
    },
    transparent: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
  },

  lifetimes: {
    attached() {
      const metrics = getNavMetrics()
      this.setData({
        statusBarHeight: metrics.statusBarHeight,
        navBarHeight: metrics.navBarHeight,
      })
    },
  },

  methods: {
    handleBack() {
      this.triggerEvent('back')
    },

    handleRightTap() {
      this.triggerEvent('righttap')
    },
  },
})
