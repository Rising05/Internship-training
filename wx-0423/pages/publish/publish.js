const services = require('../../services/index')
const { getCurrentRoute, syncTabBar } = require('../../utils/tabbar')
const { inferRegionTab, getMemberOptions } = require('../../utils/idol')

const IDOL_TYPE_TABS = [
  { key: 'group', label: '团体' },
  { key: 'solo', label: '个人' },
]
const IDOL_REGION_TABS = [
  { key: 'kpop', label: 'KPOP' },
  { key: 'jpop', label: 'JPOP' },
  { key: 'cpop', label: '内娱' },
]
const MAX_PRODUCT_IMAGES = 9
const MAX_PRODUCT_TITLE_LENGTH = 60
const MAX_PRODUCT_NOTE_LENGTH = 500
const MAX_PRODUCT_PRICE = 999999
const MAX_PRODUCT_QUANTITY = 99
const MAX_SHIPPING_FEE = 99999
const VALIDATION_FIELD_ORDER = [
  'images',
  'title',
  'price',
  'quantity',
  'idolDisplayName',
  'category',
  'shippingFee',
  'note',
]

function getIdolOptionsByTab(directory, typeTab, regionTab) {
  if (!directory || !directory[typeTab] || !directory[typeTab][regionTab]) {
    return []
  }
  return directory[typeTab][regionTab]
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

function buildIdolDisplayName(idolType, idolGroup, idolMember, soloName) {
  if (idolType === 'solo') {
    return soloName || ''
  }
  if (idolMember) {
    return `${idolGroup} · ${idolMember}`
  }
  return idolGroup || ''
}

function parseOptionalNumber(value) {
  const normalized = String(value == null ? '' : value).trim()
  if (!normalized) {
    return null
  }

  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : Number.NaN
}

function buildValidationErrors(form = {}, imageList = []) {
  const errors = {}
  const title = String(form.title || '').trim()
  const price = parseOptionalNumber(form.price)
  const quantity = parseOptionalNumber(form.quantity)
  const shippingFee = parseOptionalNumber(form.shippingFee)
  const note = String(form.note || '')

  if (!Array.isArray(imageList) || !imageList.length) {
    errors.images = '请至少上传 1 张商品图片'
  } else if (imageList.length > MAX_PRODUCT_IMAGES) {
    errors.images = `最多上传 ${MAX_PRODUCT_IMAGES} 张商品图片`
  }

  if (!title) {
    errors.title = '请填写商品标题'
  } else if (title.length > MAX_PRODUCT_TITLE_LENGTH) {
    errors.title = `标题最多 ${MAX_PRODUCT_TITLE_LENGTH} 个字`
  }

  if (!form.idolDisplayName) {
    errors.idolDisplayName = '请选择担名'
  }

  if (!form.category) {
    errors.category = '请选择商品分类'
  }

  if (price === null) {
    errors.price = '请填写价格'
  } else if (Number.isNaN(price) || price <= 0) {
    errors.price = '价格必须大于 0'
  } else if (price > MAX_PRODUCT_PRICE) {
    errors.price = `价格不能超过 ${MAX_PRODUCT_PRICE}`
  }

  if (quantity === null) {
    errors.quantity = '请填写数量'
  } else if (Number.isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    errors.quantity = '数量必须是大于 0 的整数'
  } else if (quantity > MAX_PRODUCT_QUANTITY) {
    errors.quantity = `数量不能超过 ${MAX_PRODUCT_QUANTITY}`
  }

  if (shippingFee !== null) {
    if (Number.isNaN(shippingFee) || shippingFee < 0) {
      errors.shippingFee = '运费不能小于 0'
    } else if (shippingFee > MAX_SHIPPING_FEE) {
      errors.shippingFee = `运费不能超过 ${MAX_SHIPPING_FEE}`
    }
  }

  if (note.length > MAX_PRODUCT_NOTE_LENGTH) {
    errors.note = `描述最多 ${MAX_PRODUCT_NOTE_LENGTH} 个字`
  }

  return errors
}

function getFirstValidationMessage(errors = {}) {
  const firstField = VALIDATION_FIELD_ORDER.find((field) => errors[field])
  return firstField ? errors[firstField] : ''
}

function getBackendField(error) {
  const details = error && error.responseData && error.responseData.details
  if (!details || !details.field) {
    return ''
  }

  return String(details.field)
}

function getDisplayErrorMessage(error, fallback = '提交失败，请稍后再试') {
  if (!error) {
    return fallback
  }

  return error.message
    || error.errMsg
    || (error.responseData && error.responseData.message)
    || fallback
}

Page({
  data: {
    loading: true,
    submitting: false,
    hasSubmitted: false,
    tips: [],
    idolDirectory: {},
    memberDirectory: {},
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
    selectorMemberOptions: [],
    selectorGroupValue: '',
    selectorMemberValue: '',
    selectorCommonOptions: [],
    selectorExtraOptions: [],
    selectorCustomVisible: false,
    selectorCustomKind: '',
    selectorCustomValue: '',
    selectorTouchStartY: 0,
    selectorTouchDeltaY: 0,
    conditionOptions: [],
    tradeTypeOptions: [],
    imageList: [],
    errors: {},
    form: {
      title: '',
      idolType: '',
      idolGroup: '',
      idolMember: '',
      idolDisplayName: '',
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
    this._pageActive = true
    this._publishRequestToken = 0
    this.loadPublishPage()
  },

  onShow() {
    syncTabBar(getCurrentRoute())
  },

  onUnload() {
    this._pageActive = false
    this._publishRequestToken += 1
  },

  async loadPublishPage() {
    const requestToken = ++this._publishRequestToken
    const data = await services.getPublishPageData()
    if (!this._pageActive || requestToken !== this._publishRequestToken) {
      return
    }
    this.setData({
      loading: false,
      tips: data.tips,
      idolDirectory: data.idolDirectory,
      memberDirectory: data.memberDirectory,
      idolOptions: data.idolOptions,
      categoryOptions: data.categoryOptions,
      categorySections: data.categorySections,
      conditionOptions: data.conditionOptions,
      tradeTypeOptions: data.tradeTypeOptions,
      errors: {},
      hasSubmitted: false,
      'form.idolType': '',
      'form.idolGroup': '',
      'form.idolMember': '',
      'form.idolDisplayName': '',
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
    const selectorGroupValue = typeof overrides.selectorGroupValue === 'string'
      ? overrides.selectorGroupValue
      : this.data.selectorGroupValue

    if (selectorMode === 'idol') {
      const options = getIdolOptionsByTab(this.data.idolDirectory, selectorTypeTab, selectorRegionTab)
      const memberOptions = selectorTypeTab === 'group'
        ? getMemberOptions(this.data.memberDirectory, selectorGroupValue)
        : []
      const normalizedKeyword = selectorSearch.trim().toLowerCase()
      const selectorOptions = !normalizedKeyword
        ? options
        : options.filter((item) => item.toLowerCase().includes(normalizedKeyword))
      const selectorMemberOptions = !normalizedKeyword
        ? memberOptions
        : memberOptions.filter((item) => item.toLowerCase().includes(normalizedKeyword))

      return {
        selectorOptions,
        selectorMemberOptions,
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
        selectorMemberOptions: [],
        selectorCommonOptions: sections.common,
        selectorExtraOptions: sections.extra,
      }
    }

    return {
      selectorOptions: [],
      selectorMemberOptions: [],
      selectorCommonOptions: [],
      selectorExtraOptions: [],
    }
  },

  applyIdolSelection(selection) {
    const idolType = selection.idolType
    const idolGroup = selection.idolGroup || ''
    const idolMember = selection.idolMember || ''
    const idolDisplayName = buildIdolDisplayName(
      idolType,
      idolGroup,
      idolMember,
      selection.idolDisplayName || ''
    )

    this.applyDataPatch({
      'form.idolType': idolType,
      'form.idolGroup': idolGroup,
      'form.idolMember': idolMember,
      'form.idolDisplayName': idolDisplayName,
    }, { clearFields: ['idolDisplayName'] })
  },

  getNextFormFromPatch(patch = {}) {
    const nextForm = { ...this.data.form }

    Object.keys(patch).forEach((key) => {
      if (key.startsWith('form.')) {
        nextForm[key.slice(5)] = patch[key]
      }
    })

    return nextForm
  },

  applyDataPatch(patch = {}, options = {}) {
    const { clearFields = [] } = options
    const nextPatch = { ...patch }

    if (this.data.hasSubmitted) {
      nextPatch.errors = buildValidationErrors(
        this.getNextFormFromPatch(patch),
        Object.prototype.hasOwnProperty.call(patch, 'imageList') ? patch.imageList : this.data.imageList
      )
    } else {
      clearFields.forEach((field) => {
        nextPatch[`errors.${field}`] = ''
      })
    }

    this.setData(nextPatch)
  },

  handleChooseImage() {
    const remain = MAX_PRODUCT_IMAGES - this.data.imageList.length
    if (remain <= 0) {
      return
    }

    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      success: ({ tempFilePaths }) => {
        this.applyDataPatch({
          imageList: this.data.imageList.concat(tempFilePaths),
        }, { clearFields: ['images'] })
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
    this.applyDataPatch({
      imageList: this.data.imageList.filter((_, currentIndex) => currentIndex !== index),
    }, { clearFields: ['images'] })
  },

  handleTextInput(event) {
    const { field } = event.currentTarget.dataset
    this.applyDataPatch({
      [`form.${field}`]: event.detail.value,
    }, { clearFields: [field] })
  },

  handleOpenSelector(event) {
    const { mode } = event.currentTarget.dataset
    if (mode === 'idol') {
      const selectorTypeTab = this.data.form.idolType || 'group'
      const sourceValue = selectorTypeTab === 'solo' ? this.data.form.idolDisplayName : this.data.form.idolGroup
      const selectorRegionTab = inferRegionTab(this.data.idolDirectory, selectorTypeTab, sourceValue)
      const selectorGroupValue = selectorTypeTab === 'group' ? this.data.form.idolGroup : ''
      const selectorMemberValue = selectorTypeTab === 'group' ? this.data.form.idolMember : ''
      const selectorState = this.buildSelectorState({
        selectorMode: 'idol',
        selectorTypeTab,
        selectorRegionTab,
        selectorSearch: '',
        selectorGroupValue,
      })
      const currentTopLevelOptions = getIdolOptionsByTab(this.data.idolDirectory, selectorTypeTab, selectorRegionTab)
      const memberOptions = getMemberOptions(this.data.memberDirectory, selectorGroupValue)
      const selectorCustomVisible = selectorTypeTab === 'solo'
        ? !!this.data.form.idolDisplayName && !currentTopLevelOptions.includes(this.data.form.idolDisplayName)
        : (
          (!!selectorGroupValue && !currentTopLevelOptions.includes(selectorGroupValue))
          || (!!selectorMemberValue && !memberOptions.includes(selectorMemberValue))
        )
      const selectorCustomValue = selectorTypeTab === 'solo'
        ? (selectorCustomVisible ? this.data.form.idolDisplayName : '')
        : (selectorMemberValue || (selectorCustomVisible ? selectorGroupValue : ''))

      this.setData({
        selectorVisible: true,
        selectorExpanded: false,
        selectorMode: 'idol',
        selectorTitle: '选择担名',
        selectorSearch: '',
        selectorTypeTab,
        selectorRegionTab,
        selectorGroupValue,
        selectorMemberValue,
        selectorCustomVisible,
        selectorCustomValue,
        selectorCustomKind: selectorTypeTab === 'solo' ? 'solo' : (selectorGroupValue ? 'member' : 'group'),
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
        selectorGroupValue: '',
        selectorMemberValue: '',
        selectorCustomVisible: false,
        selectorCustomKind: '',
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
      selectorMemberOptions: [],
      selectorGroupValue: '',
      selectorMemberValue: '',
      selectorCommonOptions: [],
      selectorExtraOptions: [],
      selectorCustomVisible: false,
      selectorCustomKind: '',
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
      selectorRegionTab: selectorTypeTab === 'solo'
        ? inferRegionTab(this.data.idolDirectory, 'solo', this.data.form.idolDisplayName)
        : inferRegionTab(this.data.idolDirectory, 'group', this.data.form.idolGroup),
      selectorGroupValue: selectorTypeTab === 'group' ? this.data.form.idolGroup : '',
      selectorMemberValue: selectorTypeTab === 'group' ? this.data.form.idolMember : '',
      selectorCustomVisible: false,
      selectorCustomKind: '',
      selectorCustomValue: '',
      ...this.buildSelectorState({
        selectorTypeTab,
        selectorRegionTab: selectorTypeTab === 'solo'
          ? inferRegionTab(this.data.idolDirectory, 'solo', this.data.form.idolDisplayName)
          : inferRegionTab(this.data.idolDirectory, 'group', this.data.form.idolGroup),
        selectorGroupValue: selectorTypeTab === 'group' ? this.data.form.idolGroup : '',
      }),
    })
  },

  handleSelectorRegionTabChange(event) {
    const selectorRegionTab = event.currentTarget.dataset.region
    if (!selectorRegionTab || selectorRegionTab === this.data.selectorRegionTab) {
      return
    }

    this.setData({
      selectorRegionTab,
      selectorGroupValue: this.data.selectorTypeTab === 'group' ? '' : this.data.selectorGroupValue,
      selectorMemberValue: '',
      selectorCustomVisible: false,
      selectorCustomKind: '',
      selectorCustomValue: '',
      ...this.buildSelectorState({
        selectorRegionTab,
        selectorGroupValue: this.data.selectorTypeTab === 'group' ? '' : this.data.selectorGroupValue,
      }),
    })
  },

  handleSelectorOptionTap(event) {
    const { value } = event.currentTarget.dataset
    if (!value) {
      return
    }

    if (this.data.selectorMode === 'idol') {
      if (this.data.selectorTypeTab === 'solo') {
        this.applyIdolSelection({
          idolType: 'solo',
          idolDisplayName: value,
        })
        this.handleCloseSelector()
        return
      }

      this.setData({
        selectorGroupValue: value,
        selectorMemberValue: '',
        selectorCustomVisible: false,
        selectorCustomKind: '',
        selectorCustomValue: '',
        ...this.buildSelectorState({
          selectorGroupValue: value,
          selectorMemberValue: '',
        }),
      })
      return
    }

    if (this.data.selectorMode === 'category') {
      this.applyDataPatch({
        'form.category': value,
      }, { clearFields: ['category'] })
      this.handleCloseSelector()
    }
  },

  handleSelectorMemberTap(event) {
    const nextMember = event.currentTarget.dataset.value || ''
    if (!this.data.selectorGroupValue) {
      return
    }

    this.applyIdolSelection({
      idolType: 'group',
      idolGroup: this.data.selectorGroupValue,
      idolMember: nextMember,
    })
    this.handleCloseSelector()
  },

  handleOpenSelectorCustom(event) {
    const kind = event.currentTarget.dataset.kind || 'solo'
    let selectorCustomValue = ''
    if (this.data.selectorMode === 'idol') {
      if (kind === 'solo') {
        selectorCustomValue = this.data.form.idolType === 'solo' ? this.data.form.idolDisplayName : ''
      } else if (kind === 'group') {
        selectorCustomValue = this.data.selectorGroupValue && !this.data.selectorOptions.includes(this.data.selectorGroupValue)
          ? this.data.selectorGroupValue
          : ''
      } else {
        selectorCustomValue = this.data.selectorMemberValue
      }
    }

    this.setData({
      selectorCustomVisible: true,
      selectorCustomKind: kind,
      selectorCustomValue,
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
        title: this.data.selectorCustomKind === 'member' ? '请输入成员名' : '请输入担名',
        icon: 'none',
      })
      return
    }

    if (this.data.selectorMode === 'idol') {
      if (this.data.selectorCustomKind === 'solo') {
        this.applyIdolSelection({
          idolType: 'solo',
          idolDisplayName: nextValue,
        })
      } else if (this.data.selectorCustomKind === 'group') {
        this.applyIdolSelection({
          idolType: 'group',
          idolGroup: nextValue,
          idolMember: '',
        })
      } else if (this.data.selectorGroupValue) {
        this.applyIdolSelection({
          idolType: 'group',
          idolGroup: this.data.selectorGroupValue,
          idolMember: nextValue,
        })
      }
    }
    this.handleCloseSelector()
  },

  noop() {
  },

  handleTradeTypeSelect(event) {
    this.applyDataPatch({
      'form.tradeType': event.currentTarget.dataset.value,
    })
  },

  handleConditionSelect(event) {
    this.applyDataPatch({
      'form.condition': event.currentTarget.dataset.value,
    })
  },

  validateForm() {
    const errors = buildValidationErrors(this.data.form, this.data.imageList)
    return {
      errors,
      firstMessage: getFirstValidationMessage(errors),
    }
  },

  async handleSubmit() {
    const { errors, firstMessage } = this.validateForm()
    if (this.data.submitting || firstMessage) {
      if (firstMessage) {
        this.setData({
          hasSubmitted: true,
          errors,
        })
        wx.showToast({
          title: firstMessage,
          icon: 'none',
        })
      }
      return
    }

    this.setData({
      submitting: true,
      hasSubmitted: true,
      errors,
    })

    try {
      await services.submitProduct({
        ...this.data.form,
        images: this.data.imageList,
      })
      if (!this._pageActive) {
        return
      }
      await getApp().syncGlobalData()
      if (!this._pageActive) {
        return
      }
      this.setData({ submitting: false })
      wx.showToast({
        title: '商品发布成功',
        icon: 'success',
      })
      wx.switchTab({
        url: '/pages/profile/profile',
      })
    } catch (error) {
      if (!this._pageActive) {
        return
      }

      const message = getDisplayErrorMessage(error)
      const backendField = getBackendField(error)
      const nextPatch = {
        submitting: false,
      }
      if (backendField) {
        nextPatch[`errors.${backendField}`] = message
      }
      this.setData(nextPatch)
      wx.showToast({
        title: message,
        icon: 'none',
      })
    }
  },
})
