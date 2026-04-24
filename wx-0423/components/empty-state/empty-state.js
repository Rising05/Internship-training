Component({
  properties: {
    title: {
      type: String,
      value: '这里暂时空空的',
    },
    description: {
      type: String,
      value: '稍后再来看看吧',
    },
    actionText: {
      type: String,
      value: '',
    },
  },

  methods: {
    handleAction() {
      this.triggerEvent('action')
    },
  },
})
