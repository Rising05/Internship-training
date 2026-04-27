const services = require('../../services/index')
const { getCurrentRoute, syncTabBar } = require('../../utils/tabbar')
const { getMemberOptions } = require('../../utils/idol')
const { requireLogin } = require('../../utils/auth')

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

function isBannerWithinSchedule(banner = {}) {
  const now = Date.now()
  const startAt = banner.startAt ? new Date(banner.startAt).getTime() : null
  const endAt = banner.endAt ? new Date(banner.endAt).getTime() : null

  if (Number.isFinite(startAt) && startAt > now) {
    return false
  }

  if (Number.isFinite(endAt) && endAt < now) {
    return false
  }

  return true
}

function normalizeBanners(banners = []) {
  if (!Array.isArray(banners)) {
    return []
  }

  return banners
    .filter((item) => item && item.enabled !== false && item.image && isBannerWithinSchedule(item))
    .sort((prev, next) => (prev.sort || 0) - (next.sort || 0))
    .map((item) => ({
      id: item.id,
      title: item.title || '',
      subtitle: item.subtitle || '',
      image: item.image,
      imagePosition: item.imagePosition || 'center center',
      targetType: item.targetType || 'navigate',
      targetUrl: item.targetUrl || '',
      ctaText: item.ctaText || '',
      analyticsName: item.analyticsName || item.id || '',
    }))
}

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

function getCurrentIdolSelection(idolTypeTab, activeGroup, activeSolo) {
  return idolTypeTab === 'group' ? activeGroup : activeSolo
}

function getMemberButtonText(activeMember) {
  return activeMember && activeMember !== '全部' ? activeMember : '选成员'
}

function normalizeFilterText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getFeedLabel(feedModes, activeFeed) {
  const matched = (feedModes || []).find((item) => item.key === activeFeed)
  return matched ? matched.label : ''
}

function buildFilterSummary(state = {}) {
  const summary = []
  const keyword = normalizeFilterText(state.keyword)
  const activeCategory = normalizeFilterText(state.activeCategory)
  const activeGroup = normalizeFilterText(state.activeGroup)
  const activeMember = normalizeFilterText(state.activeMember)
  const activeSolo = normalizeFilterText(state.activeSolo)

  if (keyword) {
    summary.push(`关键词：${keyword}`)
  }

  if (activeCategory && activeCategory !== '全部') {
    summary.push(`分类：${activeCategory}`)
  }

  if (state.idolTypeTab === 'group') {
    if (activeGroup && activeGroup !== '全部') {
      summary.push(`团体：${activeGroup}`)
    }

    if (activeGroup && activeGroup !== '全部' && activeMember && activeMember !== '全部') {
      summary.push(`成员：${activeMember}`)
    }
  } else if (activeSolo && activeSolo !== '全部') {
    summary.push(`担名：${activeSolo}`)
  }

  if (state.activeFeed === 'hot') {
    summary.push(`排序：${getFeedLabel(state.feedModes, state.activeFeed) || '推荐商品'}`)
  }

  return summary
}

function buildResultState(state = {}) {
  const matchedCount = typeof state.matchedCount === 'number' ? state.matchedCount : 0
  const totalCount = typeof state.totalCount === 'number' ? state.totalCount : 0
  const filterSummaryTags = buildFilterSummary(state)
  const hasActiveFilters = filterSummaryTags.length > 0

  return {
    hasActiveFilters,
    filterSummaryTags,
    resultSummaryText: hasActiveFilters
      ? `共命中 ${matchedCount} 条`
      : `共 ${totalCount} 条在售商品`,
    resultSummaryHint: hasActiveFilters
      ? `当前筛选：${filterSummaryTags.join(' · ')}`
      : '可按分类、担名、成员和关键词组合筛选',
    emptyStateDescription: hasActiveFilters
      ? `当前筛选为 ${filterSummaryTags.join(' · ')}，可以更换条件后继续浏览。`
      : '你可以更换担位、分类或关键词后继续浏览。',
  }
}

function mergeProductList(existingList = [], nextItems = []) {
  const merged = existingList.slice()
  const existingIds = new Set(existingList.map((item) => item.id))

  nextItems.forEach((item) => {
    if (!existingIds.has(item.id)) {
      existingIds.add(item.id)
      merged.push(item)
    }
  })

  return merged
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    keyword: '',
    draftKeyword: '',
    banners: [],
    activeBannerIndex: 0,
    bannerFallbackVisible: false,
    quickEntries: [],
    searchSuggestions: [],
    idolDirectory: {},
    memberDirectory: {},
    idolOptions: [],
    idolTypeTabs: IDOL_TYPE_TABS,
    idolRegionTabs: IDOL_REGION_TABS,
    idolTypeTab: 'group',
    idolRegionTab: 'kpop',
    visibleIdolOptions: [],
    currentIdolSelection: '全部',
    memberButtonText: '选成员',
    canExpandIdolList: false,
    isIdolListExpanded: false,
    categoryOptions: [],
    feedModes: [],
    visibleQuickEntries: [],
    hiddenQuickEntryCount: 0,
    activeGroup: '全部',
    activeMember: '全部',
    activeSolo: '全部',
    activeCategory: '全部',
    activeFeed: 'latest',
    isCategoryExpanded: false,
    showCustomIdolInput: false,
    customIdolDraft: '',
    memberSelectorVisible: false,
    memberSelectorOptions: [],
    showCustomMemberInput: false,
    customMemberDraft: '',
    pageIndex: 1,
    pageSize: 6,
    totalCount: 0,
    matchedCount: 0,
    hasMore: true,
    productList: [],
    leftColumn: [],
    rightColumn: [],
    hasActiveFilters: false,
    filterSummaryTags: [],
    resultSummaryText: '',
    resultSummaryHint: '',
    emptyStateDescription: '你可以更换担位、分类或关键词后继续浏览。',
  },

  onLoad() {
    this._pageActive = true
    this._hasShownOnce = false
    this._homeRequestToken = 0
    this.loadHome({ reset: true })
  },

  onShow() {
    if (!this._hasShownOnce) {
      this._hasShownOnce = true
      return
    }
    syncTabBar(getCurrentRoute())
    this.loadHome({ reset: false, silent: true, refreshAllLoaded: true })
  },

  onUnload() {
    this._pageActive = false
    this._homeRequestToken += 1
  },

  getExpandStatePayload(nextState = {}) {
    const quickEntries = nextState.quickEntries || this.data.quickEntries
    const activeCategory = typeof nextState.activeCategory === 'string'
      ? nextState.activeCategory
      : this.data.activeCategory
    const isCategoryExpanded = typeof nextState.isCategoryExpanded === 'boolean'
      ? nextState.isCategoryExpanded
      : this.data.isCategoryExpanded
    const idolDirectory = nextState.idolDirectory || this.data.idolDirectory
    const idolTypeTab = nextState.idolTypeTab || this.data.idolTypeTab
    const idolRegionTab = nextState.idolRegionTab || this.data.idolRegionTab
    const activeGroup = typeof nextState.activeGroup === 'string' ? nextState.activeGroup : this.data.activeGroup
    const activeSolo = typeof nextState.activeSolo === 'string' ? nextState.activeSolo : this.data.activeSolo
    const activeMember = typeof nextState.activeMember === 'string' ? nextState.activeMember : this.data.activeMember

    return {
      visibleQuickEntries: buildVisibleQuickEntries(quickEntries, isCategoryExpanded, activeCategory),
      hiddenQuickEntryCount: Math.max(0, quickEntries.length - DEFAULT_QUICK_ENTRY_COUNT),
      visibleIdolOptions: buildVisibleIdolOptions(idolDirectory, idolTypeTab, idolRegionTab),
      canExpandIdolList: buildVisibleIdolOptions(idolDirectory, idolTypeTab, idolRegionTab).length - 1 > IDOL_COLLAPSED_THRESHOLD,
      currentIdolSelection: getCurrentIdolSelection(idolTypeTab, activeGroup, activeSolo),
      memberButtonText: getMemberButtonText(activeMember),
    }
  },

  async loadHome(options = {}) {
    const requestToken = ++this._homeRequestToken
    const nextPageIndex = typeof options.pageIndex === 'number'
      ? options.pageIndex
      : (options.reset ? 1 : this.data.pageIndex)
    const requestedKeyword = typeof options.keyword === 'string' ? options.keyword : this.data.keyword
    const effectivePageIndex = options.refreshAllLoaded ? 1 : nextPageIndex
    const effectivePageSize = options.refreshAllLoaded
      ? Math.max(this.data.pageSize, this.data.pageSize * Math.max(this.data.pageIndex, 1))
      : this.data.pageSize

    if (!options.silent) {
      this.setData({
        loading: !!options.reset,
        loadingMore: !options.reset && !options.refreshAllLoaded,
      })
    }

    const result = await services.getHomeData({
      keyword: requestedKeyword,
      idolTypeTab: this.data.idolTypeTab,
      activeGroup: this.data.activeGroup,
      activeMember: this.data.activeMember,
      activeSolo: this.data.activeSolo,
      activeCategory: this.data.activeCategory,
      activeFeed: this.data.activeFeed,
      pageIndex: effectivePageIndex,
      pageSize: effectivePageSize,
    })
    if (!this._pageActive || requestToken !== this._homeRequestToken) {
      return
    }

    const nextProductList = options.reset || options.refreshAllLoaded
      ? result.items.slice()
      : mergeProductList(this.data.productList, result.items)
    const resolvedPageIndex = options.refreshAllLoaded
      ? Math.max(1, Math.ceil(nextProductList.length / this.data.pageSize))
      : nextPageIndex
    const columns = splitColumns(nextProductList)
    const normalizedBanners = normalizeBanners(result.banners)
    const expandState = this.getExpandStatePayload({
      quickEntries: result.quickEntries,
      idolDirectory: result.idolDirectory,
      activeCategory: this.data.activeCategory,
      isCategoryExpanded: this.data.isCategoryExpanded,
      idolTypeTab: this.data.idolTypeTab,
      idolRegionTab: this.data.idolRegionTab,
      activeGroup: this.data.activeGroup,
      activeSolo: this.data.activeSolo,
      activeMember: this.data.activeMember,
    })
    const resultState = buildResultState({
      keyword: requestedKeyword,
      activeCategory: this.data.activeCategory,
      idolTypeTab: this.data.idolTypeTab,
      activeGroup: this.data.activeGroup,
      activeMember: this.data.activeMember,
      activeSolo: this.data.activeSolo,
      activeFeed: this.data.activeFeed,
      feedModes: result.feedModes,
      totalCount: result.totalCount,
      matchedCount: result.matchedCount,
    })

    this.setData({
      loading: false,
      loadingMore: false,
      keyword: requestedKeyword,
      banners: normalizedBanners,
      activeBannerIndex: 0,
      bannerFallbackVisible: !normalizedBanners.length,
      quickEntries: result.quickEntries,
      searchSuggestions: result.searchSuggestions,
      idolDirectory: result.idolDirectory,
      memberDirectory: result.memberDirectory,
      idolOptions: result.idolOptions,
      categoryOptions: result.categoryOptions,
      feedModes: result.feedModes,
      totalCount: result.totalCount,
      matchedCount: result.matchedCount,
      hasMore: result.hasMore,
      pageIndex: resolvedPageIndex,
      productList: nextProductList,
      leftColumn: columns.leftColumn,
      rightColumn: columns.rightColumn,
      ...expandState,
      ...resultState,
    })
    getApp().syncGlobalData()

    if (options.scrollToFeed && this._pageActive && requestToken === this._homeRequestToken) {
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
    const nextValue = event.detail.value
    if (this.data.idolTypeTab === 'group') {
      this.setData({
        activeGroup: nextValue,
        activeMember: '全部',
        showCustomIdolInput: false,
        customIdolDraft: '',
        showCustomMemberInput: false,
        customMemberDraft: '',
        memberSelectorVisible: false,
        ...this.getExpandStatePayload({
          activeGroup: nextValue,
          activeMember: '全部',
        }),
      })
    } else {
      this.setData({
        activeSolo: nextValue,
        showCustomIdolInput: false,
        customIdolDraft: '',
        ...this.getExpandStatePayload({ activeSolo: nextValue }),
      })
    }
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
    const currentSelection = getCurrentIdolSelection(nextTypeTab, this.data.activeGroup, this.data.activeSolo)
    const keepCustom = isCustomIdolValue(this.data.idolOptions, currentSelection)
    const nextSelection = keepCustom || nextVisibleIdolOptions.includes(currentSelection) ? currentSelection : '全部'
    const nextActiveMember = nextTypeTab === 'group' && nextSelection === this.data.activeGroup ? this.data.activeMember : '全部'

    this.setData({
      idolTypeTab: nextTypeTab,
      activeGroup: nextTypeTab === 'group' ? nextSelection : this.data.activeGroup,
      activeSolo: nextTypeTab === 'solo' ? nextSelection : this.data.activeSolo,
      activeMember: nextActiveMember,
      isIdolListExpanded: false,
      showCustomIdolInput: false,
      customIdolDraft: '',
      memberSelectorVisible: false,
      showCustomMemberInput: false,
      customMemberDraft: '',
      ...this.getExpandStatePayload({
        idolTypeTab: nextTypeTab,
        activeGroup: nextTypeTab === 'group' ? nextSelection : this.data.activeGroup,
        activeSolo: nextTypeTab === 'solo' ? nextSelection : this.data.activeSolo,
        activeMember: nextActiveMember,
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
    const currentSelection = getCurrentIdolSelection(this.data.idolTypeTab, this.data.activeGroup, this.data.activeSolo)
    const keepCustom = isCustomIdolValue(this.data.idolOptions, currentSelection)
    const nextSelection = keepCustom || nextVisibleIdolOptions.includes(currentSelection) ? currentSelection : '全部'
    const nextActiveMember = this.data.idolTypeTab === 'group' && nextSelection === this.data.activeGroup ? this.data.activeMember : '全部'

    this.setData({
      idolRegionTab: nextRegionTab,
      activeGroup: this.data.idolTypeTab === 'group' ? nextSelection : this.data.activeGroup,
      activeSolo: this.data.idolTypeTab === 'solo' ? nextSelection : this.data.activeSolo,
      activeMember: nextActiveMember,
      isIdolListExpanded: false,
      memberSelectorVisible: false,
      showCustomMemberInput: false,
      customMemberDraft: '',
      ...this.getExpandStatePayload({
        idolRegionTab: nextRegionTab,
        activeGroup: this.data.idolTypeTab === 'group' ? nextSelection : this.data.activeGroup,
        activeSolo: this.data.idolTypeTab === 'solo' ? nextSelection : this.data.activeSolo,
        activeMember: nextActiveMember,
      }),
    })
    this.loadHome({ reset: true })
  },

  handleOpenCustomIdol() {
    const currentValue = getCurrentIdolSelection(this.data.idolTypeTab, this.data.activeGroup, this.data.activeSolo)
    const nextDraft = this.data.idolOptions.includes(currentValue) ? '' : currentValue
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
    const nextValue = this.data.customIdolDraft.trim()
    if (!nextValue) {
      wx.showToast({
        title: '请输入担名',
        icon: 'none',
      })
      return
    }

    if (this.data.idolTypeTab === 'group') {
      this.setData({
        activeGroup: nextValue,
        activeMember: '全部',
        showCustomIdolInput: true,
        customIdolDraft: nextValue,
        ...this.getExpandStatePayload({
          activeGroup: nextValue,
          activeMember: '全部',
        }),
      })
    } else {
      this.setData({
        activeSolo: nextValue,
        showCustomIdolInput: true,
        customIdolDraft: nextValue,
        ...this.getExpandStatePayload({ activeSolo: nextValue }),
      })
    }
    this.loadHome({ reset: true })
  },

  handleOpenMemberSelector() {
    if (this.data.idolTypeTab !== 'group' || this.data.activeGroup === '全部') {
      return
    }

    const memberSelectorOptions = getMemberOptions(this.data.memberDirectory, this.data.activeGroup)
    const nextDraft = memberSelectorOptions.includes(this.data.activeMember) || this.data.activeMember === '全部'
      ? ''
      : this.data.activeMember

    this.setData({
      memberSelectorVisible: true,
      memberSelectorOptions,
      showCustomMemberInput: !!nextDraft,
      customMemberDraft: nextDraft,
    })
  },

  handleCloseMemberSelector() {
    this.setData({
      memberSelectorVisible: false,
      showCustomMemberInput: false,
      customMemberDraft: '',
    })
  },

  handleSelectMember(event) {
    const nextMember = event.currentTarget.dataset.member || '全部'
    this.setData({
      activeMember: nextMember,
      memberSelectorVisible: false,
      showCustomMemberInput: false,
      customMemberDraft: '',
      ...this.getExpandStatePayload({ activeMember: nextMember }),
    })
    this.loadHome({ reset: true })
  },

  handleOpenCustomMember() {
    const nextDraft = this.data.memberSelectorOptions.includes(this.data.activeMember) || this.data.activeMember === '全部'
      ? ''
      : this.data.activeMember
    this.setData({
      showCustomMemberInput: true,
      customMemberDraft: nextDraft,
    })
  },

  handleCustomMemberInput(event) {
    this.setData({
      customMemberDraft: event.detail.value,
    })
  },

  handleApplyCustomMember() {
    const nextMember = this.data.customMemberDraft.trim()
    if (!nextMember) {
      wx.showToast({
        title: '请输入成员名',
        icon: 'none',
      })
      return
    }

    this.setData({
      activeMember: nextMember,
      memberSelectorVisible: false,
      showCustomMemberInput: false,
      customMemberDraft: nextMember,
      ...this.getExpandStatePayload({ activeMember: nextMember }),
    })
    this.loadHome({ reset: true })
  },

  handleFeedSwitch(event) {
    this.setData({ activeFeed: event.currentTarget.dataset.feed })
    this.loadHome({ reset: true, scrollToFeed: true })
  },

  async handleFavorite(event) {
    if (!requireLogin({
      targetType: 'back',
      reason: '登录后即可同步收藏商品',
    })) {
      return
    }

    await services.toggleProductFavorite(event.detail.id)
    getApp().syncGlobalData()
    this.loadHome({ reset: false, silent: true, refreshAllLoaded: true })
  },

  handleOpenProduct(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.detail.id}`,
    })
  },

  handleBannerChange(event) {
    this.setData({
      activeBannerIndex: event.detail.current || 0,
    })
  },

  handleBannerDotTap(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (!Number.isInteger(index) || index < 0 || index >= this.data.banners.length) {
      return
    }

    this.setData({
      activeBannerIndex: index,
    })
  },

  handleBannerTap(event) {
    const index = Number(event.currentTarget.dataset.index || 0)
    const banner = this.data.banners[index]
    if (!banner || !banner.targetUrl) {
      return
    }

    if (banner.targetType === 'switchTab') {
      if (banner.targetUrl !== '/pages/index/index') {
        const allowAccess = requireLogin({
          targetType: 'tab',
          targetUrl: banner.targetUrl,
          reason: '登录后即可继续使用该功能',
        })
        if (!allowAccess) {
          return
        }
      }

      wx.switchTab({
        url: banner.targetUrl,
      })
      return
    }

    wx.navigateTo({
      url: banner.targetUrl,
    })
  },

  handleBannerImageError() {
    this.setData({
      bannerFallbackVisible: true,
    })
  },

  handleGoPublish() {
    const allowAccess = requireLogin({
      targetType: 'tab',
      targetUrl: '/pages/publish/publish',
      reason: '登录后才能发布商品',
    })
    if (!allowAccess) {
      return
    }

    wx.switchTab({
      url: '/pages/publish/publish',
    })
  },

  handleResetFilters() {
    this.setData({
      keyword: '',
      draftKeyword: '',
      activeGroup: '全部',
      activeMember: '全部',
      activeSolo: '全部',
      activeCategory: '全部',
      activeFeed: 'latest',
      idolTypeTab: 'group',
      idolRegionTab: 'kpop',
      isIdolListExpanded: false,
      showCustomIdolInput: false,
      customIdolDraft: '',
      memberSelectorVisible: false,
      showCustomMemberInput: false,
      customMemberDraft: '',
      pageIndex: 1,
      productList: [],
      ...this.getExpandStatePayload({
        activeGroup: '全部',
        activeMember: '全部',
        activeSolo: '全部',
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

    this.loadHome({ reset: false, pageIndex: this.data.pageIndex + 1 })
  },
})
