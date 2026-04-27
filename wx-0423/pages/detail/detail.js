const { PRODUCT_IMAGE_FALLBACK, normalizeImageList } = require('../../utils/media')
const services = require('../../services/index')
const { requireLogin } = require('../../utils/auth')

const OWNER_STATUS_ACTIONS = {
  active: [
    { label: '标记预留', status: 'reserved', successTitle: '已标记为预留' },
    { label: '标记已售', status: 'sold', successTitle: '已标记为已售' },
    { label: '下架商品', status: 'hidden', successTitle: '商品已下架', navigateBack: true },
    { label: '删除商品', action: 'delete', danger: true },
  ],
  reserved: [
    { label: '恢复在售', status: 'active', successTitle: '已恢复为在售' },
    { label: '标记已售', status: 'sold', successTitle: '已标记为已售' },
    { label: '下架商品', status: 'hidden', successTitle: '商品已下架', navigateBack: true },
    { label: '删除商品', action: 'delete', danger: true },
  ],
  sold: [
    { label: '恢复在售', status: 'active', successTitle: '已恢复为在售' },
    { label: '下架商品', status: 'hidden', successTitle: '商品已下架', navigateBack: true },
    { label: '删除商品', action: 'delete', danger: true },
  ],
  hidden: [
    { label: '重新上架', status: 'active', successTitle: '商品已重新上架' },
    { label: '删除商品', action: 'delete', danger: true },
  ],
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    actionLoading: false,
    productId: '',
    currentImageIndex: 0,
    displayImages: [],
    product: null,
  },

  onLoad(options) {
    this._pageActive = true
    this._hasShownOnce = false
    this._detailRequestToken = 0
    this.setData({
      productId: options.id || '',
    })
    this.loadDetail()
  },

  onShow() {
    if (!this._hasShownOnce) {
      this._hasShownOnce = true
      return
    }
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
      this.setData({ loading: true, errorMessage: '' })
    }

    try {
      const product = await services.getProductDetail(this.data.productId)
      if (!this._pageActive || requestToken !== this._detailRequestToken) {
        return
      }
      this.setData({
        product,
        displayImages: product ? normalizeImageList(product.images) : [PRODUCT_IMAGE_FALLBACK],
        loading: false,
        errorMessage: '',
      })
      const app = getApp()
      if (
        product
        && app
        && app.globalData
        && app.globalData.authSession
        && app.globalData.authSession.loggedIn
        && typeof app.syncGlobalData === 'function'
      ) {
        app.syncGlobalData().catch(() => {})
      }
    } catch (error) {
      if (!this._pageActive || requestToken !== this._detailRequestToken) {
        return
      }
      this.setData({
        loading: false,
        errorMessage: error && error.message ? error.message : '加载商品详情失败',
      })
    }
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
    if (!this.data.product) {
      return
    }
    if (!requireLogin({
      targetType: 'back',
      reason: '登录后即可收藏商品',
    })) {
      return
    }
    await services.toggleProductFavorite(this.data.product.id)
    if (!this._pageActive) {
      return
    }
    getApp().syncGlobalData()
    this.loadDetail({ silent: true })
  },

  handleContact() {
    if (!this.data.product || !this.data.product.conversationId) {
      wx.showToast({
        title: '暂时没有可用会话',
        icon: 'none',
      })
      return
    }
    const allowAccess = requireLogin({
      targetType: 'redirect',
      targetUrl: `/pages/chat/chat?id=${this.data.product.conversationId}`,
      reason: '登录后才能进入聊天',
    })
    if (!allowAccess) {
      return
    }
    wx.navigateTo({
      url: `/pages/chat/chat?id=${this.data.product.conversationId}`,
    })
  },

  handleRightTap() {
    if (!this.data.product || !this.data.product.isOwner || this.data.actionLoading) {
      return
    }

    const actions = OWNER_STATUS_ACTIONS[this.data.product.status] || OWNER_STATUS_ACTIONS.active
    wx.showActionSheet({
      itemList: actions.map((item) => item.label),
      success: async (response) => {
        const action = actions[response.tapIndex]
        if (!action) {
          return
        }

        if (action.action === 'delete') {
          this.handleDeleteProduct()
          return
        }

        this.handleStatusUpdate(action)
      },
    })
  },

  async handleStatusUpdate(action) {
    if (!this.data.product) {
      return
    }

    this.setData({ actionLoading: true })
    try {
      await services.updateProductStatus(this.data.product.id, action.status)
      if (!this._pageActive) {
        return
      }
      await getApp().syncGlobalData()
      if (!this._pageActive) {
        return
      }
      if (action.navigateBack) {
        wx.showToast({
          title: action.successTitle,
          icon: 'none',
        })
        setTimeout(() => {
          if (this._pageActive) {
            wx.navigateBack()
          }
        }, 320)
        return
      }
      wx.showToast({
        title: action.successTitle,
        icon: 'none',
      })
      this.loadDetail({ silent: true })
    } catch (error) {
      if (!this._pageActive) {
        return
      }
      wx.showToast({
        title: error && error.message ? error.message : '商品状态更新失败',
        icon: 'none',
      })
    } finally {
      if (this._pageActive) {
        this.setData({ actionLoading: false })
      }
    }
  },

  handleDeleteProduct() {
    if (!this.data.product) {
      return
    }

    wx.showModal({
      title: '删除商品',
      content: '删除后商品会从首页、收藏和最近浏览中移除，当前操作不可恢复。',
      confirmColor: '#ff5d97',
      success: async (response) => {
        if (!response.confirm) {
          return
        }

        this.setData({ actionLoading: true })
        try {
          await services.deleteProduct(this.data.product.id)
          if (!this._pageActive) {
            return
          }
          await getApp().syncGlobalData()
          if (!this._pageActive) {
            return
          }
          wx.showToast({
            title: '商品已删除',
            icon: 'none',
          })
          setTimeout(() => {
            if (this._pageActive) {
              wx.navigateBack()
            }
          }, 320)
        } catch (error) {
          if (!this._pageActive) {
            return
          }
          wx.showToast({
            title: error && error.message ? error.message : '删除商品失败',
            icon: 'none',
          })
        } finally {
          if (this._pageActive) {
            this.setData({ actionLoading: false })
          }
        }
      },
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
    if (!this.data.product) {
      return
    }

    if (!this.data.product.canPurchase) {
      wx.showToast({
        title: this.data.product.status === 'sold' ? '该商品已售出' : '该商品当前不可购买',
        icon: 'none',
      })
      return
    }

    if (!requireLogin({
      targetType: 'back',
      reason: '登录后才能继续交易沟通',
    })) {
      return
    }

    wx.showToast({
      title: '交易流程建设中，建议先通过聊天确认细节',
      icon: 'none',
    })
  },

  handleRetry() {
    this.loadDetail()
  },

  handleOpenRelated(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.detail.id}`,
    })
  },

  async handleFavoriteRelated(event) {
    if (!requireLogin({
      targetType: 'back',
      reason: '登录后即可同步收藏商品',
    })) {
      return
    }

    await services.toggleProductFavorite(event.detail.id)
    if (!this._pageActive) {
      return
    }
    await getApp().syncGlobalData()
    if (!this._pageActive) {
      return
    }
    this.loadDetail({ silent: true })
  },
})
