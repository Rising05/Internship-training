const { PRODUCT_IMAGE_FALLBACK, normalizeImageList } = require('../../utils/media')
const services = require('../../services/index')

Page({
  data: {
    loading: true,
    productId: '',
    currentImageIndex: 0,
    displayImages: [],
    product: null,
  },

  onLoad(options) {
    this._pageActive = true
    this._detailRequestToken = 0
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

  onUnload() {
    this._pageActive = false
    this._detailRequestToken += 1
  },

  async loadDetail(options = {}) {
    const requestToken = ++this._detailRequestToken
    if (!options.silent) {
      this.setData({ loading: true })
    }

    const product = await services.getProductDetail(this.data.productId)
    if (!this._pageActive || requestToken !== this._detailRequestToken) {
      return
    }
    this.setData({
      product,
      displayImages: product ? normalizeImageList(product.images) : [PRODUCT_IMAGE_FALLBACK],
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
      urls: this.data.displayImages,
    })
  },

  async handleFavorite() {
    await services.toggleProductFavorite(this.data.product.id)
    if (!this._pageActive) {
      return
    }
    getApp().syncGlobalData()
    this.loadDetail({ silent: true })
  },

  handleContact() {
    wx.navigateTo({
      url: `/package-sub/chat/chat?id=${this.data.product.conversationId}`,
    })
  },

  handleGalleryImageError(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (this.data.displayImages[index] === PRODUCT_IMAGE_FALLBACK) {
      return
    }

    this.setData({
      [`displayImages[${index}]`]: PRODUCT_IMAGE_FALLBACK,
    })
  },

  handleConsult() {
    wx.showToast({
      title: '购买流程将在后端接入后开放',
      icon: 'none',
    })
  },
})
