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
  tabBar.syncState({
    route: `/${route || getCurrentRoute()}`,
    unreadCount: summary.unreadConversationCount || 0,
  })
}

module.exports = {
  getCurrentRoute,
  syncTabBar,
}
