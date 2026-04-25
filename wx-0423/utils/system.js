function getNavMetrics() {
  const windowInfo = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : {}
  const statusBarHeight = windowInfo.statusBarHeight || 20
  const navBarHeight = 44
  const navHeight = statusBarHeight + navBarHeight
  const safeAreaBottom = windowInfo.safeArea
    ? Math.max((windowInfo.screenHeight || 0) - windowInfo.safeArea.bottom, 0)
    : 0

  return {
    statusBarHeight,
    navBarHeight,
    navHeight,
    safeAreaBottom,
  }
}

module.exports = {
  getNavMetrics,
}
