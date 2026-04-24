const services = require('../../services/index')
const { getCurrentRoute, syncTabBar } = require('../../utils/tabbar')

const DEFAULT_QUICK_ENTRY_COUNT = 4
const DEFAULT_IDOL_OPTION_COUNT = 6

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

function buildVisibleIdolOptions(options, expanded, activeIdol) {
  const visible = expanded ? options.slice() : options.slice(0, DEFAULT_IDOL_OPTION_COUNT)
  if (activeIdol && activeIdol !== '全部' && !options.includes(activeIdol) && !visible.includes(activeIdol)) {
    visible.push(activeIdol)
  }
  return visible
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
    idolOptions: [],
    visibleIdolOptions: [],
    hiddenIdolCount: 0,
    categoryOptions: [],
    feedModes: [],
    visibleQuickEntries: [],
    hiddenQuickEntryCount: 0,
    activeIdol: '全部',
    activeCategory: '全部',
    activeFeed: 'latest',
    isCategoryExpanded: false,
    isIdolExpanded: false,
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
    const idolOptions = nextState.idolOptions || this.data.idolOptions
    const activeIdol = typeof nextState.activeIdol === 'string' ? nextState.activeIdol : this.data.activeIdol
    const activeCategory = typeof nextState.activeCategory === 'string'
      ? nextState.activeCategory
      : this.data.activeCategory
    const isCategoryExpanded = typeof nextState.isCategoryExpanded === 'boolean'
      ? nextState.isCategoryExpanded
      : this.data.isCategoryExpanded
    const isIdolExpanded = typeof nextState.isIdolExpanded === 'boolean'
      ? nextState.isIdolExpanded
      : this.data.isIdolExpanded

    return {
      visibleQuickEntries: buildVisibleQuickEntries(quickEntries, isCategoryExpanded, activeCategory),
      hiddenQuickEntryCount: Math.max(0, quickEntries.length - DEFAULT_QUICK_ENTRY_COUNT),
      visibleIdolOptions: buildVisibleIdolOptions(idolOptions, isIdolExpanded, activeIdol),
      hiddenIdolCount: Math.max(0, idolOptions.length - DEFAULT_IDOL_OPTION_COUNT),
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
      idolOptions: result.idolOptions,
      activeIdol: this.data.activeIdol,
      activeCategory: this.data.activeCategory,
      isCategoryExpanded: this.data.isCategoryExpanded,
      isIdolExpanded: this.data.isIdolExpanded,
    })

    this.setData({
      loading: false,
      loadingMore: false,
      keyword: typeof options.keyword === 'string' ? options.keyword : this.data.keyword,
      hero: result.hero,
      quickEntries: result.quickEntries,
      searchSuggestions: result.searchSuggestions,
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
      ...this.getExpandStatePayload({ activeIdol: nextActiveIdol }),
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

  handleToggleIdolExpand() {
    const isIdolExpanded = !this.data.isIdolExpanded
    this.setData({
      isIdolExpanded,
      showCustomIdolInput: isIdolExpanded ? this.data.showCustomIdolInput : false,
      ...this.getExpandStatePayload({ isIdolExpanded }),
    })
  },

  handleOpenCustomIdol() {
    const nextDraft = this.data.idolOptions.includes(this.data.activeIdol) ? '' : this.data.activeIdol
    this.setData({
      isIdolExpanded: true,
      showCustomIdolInput: true,
      customIdolDraft: nextDraft,
      ...this.getExpandStatePayload({ isIdolExpanded: true }),
    })
  },

  handleCustomIdolInput(event) {
    this.setData({ customIdolDraft: event.detail.value })
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
      isIdolExpanded: true,
      showCustomIdolInput: true,
      customIdolDraft: nextActiveIdol,
      ...this.getExpandStatePayload({
        activeIdol: nextActiveIdol,
        isIdolExpanded: true,
      }),
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
      showCustomIdolInput: false,
      customIdolDraft: '',
      pageIndex: 1,
      ...this.getExpandStatePayload({
        activeIdol: '全部',
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
