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

Page({
  data: {
    loading: true,
    submitting: false,
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

    this.setData({
      'form.idolType': idolType,
      'form.idolGroup': idolGroup,
      'form.idolMember': idolMember,
      'form.idolDisplayName': idolDisplayName,
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
      this.setData({
        'form.category': value,
      })
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
    if (!form.idolDisplayName) return '请选择担名'
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
  },
})
