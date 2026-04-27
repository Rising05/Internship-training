const { PRODUCT_IMAGE_FALLBACK, getPrimaryImage } = require('../../utils/media')
const services = require('../../services/index')
const { requireLogin } = require('../../utils/auth')

function decorateOrders(list = []) {
  return list.map((item) => ({
    ...item,
    product: item.product ? {
      ...item.product,
      coverImage: getPrimaryImage(item.product.images),
    } : null,
  }))
}

Page({
  data: {
    loading: true,
    activeStatus: 'all',
    statuses: [],
    list: [],
  },

  onLoad(options) {
    this._pageActive = true
    this._requestToken = 0
    const activeStatus = options.status || 'all'
    this.setData({ activeStatus })
    if (!this.ensurePageAccess(activeStatus)) {
      return
    }
    this.loadPage(activeStatus)
  },

  onUnload() {
    this._pageActive = false
    this._requestToken += 1
  },

  async loadPage(status, options = {}) {
    const requestToken = ++this._requestToken
    if (!options.silent) {
      this.setData({ loading: true })
    }

    try {
      const [summary, orders] = await Promise.all([
        services.getOrderSummary(),
        services.getOrders(status),
      ])
      if (!this._pageActive || requestToken !== this._requestToken) {
        return
      }

      this.setData({
        loading: false,
        activeStatus: orders.activeStatus,
        statuses: orders.statuses && orders.statuses.length ? orders.statuses : summary.statuses,
        list: decorateOrders(orders.list),
      })
    } catch (error) {
      if (!this._pageActive || requestToken !== this._requestToken) {
        return
      }
      this.setData({ loading: false })
      if (!error || !error.isAuthError) {
        wx.showToast({
          title: error && error.message ? error.message : '加载订单失败',
          icon: 'none',
        })
      }
    }
  },

  handleStatusTap(event) {
    const status = event.currentTarget.dataset.status || 'all'
    if (status === this.data.activeStatus) {
      return
    }

    this.setData({ activeStatus: status })
    this.loadPage(status, { silent: true })
  },

  handleImageError(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (this.data.list[index] && this.data.list[index].product && this.data.list[index].product.coverImage !== PRODUCT_IMAGE_FALLBACK) {
      this.setData({
        [`list[${index}].product.coverImage`]: PRODUCT_IMAGE_FALLBACK,
      })
    }
  },

  handleOpenDetail(event) {
    const id = event.currentTarget.dataset.id
    if (!id) {
      return
    }
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`,
    })
  },

  ensurePageAccess(status) {
    return requireLogin({
      targetType: 'redirect',
      targetUrl: `/pages/orders/orders?status=${status}`,
      reason: '登录后才能查看我的订单',
    })
  },
})
