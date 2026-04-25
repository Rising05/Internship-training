const { PRODUCT_IMAGE_FALLBACK, getPrimaryImage } = require('../../utils/media')
const services = require('../../services/index')

function decorateThread(thread) {
  if (!thread) {
    return {
      thread: null,
      relatedProductCover: PRODUCT_IMAGE_FALLBACK,
      decoratedMessages: [],
      scrollIntoView: '',
    }
  }

  const decoratedMessages = thread.messages.map((item) => ({
    ...item,
    isSelf: item.from === 'self',
    showAvatar: item.from !== 'self',
    isProduct: item.type === 'product' && !!item.product,
    productCover: item.product ? getPrimaryImage(item.product.images) : PRODUCT_IMAGE_FALLBACK,
    rowClassName: item.from === 'self' ? 'chat-row chat-row-self' : 'chat-row',
    bubbleClassName: item.from === 'self' ? 'chat-bubble chat-bubble-self' : 'chat-bubble',
  }))

  return {
    thread,
    relatedProductCover: thread.relatedProduct ? getPrimaryImage(thread.relatedProduct.images) : PRODUCT_IMAGE_FALLBACK,
    decoratedMessages,
    scrollIntoView: thread.messages.length ? `msg-${thread.messages[thread.messages.length - 1].id}` : '',
  }
}

Page({
  data: {
    conversationId: '',
    loading: true,
    sending: false,
    inputValue: '',
    navTitle: '聊天',
    thread: null,
    relatedProductCover: PRODUCT_IMAGE_FALLBACK,
    decoratedMessages: [],
    scrollIntoView: '',
  },

  onLoad(options) {
    this._pageActive = true
    this._chatRequestToken = 0
    this._sendRequestToken = 0
    this.setData({
      conversationId: options.id || '',
    })
    this.loadThread()
  },

  onUnload() {
    this._pageActive = false
    this._chatRequestToken += 1
    this._sendRequestToken += 1
  },

  async loadThread() {
    const requestToken = ++this._chatRequestToken
    this.setData({ loading: true })
    const thread = await services.getChatDetail(this.data.conversationId)
    if (!this._pageActive || requestToken !== this._chatRequestToken) {
      return
    }
    const nextThreadState = decorateThread(thread)
    this.setData({
      navTitle: thread ? thread.title : '聊天',
      loading: false,
      ...nextThreadState,
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

    const requestToken = ++this._sendRequestToken
    this.setData({ sending: true })
    const result = await services.sendChatMessage(this.data.conversationId, this.data.inputValue)
    if (!this._pageActive || requestToken !== this._sendRequestToken) {
      return
    }
    const nextThreadState = decorateThread(result.thread)
    this.setData({
      sending: false,
      inputValue: '',
      navTitle: result.thread.title,
      ...nextThreadState,
    })
    getApp().syncGlobalData()
  },

  handleOpenProduct(event) {
    const { id } = event.currentTarget.dataset
    wx.navigateTo({
      url: `/package-sub/detail/detail?id=${id}`,
    })
  },

  handleThreadProductError() {
    if (this.data.relatedProductCover === PRODUCT_IMAGE_FALLBACK) {
      return
    }

    this.setData({
      relatedProductCover: PRODUCT_IMAGE_FALLBACK,
    })
  },

  handleMessageProductError(event) {
    const index = Number(event.currentTarget.dataset.index)
    const current = this.data.decoratedMessages[index]
    if (!current || current.productCover === PRODUCT_IMAGE_FALLBACK) {
      return
    }

    this.setData({
      [`decoratedMessages[${index}].productCover`]: PRODUCT_IMAGE_FALLBACK,
    })
  },
})
