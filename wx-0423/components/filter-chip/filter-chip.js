Component({
  properties: {
    label: {
      type: String,
      value: '',
    },
    value: {
      type: String,
      value: '',
    },
    active: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    handleSelect() {
      this.triggerEvent('select', { value: this.data.value })
    },
  },
})
