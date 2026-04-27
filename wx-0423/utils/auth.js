const { getAuthSession, clearAuthSession } = require('./storage')

const LOGIN_PAGE_ROUTE = '/pages/auth/login'
const anonymousSummary = {
  favoriteCount: 0,
  recentCount: 0,
  unreadCount: 0,
  unreadConversationCount: 0,
  unreadDetail: {
    conversation: 0,
    trade: 0,
    system: 0,
  },
  publishedCount: 0,
}

let pendingAuthTarget = null
let loginNavigationPending = false

function isLoggedIn() {
  const session = getAuthSession()
  return !!(session && session.loggedIn && session.openid)
}

function getCurrentPage() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  return pages[pages.length - 1] || null
}

function buildQueryString(options = {}) {
  const pairs = Object.keys(options).reduce((result, key) => {
    const value = options[key]
    if (value === undefined || value === null || value === '') {
      return result
    }

    result.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    return result
  }, [])

  return pairs.length ? `?${pairs.join('&')}` : ''
}

function buildCurrentPageUrl() {
  const currentPage = getCurrentPage()
  if (!currentPage || !currentPage.route) {
    return '/pages/index/index'
  }

  return `/${currentPage.route}${buildQueryString(currentPage.options || {})}`
}

function syncAnonymousAppState() {
  const app = typeof getApp === 'function' ? getApp() : null
  if (!app || !app.globalData) {
    return
  }

  app.globalData.authSession = getAuthSession()
  app.globalData.profile = null
  if (typeof app.applySummary === 'function') {
    app.applySummary(anonymousSummary)
    return
  }
  app.globalData.summary = anonymousSummary
}

function clearAuthState() {
  clearAuthSession()
  syncAnonymousAppState()
}

function getPendingAuthTarget() {
  return pendingAuthTarget
}

function clearPendingAuthTarget() {
  pendingAuthTarget = null
  loginNavigationPending = false
}

function markLoginPageReady() {
  loginNavigationPending = false
}

function requireLogin(options = {}) {
  if (isLoggedIn()) {
    return true
  }

  const targetType = options.targetType || 'back'
  const reason = options.reason || ''
  const currentUrl = buildCurrentPageUrl()
  pendingAuthTarget = {
    targetType,
    targetUrl: options.targetUrl || (targetType === 'back' ? currentUrl : ''),
    reason,
  }

  const currentPage = getCurrentPage()
  if (currentPage && `/${currentPage.route}` === LOGIN_PAGE_ROUTE) {
    return false
  }

  if (loginNavigationPending) {
    return false
  }

  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  const hasLoginPage = pages.some((page) => `/${page.route}` === LOGIN_PAGE_ROUTE)
  if (hasLoginPage) {
    return false
  }

  loginNavigationPending = true
  wx.navigateTo({
    url: `${LOGIN_PAGE_ROUTE}${buildQueryString({ reason })}`,
  })
  return false
}

function handleAuthSuccess() {
  const target = pendingAuthTarget
  pendingAuthTarget = null
  loginNavigationPending = false

  if (!target) {
    wx.switchTab({
      url: '/pages/index/index',
    })
    return
  }

  if (target.targetType === 'tab' && target.targetUrl) {
    wx.switchTab({
      url: target.targetUrl,
    })
    return
  }

  if (target.targetType === 'redirect' && target.targetUrl) {
    wx.redirectTo({
      url: target.targetUrl,
    })
    return
  }

  if (target.targetType === 'reLaunch' && target.targetUrl) {
    wx.reLaunch({
      url: target.targetUrl,
    })
    return
  }

  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  if (pages.length > 1) {
    wx.navigateBack()
    return
  }

  wx.switchTab({
    url: '/pages/index/index',
  })
}

module.exports = {
  LOGIN_PAGE_ROUTE,
  isLoggedIn,
  buildCurrentPageUrl,
  getPendingAuthTarget,
  clearPendingAuthTarget,
  markLoginPageReady,
  clearAuthState,
  requireLogin,
  handleAuthSuccess,
}
