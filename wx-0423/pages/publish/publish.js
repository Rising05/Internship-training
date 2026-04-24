const services = require('../../services/index')
const { getCurrentRoute, syncTabBar } = require('../../utils/tabbar')

Page({
  data: {
    loading: true,
    submitting: false,
    tips: [],
    publishTypeOptions: [],
    idolOptions: [],
    categoryOptions: [],
    conditionOptions: [],
    tradeTypeOptions: [],
    imageList: [],
    form: {
      publishType: 'sell',
      publishTypeLabel: '小卡',
      title: '',
      idol: '',
      category: '',
      price: '',
      quantity: '1',
      tradeType: '出物',
      condition: '全新',
      shippingFee: '0',
      note: '',
    },
  },

  onLoad() {
    this.loadPublishPage()
  },

  onShow() {
    syncTabBar(getCurrentRoute())
  },

  async loadPublishPage() {
    const data = await services.getPublishPageData()
    this.setData({
      loading: false,
      tips: data.tips,
      publishTypeOptions: data.publishTypeOptions,
      idolOptions: data.idolOptions,
      categoryOptions: data.categoryOptions,
      conditionOptions: data.conditionOptions,
      tradeTypeOptions: data.tradeTypeOptions,
      'form.publishType': data.publishTypeOptions[0].key,
      'form.publishTypeLabel': data.publishTypeOptions[0].label,
      'form.idol': data.idolOptions[0],
      'form.category': data.categoryOptions[0],
      'form.condition': data.conditionOptions[0],
      'form.tradeType': data.tradeTypeOptions[0],
    })
  },

  handleChooseImage() {
    const remain = 9 - this.data.imageList.length
    if (remain <= 0) {
      return
    }

    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      success: ({ tempFilePaths }) => {
        this.setData({
          imageList: this.data.imageList.concat(tempFilePaths),
        })
      },
    })
  },

  handlePreviewImage(event) {
    const current = event.currentTarget.dataset.url
    wx.previewImage({
      current,
      urls: this.data.imageList,
    })
  },

  handleDeleteImage(event) {
    const index = event.currentTarget.dataset.index
    this.setData({
      imageList: this.data.imageList.filter((_, currentIndex) => currentIndex !== index),
    })
  },

  handleTextInput(event) {
    const { field } = event.currentTarget.dataset
    this.setData({
      [`form.${field}`]: event.detail.value,
    })
  },

  handlePickerChange(event) {
    const { field, range } = event.currentTarget.dataset
    const value = this.data[range][event.detail.value]
    this.setData({
      [`form.${field}`]: value,
    })
  },

  handlePublishTypeSelect(event) {
    const { key, label } = event.currentTarget.dataset
    this.setData({
      'form.publishType': key,
      'form.publishTypeLabel': label,
    })
  },

  handleTradeTypeSelect(event) {
    this.setData({
      'form.tradeType': event.currentTarget.dataset.value,
    })
  },

  handleConditionSelect(event) {
    this.setData({
      'form.condition': event.currentTarget.dataset.value,
    })
  },

  validateForm() {
    const { form, imageList } = this.data

    if (!imageList.length) return '请至少上传 1 张商品图片'
    if (!form.title.trim()) return '请填写商品标题'
    if (!form.idol) return '请选择爱豆分类'
    if (!form.category) return '请选择商品分类'
    if (!form.price || Number(form.price) < 0) return '请填写正确的价格'
    if (!form.quantity || Number(form.quantity) <= 0) return '请填写正确的数量'
    if (Number(form.shippingFee) < 0) return '运费不能小于 0'
    if (!form.note.trim()) return '请补充商品描述'
    return ''
  },

  async handleSubmit() {
    const errorMessage = this.validateForm()
    if (errorMessage || this.data.submitting) {
      if (errorMessage) {
        wx.showToast({
          title: errorMessage,
          icon: 'none',
        })
      }
      return
    }

    this.setData({ submitting: true })
    await services.submitProduct({
      ...this.data.form,
      images: this.data.imageList,
    })
    await getApp().syncGlobalData()
    this.setData({ submitting: false })
    wx.showToast({
      title: '商品发布成功',
      icon: 'success',
    })
    wx.switchTab({
      url: '/pages/profile/profile',
    })
  },
})
