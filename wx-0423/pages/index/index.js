const services = require('../../services/index')
const { getCurrentRoute, syncTabBar } = require('../../utils/tabbar')

const DEFAULT_QUICK_ENTRY_COUNT = 4
const IDOL_COLLAPSED_THRESHOLD = 10
const IDOL_TYPE_TABS = [
  { key: 'group', label: '团体' },
  { key: 'solo', label: '个人' },
]
const IDOL_REGION_TABS = [
  { key: 'kpop', label: 'KPOP' },
  { key: 'jpop', label: 'JPOP' },
  { key: 'cpop', label: '内娱' },
]

function splitColumns(list) {
  const leftColumn = []
  const rightColumn = []

  list.forEach((item, index) => {
    if (index % 2 === 0) {
      leftColumn.push(item)
      return
    }
    rightColumn.push(item)
  })

  return { leftColumn, rightColumn }
}

function buildVisibleQuickEntries(entries, expanded, activeCategory) {
  const visible = expanded ? entries.slice() : entries.slice(0, DEFAULT_QUICK_ENTRY_COUNT)
  if (activeCategory && activeCategory !== '全部' && !visible.some((item) => item.category === activeCategory)) {
    const activeEntry = entries.find((item) => item.category === activeCategory)
    if (activeEntry) {
      visible.push(activeEntry)
    }
  }
  return visible
}

function buildVisibleIdolOptions(directory, typeTab, regionTab) {
  if (!directory || !directory[typeTab] || !directory[typeTab][regionTab]) {
    return ['全部']
  }
  return ['全部'].concat(directory[typeTab][regionTab])
}

function isCustomIdolValue(idolOptions, value) {
  return !!value && value !== '全部' && !idolOptions.includes(value)
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    keyword: '',
    draftKeyword: '',
    hero: {},
    quickEntries: [],
    searchSuggestions: [],
    idolDirectory: {},
    idolOptions: [],
    idolTypeTabs: IDOL_TYPE_TABS,
    idolRegionTabs: IDOL_REGION_TABS,
    idolTypeTab: 'group',
    idolRegionTab: 'kpop',
    visibleIdolOptions: [],
    canExpandIdolList: false,
    isIdolListExpanded: false,
    categoryOptions: [],
    feedModes: [],
    visibleQuickEntries: [],
    hiddenQuickEntryCount: 0,
    activeIdol: '全部',
    activeCategory: '全部',
    activeFeed: 'latest',
    isCategoryExpanded: false,
    showCustomIdolInput: false,
    customIdolDraft: '',
    pageIndex: 1,
    pageSize: 6,
    totalCount: 0,
    matchedCount: 0,
    hasMore: true,
    leftColumn: [],
    rightColumn: [],
  },

  onLoad() {
    this.loadHome({ reset: true })
  },

  onShow() {
    syncTabBar(getCurrentRoute())
    this.loadHome({ reset: false, silent: true })
  },

  getExpandStatePayload(nextState = {}) {
    const quickEntries = nextState.quickEntries || this.data.quickEntries
    const activeIdol = typeof nextState.activeIdol === 'string' ? nextState.activeIdol : this.data.activeIdol
    const activeCategory = typeof nextState.activeCategory === 'string'
      ? nextState.activeCategory
      : this.data.activeCategory
    const isCategoryExpanded = typeof nextState.isCategoryExpanded === 'boolean'
      ? nextState.isCategoryExpanded
      : this.data.isCategoryExpanded
    const idolDirectory = nextState.idolDirectory || this.data.idolDirectory
    const idolTypeTab = nextState.idolTypeTab || this.data.idolTypeTab
    const idolRegionTab = nextState.idolRegionTab || this.data.idolRegionTab

    return {
      visibleQuickEntries: buildVisibleQuickEntries(quickEntries, isCategoryExpanded, activeCategory),
      hiddenQuickEntryCount: Math.max(0, quickEntries.length - DEFAULT_QUICK_ENTRY_COUNT),
      visibleIdolOptions: buildVisibleIdolOptions(idolDirectory, idolTypeTab, idolRegionTab),
      canExpandIdolList: buildVisibleIdolOptions(idolDirectory, idolTypeTab, idolRegionTab).length - 1 > IDOL_COLLAPSED_THRESHOLD,
    }
  },

  async loadHome(options = {}) {
    const nextPageIndex = typeof options.pageIndex === 'number'
      ? options.pageIndex
      : (options.reset ? 1 : this.data.pageIndex)
    if (!options.silent) {
      this.setData({
        loading: options.reset,
        loadingMore: !options.reset,
      })
    }

    const result = await services.getHomeData({
      keyword: typeof options.keyword === 'string' ? options.keyword : this.data.keyword,
      activeIdol: this.data.activeIdol,
      activeCategory: this.data.activeCategory,
      activeFeed: this.data.activeFeed,
      pageIndex: nextPageIndex,
      pageSize: this.data.pageSize,
    })
    const columns = splitColumns(result.items)
    const expandState = this.getExpandStatePayload({
      quickEntries: result.quickEntries,
      idolDirectory: result.idolDirectory,
      activeIdol: this.data.activeIdol,
      activeCategory: this.data.activeCategory,
      isCategoryExpanded: this.data.isCategoryExpanded,
      idolTypeTab: this.data.idolTypeTab,
      idolRegionTab: this.data.idolRegionTab,
    })

    this.setData({
      loading: false,
      loadingMore: false,
      keyword: typeof options.keyword === 'string' ? options.keyword : this.data.keyword,
      hero: result.hero,
      quickEntries: result.quickEntries,
      searchSuggestions: result.searchSuggestions,
      idolDirectory: result.idolDirectory,
      idolOptions: result.idolOptions,
      categoryOptions: result.categoryOptions,
      feedModes: result.feedModes,
      totalCount: result.totalCount,
      matchedCount: result.matchedCount,
      hasMore: result.hasMore,
      pageIndex: nextPageIndex,
      leftColumn: columns.leftColumn,
      rightColumn: columns.rightColumn,
      ...expandState,
    })
    getApp().syncGlobalData()

    if (options.scrollToFeed) {
      this.scrollToFeed()
    }
  },

  scrollToFeed() {
    wx.pageScrollTo({
      selector: '#feed-section',
      duration: 280,
      offsetTop: 12,
    })
  },

  handleSearchInput(event) {
    this.setData({ draftKeyword: event.detail.value })
  },

  handleSubmitSearch(event) {
    const nextKeyword = typeof event?.detail?.value === 'string'
      ? event.detail.value
      : this.data.draftKeyword

    this.setData({
      draftKeyword: nextKeyword,
    })
    this.loadHome({ reset: true, scrollToFeed: !!nextKeyword.trim(), keyword: nextKeyword })
  },

  handleIdolSelect(event) {
    const nextActiveIdol = event.detail.value
    this.setData({
      activeIdol: nextActiveIdol,
      showCustomIdolInput: false,
      customIdolDraft: '',
    })
    this.loadHome({ reset: true })
  },

  handleSuggestionTap(event) {
    const nextKeyword = event.currentTarget.dataset.keyword
    this.setData({
      draftKeyword: nextKeyword,
    })
    this.loadHome({ reset: true, scrollToFeed: true, keyword: nextKeyword })
  },

  handleQuickEntryTap(event) {
    const nextActiveCategory = event.currentTarget.dataset.category
    const resolvedCategory = this.data.activeCategory === nextActiveCategory ? '全部' : nextActiveCategory
    this.setData({
      activeCategory: resolvedCategory,
      ...this.getExpandStatePayload({ activeCategory: resolvedCategory }),
    })
    this.loadHome({ reset: true })
  },

  handleToggleCategoryExpand() {
    const isCategoryExpanded = !this.data.isCategoryExpanded
    this.setData({
      isCategoryExpanded,
      ...this.getExpandStatePayload({ isCategoryExpanded }),
    })
  },

  handleIdolTypeTabChange(event) {
    const nextTypeTab = event.currentTarget.dataset.type
    if (!nextTypeTab || nextTypeTab === this.data.idolTypeTab) {
      return
    }

    const nextVisibleIdolOptions = buildVisibleIdolOptions(
      this.data.idolDirectory,
      nextTypeTab,
      this.data.idolRegionTab
    )
    const keepCustom = isCustomIdolValue(this.data.idolOptions, this.data.activeIdol)
    const nextActiveIdol = keepCustom || nextVisibleIdolOptions.includes(this.data.activeIdol)
      ? this.data.activeIdol
      : '全部'

    this.setData({
      idolTypeTab: nextTypeTab,
      activeIdol: nextActiveIdol,
      isIdolListExpanded: false,
      ...this.getExpandStatePayload({
        idolTypeTab: nextTypeTab,
        activeIdol: nextActiveIdol,
      }),
    })
    this.loadHome({ reset: true })
  },

  handleIdolRegionTabChange(event) {
    const nextRegionTab = event.currentTarget.dataset.region
    if (!nextRegionTab || nextRegionTab === this.data.idolRegionTab) {
      return
    }

    const nextVisibleIdolOptions = buildVisibleIdolOptions(
      this.data.idolDirectory,
      this.data.idolTypeTab,
      nextRegionTab
    )
    const keepCustom = isCustomIdolValue(this.data.idolOptions, this.data.activeIdol)
    const nextActiveIdol = keepCustom || nextVisibleIdolOptions.includes(this.data.activeIdol)
      ? this.data.activeIdol
      : '全部'

    this.setData({
      idolRegionTab: nextRegionTab,
      activeIdol: nextActiveIdol,
      isIdolListExpanded: false,
      ...this.getExpandStatePayload({
        idolRegionTab: nextRegionTab,
        activeIdol: nextActiveIdol,
      }),
    })
    this.loadHome({ reset: true })
  },

  handleOpenCustomIdol() {
    const nextDraft = this.data.idolOptions.includes(this.data.activeIdol) ? '' : this.data.activeIdol
    this.setData({
      showCustomIdolInput: true,
      customIdolDraft: nextDraft,
    })
  },

  handleCustomIdolInput(event) {
    this.setData({ customIdolDraft: event.detail.value })
  },

  handleToggleIdolListExpand() {
    this.setData({
      isIdolListExpanded: !this.data.isIdolListExpanded,
    })
  },

  handleApplyCustomIdol() {
    const nextActiveIdol = this.data.customIdolDraft.trim()
    if (!nextActiveIdol) {
      wx.showToast({
        title: '请输入担名',
        icon: 'none',
      })
      return
    }

    this.setData({
      activeIdol: nextActiveIdol,
      showCustomIdolInput: true,
      customIdolDraft: nextActiveIdol,
    })
    this.loadHome({ reset: true })
  },

  handleFeedSwitch(event) {
    this.setData({ activeFeed: event.currentTarget.dataset.feed })
    this.loadHome({ reset: true, scrollToFeed: true })
  },

  async handleFavorite(event) {
    await services.toggleProductFavorite(event.detail.id)
    getApp().syncGlobalData()
    this.loadHome({ reset: false, silent: true })
  },

  handleOpenProduct(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.detail.id}`,
    })
  },

  handleGoPublish() {
    wx.switchTab({
      url: '/pages/publish/publish',
    })
  },

  handleResetFilters() {
    this.setData({
      keyword: '',
      draftKeyword: '',
      activeIdol: '全部',
      activeCategory: '全部',
      activeFeed: 'latest',
      idolTypeTab: 'group',
      idolRegionTab: 'kpop',
      isIdolListExpanded: false,
      showCustomIdolInput: false,
      customIdolDraft: '',
      pageIndex: 1,
      ...this.getExpandStatePayload({
        activeIdol: '全部',
        idolTypeTab: 'group',
        idolRegionTab: 'kpop',
      }),
    })
    this.loadHome({ reset: true, scrollToFeed: true })
  },

  onPullDownRefresh() {
    this.loadHome({ reset: true }).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) {
      return
    }

    this.loadHome({ pageIndex: this.data.pageIndex + 1 })
  },
})
