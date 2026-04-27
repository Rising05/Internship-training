function deferUiUpdate(callback) {
  if (typeof wx !== 'undefined' && typeof wx.nextTick === 'function') {
    wx.nextTick(callback)
    return
  }

  setTimeout(callback, 0)
}

function getCurrentRoute() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  return currentPage && currentPage.route ? currentPage.route : ''
}

function syncTabBar(route) {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (!currentPage || typeof currentPage.getTabBar !== 'function') {
    return
  }

  const tabBar = currentPage.getTabBar()
  if (!tabBar || typeof tabBar.syncState !== 'function') {
    return
  }

  const summary = (getApp().globalData && getApp().globalData.summary) || {}
  const nextRoute = `/${route || getCurrentRoute()}`
  const nextUnreadCount = summary.unreadCount || summary.unreadConversationCount || 0

  deferUiUpdate(() => {
    const latestPages = getCurrentPages()
    const latestPage = latestPages[latestPages.length - 1]
    if (!latestPage || typeof latestPage.getTabBar !== 'function') {
      return
    }

    const latestTabBar = latestPage.getTabBar()
    if (!latestTabBar || typeof latestTabBar.syncState !== 'function') {
      return
    }

    latestTabBar.syncState({
      route: nextRoute,
      unreadCount: nextUnreadCount,
    })
  })
}

module.exports = {
  getCurrentRoute,
  syncTabBar,
}
