const { PRODUCT_IMAGE_FALLBACK, getPrimaryImage } = require('../../utils/media')

Component({
  properties: {
    product: {
      type: Object,
      value: {},
      observer(product) {
        this.syncCover(product)
      },
    },
  },

  data: {
    coverSrc: PRODUCT_IMAGE_FALLBACK,
  },

  lifetimes: {
    attached() {
      this.syncCover(this.data.product)
    },
  },

  methods: {
    syncCover(product = {}) {
      this.setData({
        coverSrc: getPrimaryImage(product.images),
      })
    },

    handleOpen() {
      this.triggerEvent('open', { id: this.data.product.id })
    },

    handleFavorite() {
      this.triggerEvent('favorite', { id: this.data.product.id })
    },

    handleCoverError() {
      if (this.data.coverSrc === PRODUCT_IMAGE_FALLBACK) {
        return
      }

      this.setData({
        coverSrc: PRODUCT_IMAGE_FALLBACK,
      })
    },
  },
})
