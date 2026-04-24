const services = require('../../services/index')

Page({
  data: {
    conversationId: '',
    loading: true,
    sending: false,
    inputValue: '',
    navTitle: '聊天',
    thread: null,
    decoratedMessages: [],
    scrollIntoView: '',
  },

  onLoad(options) {
    this.setData({
      conversationId: options.id || '',
    })
    this.loadThread()
  },

  async loadThread() {
    this.setData({ loading: true })
    const thread = await services.getChatDetail(this.data.conversationId)
    const decoratedMessages = thread
      ? thread.messages.map((item) => ({
        ...item,
        isSelf: item.from === 'self',
        showAvatar: item.from !== 'self',
        isProduct: item.type === 'product' && !!item.product,
        rowClassName: item.from === 'self' ? 'chat-row chat-row-self' : 'chat-row',
        bubbleClassName: item.from === 'self' ? 'chat-bubble chat-bubble-self' : 'chat-bubble',
      }))
      : []
    this.setData({
      thread,
      navTitle: thread ? thread.title : '聊天',
      decoratedMessages,
      loading: false,
      scrollIntoView: thread && thread.messages.length ? `msg-${thread.messages[thread.messages.length - 1].id}` : '',
    })
    getApp().syncGlobalData()
  },

  handleBack() {
    wx.navigateBack()
  },

  handleInput(event) {
    this.setData({
      inputValue: event.detail.value,
    })
  },

  async handleSend() {
    if (this.data.sending || !this.data.inputValue.trim()) {
      return
    }

    this.setData({ sending: true })
    const result = await services.sendChatMessage(this.data.conversationId, this.data.inputValue)
    const decoratedMessages = result.thread.messages.map((item) => ({
      ...item,
      isSelf: item.from === 'self',
      showAvatar: item.from !== 'self',
      isProduct: item.type === 'product' && !!item.product,
      rowClassName: item.from === 'self' ? 'chat-row chat-row-self' : 'chat-row',
      bubbleClassName: item.from === 'self' ? 'chat-bubble chat-bubble-self' : 'chat-bubble',
    }))
    this.setData({
      sending: false,
      inputValue: '',
      thread: result.thread,
      navTitle: result.thread.title,
      decoratedMessages,
      scrollIntoView: result.thread && result.thread.messages.length
        ? `msg-${result.thread.messages[result.thread.messages.length - 1].id}`
        : '',
    })
    getApp().syncGlobalData()
  },

  handleOpenProduct(event) {
    const { id } = event.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`,
    })
  },
})
