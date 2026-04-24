const services = require('../../services/index')
const { getCurrentRoute, syncTabBar } = require('../../utils/tabbar')

const IDOL_TYPE_TABS = [
  { key: 'group', label: '团体' },
  { key: 'solo', label: '个人' },
]
const IDOL_REGION_TABS = [
  { key: 'kpop', label: 'KPOP' },
  { key: 'jpop', label: 'JPOP' },
  { key: 'cpop', label: '内娱' },
]

function getIdolOptionsByTab(directory, typeTab, regionTab) {
  if (!directory || !directory[typeTab] || !directory[typeTab][regionTab]) {
    return []
  }
  return directory[typeTab][regionTab]
}

function inferIdolTabState(directory, value) {
  const normalized = (value || '').trim().toLowerCase()
  if (!normalized) {
    return { typeTab: 'group', regionTab: 'kpop', isCustom: false }
  }

  for (const typeTab of Object.keys(directory || {})) {
    const regionGroup = directory[typeTab] || {}
    for (const regionTab of Object.keys(regionGroup)) {
      if (regionGroup[regionTab].some((item) => item.toLowerCase() === normalized)) {
        return { typeTab, regionTab, isCustom: false }
      }
    }
  }

  return { typeTab: 'group', regionTab: 'kpop', isCustom: true }
}

function buildCategorySections(options = [], keyword = '', commonCategories = []) {
  const normalizedKeyword = keyword.trim().toLowerCase()
  const filtered = !normalizedKeyword
    ? options.slice()
    : options.filter((item) => item.toLowerCase().includes(normalizedKeyword))
  const common = commonCategories.filter((item) => filtered.includes(item))
  const extra = filtered.filter((item) => !common.includes(item))
  return { common, extra }
}

Page({
  data: {
    loading: true,
    submitting: false,
    tips: [],
    publishTypeOptions: [],
    idolDirectory: {},
    idolTypeTabs: IDOL_TYPE_TABS,
    idolRegionTabs: IDOL_REGION_TABS,
    idolOptions: [],
    categoryOptions: [],
    categorySections: {
      common: [],
      extra: [],
    },
    selectorVisible: false,
    selectorExpanded: false,
    selectorMode: '',
    selectorTitle: '',
    selectorSearch: '',
    selectorTypeTab: 'group',
    selectorRegionTab: 'kpop',
    selectorOptions: [],
    selectorCommonOptions: [],
    selectorExtraOptions: [],
    selectorCustomVisible: false,
    selectorCustomValue: '',
    selectorTouchStartY: 0,
    selectorTouchDeltaY: 0,
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
      idolDirectory: data.idolDirectory,
      idolOptions: data.idolOptions,
      categoryOptions: data.categoryOptions,
      categorySections: data.categorySections,
      conditionOptions: data.conditionOptions,
      tradeTypeOptions: data.tradeTypeOptions,
      'form.publishType': data.publishTypeOptions[0].key,
      'form.publishTypeLabel': data.publishTypeOptions[0].label,
      'form.idol': '',
      'form.category': '',
      'form.condition': data.conditionOptions[0],
      'form.tradeType': data.tradeTypeOptions[0],
    })
  },

  buildSelectorState(overrides = {}) {
    const selectorMode = overrides.selectorMode || this.data.selectorMode
    const selectorSearch = typeof overrides.selectorSearch === 'string'
      ? overrides.selectorSearch
      : this.data.selectorSearch
    const selectorTypeTab = overrides.selectorTypeTab || this.data.selectorTypeTab
    const selectorRegionTab = overrides.selectorRegionTab || this.data.selectorRegionTab

    if (selectorMode === 'idol') {
      const options = getIdolOptionsByTab(this.data.idolDirectory, selectorTypeTab, selectorRegionTab)
      const normalizedKeyword = selectorSearch.trim().toLowerCase()
      const selectorOptions = !normalizedKeyword
        ? options
        : options.filter((item) => item.toLowerCase().includes(normalizedKeyword))
      return {
        selectorOptions,
        selectorCommonOptions: [],
        selectorExtraOptions: [],
      }
    }

    if (selectorMode === 'category') {
      const sections = buildCategorySections(
        this.data.categoryOptions,
        selectorSearch,
        this.data.categorySections.common
      )
      return {
        selectorOptions: [],
        selectorCommonOptions: sections.common,
        selectorExtraOptions: sections.extra,
      }
    }

    return {
      selectorOptions: [],
      selectorCommonOptions: [],
      selectorExtraOptions: [],
    }
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

  handleOpenSelector(event) {
    const { mode } = event.currentTarget.dataset
    if (mode === 'idol') {
      const inferred = inferIdolTabState(this.data.idolDirectory, this.data.form.idol)
      const selectorState = this.buildSelectorState({
        selectorMode: 'idol',
        selectorTypeTab: inferred.typeTab,
        selectorRegionTab: inferred.regionTab,
        selectorSearch: '',
      })
      this.setData({
        selectorVisible: true,
        selectorExpanded: false,
        selectorMode: 'idol',
        selectorTitle: '选择担名',
        selectorSearch: '',
        selectorTypeTab: inferred.typeTab,
        selectorRegionTab: inferred.regionTab,
        selectorCustomVisible: inferred.isCustom,
        selectorCustomValue: inferred.isCustom ? this.data.form.idol : '',
        ...selectorState,
      })
      return
    }

    if (mode === 'category') {
      const selectorState = this.buildSelectorState({
        selectorMode: 'category',
        selectorSearch: '',
      })
      this.setData({
        selectorVisible: true,
        selectorExpanded: false,
        selectorMode: 'category',
        selectorTitle: '选择分类',
        selectorSearch: '',
        selectorCustomVisible: false,
        selectorCustomValue: '',
        ...selectorState,
      })
    }
  },

  handleCloseSelector() {
    this.setData({
      selectorVisible: false,
      selectorExpanded: false,
      selectorMode: '',
      selectorTitle: '',
      selectorSearch: '',
      selectorOptions: [],
      selectorCommonOptions: [],
      selectorExtraOptions: [],
      selectorCustomVisible: false,
      selectorCustomValue: '',
      selectorTouchStartY: 0,
      selectorTouchDeltaY: 0,
    })
  },

  handleToggleSelectorExpand() {
    this.setData({
      selectorExpanded: !this.data.selectorExpanded,
    })
  },

  handleSelectorTouchStart(event) {
    const touch = event.touches && event.touches[0]
    if (!touch) {
      return
    }

    this.setData({
      selectorTouchStartY: touch.pageY,
      selectorTouchDeltaY: 0,
    })
  },

  handleSelectorTouchMove(event) {
    const touch = event.touches && event.touches[0]
    if (!touch || !this.data.selectorTouchStartY) {
      return
    }

    this.setData({
      selectorTouchDeltaY: touch.pageY - this.data.selectorTouchStartY,
    })
  },

  handleSelectorTouchEnd() {
    const deltaY = this.data.selectorTouchDeltaY
    if (deltaY <= -28 && !this.data.selectorExpanded) {
      this.setData({ selectorExpanded: true })
    } else if (deltaY >= 28 && this.data.selectorExpanded) {
      this.setData({ selectorExpanded: false })
    }

    this.setData({
      selectorTouchStartY: 0,
      selectorTouchDeltaY: 0,
    })
  },

  handleSelectorSearchInput(event) {
    const selectorSearch = event.detail.value
    this.setData({
      selectorSearch,
      ...this.buildSelectorState({ selectorSearch }),
    })
  },

  handleSelectorTypeTabChange(event) {
    const selectorTypeTab = event.currentTarget.dataset.type
    if (!selectorTypeTab || selectorTypeTab === this.data.selectorTypeTab) {
      return
    }

    this.setData({
      selectorTypeTab,
      selectorCustomVisible: false,
      selectorCustomValue: '',
      ...this.buildSelectorState({ selectorTypeTab }),
    })
  },

  handleSelectorRegionTabChange(event) {
    const selectorRegionTab = event.currentTarget.dataset.region
    if (!selectorRegionTab || selectorRegionTab === this.data.selectorRegionTab) {
      return
    }

    this.setData({
      selectorRegionTab,
      selectorCustomVisible: false,
      selectorCustomValue: '',
      ...this.buildSelectorState({ selectorRegionTab }),
    })
  },

  handleSelectorOptionTap(event) {
    const { value } = event.currentTarget.dataset
    if (!value) {
      return
    }

    if (this.data.selectorMode === 'idol') {
      this.setData({
        'form.idol': value,
      })
    } else if (this.data.selectorMode === 'category') {
      this.setData({
        'form.category': value,
      })
    }
    this.handleCloseSelector()
  },

  handleOpenSelectorCustom() {
    this.setData({
      selectorCustomVisible: true,
      selectorCustomValue: this.data.selectorMode === 'idol' ? this.data.form.idol : '',
    })
  },

  handleSelectorCustomInput(event) {
    this.setData({
      selectorCustomValue: event.detail.value,
    })
  },

  handleApplySelectorCustom() {
    const nextValue = this.data.selectorCustomValue.trim()
    if (!nextValue) {
      wx.showToast({
        title: '请输入担名',
        icon: 'none',
      })
      return
    }

    this.setData({
      'form.idol': nextValue,
    })
    this.handleCloseSelector()
  },

  noop() {
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
    if (!form.idol) return '请选择担名'
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
