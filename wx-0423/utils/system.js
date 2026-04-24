function getNavMetrics() {
  const systemInfo = wx.getSystemInfoSync()
  const statusBarHeight = systemInfo.statusBarHeight || 20
  const navBarHeight = 44
  const navHeight = statusBarHeight + navBarHeight

  return {
    statusBarHeight,
    navBarHeight,
    navHeight,
    safeAreaBottom: systemInfo.safeArea ? Math.max(systemInfo.screenHeight - systemInfo.safeArea.bottom, 0) : 0,
  }
}

module.exports = {
  getNavMetrics,
}
