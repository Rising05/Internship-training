Component({
  properties: {
    product: {
      type: Object,
      value: {},
    },
  },

  methods: {
    handleOpen() {
      this.triggerEvent('open', { id: this.data.product.id })
    },

    handleFavorite() {
      this.triggerEvent('favorite', { id: this.data.product.id })
    },
  },
})
