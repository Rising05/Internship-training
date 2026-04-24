const services = require('../../services/index')

Page({
  data: {
    loading: true,
    productId: '',
    currentImageIndex: 0,
    product: null,
  },

  onLoad(options) {
    this.setData({
      productId: options.id || '',
    })
    this.loadDetail()
  },

  onShow() {
    if (this.data.productId) {
      this.loadDetail({ silent: true })
    }
  },

  async loadDetail(options = {}) {
    if (!options.silent) {
      this.setData({ loading: true })
    }

    const product = await services.getProductDetail(this.data.productId)
    this.setData({
      product,
      loading: false,
    })
    getApp().syncGlobalData()
  },

  handleBack() {
    wx.navigateBack()
  },

  handleSwiperChange(event) {
    this.setData({
      currentImageIndex: event.detail.current,
    })
  },

  handlePreview(event) {
    const current = event.currentTarget.dataset.url
    wx.previewImage({
      current,
      urls: this.data.product.images,
    })
  },

  async handleFavorite() {
    await services.toggleProductFavorite(this.data.product.id)
    getApp().syncGlobalData()
    this.loadDetail({ silent: true })
  },

  handleContact() {
    wx.navigateTo({
      url: `/pages/chat/chat?id=${this.data.product.conversationId}`,
    })
  },

  handleConsult() {
    wx.showToast({
      title: '购买流程将在后端接入后开放',
      icon: 'none',
    })
  },
})
