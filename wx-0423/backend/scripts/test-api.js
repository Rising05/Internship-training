const assert = require('node:assert/strict')
const { readDb, writeDb } = require('../src/database')
const {
  TEST_MESSAGE_CONTENT,
  TEST_PRODUCT_NOTE,
  TEST_PRODUCT_TITLE,
  cleanupTestDataSnapshot,
} = require('../src/test-data')

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000'

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(`${response.status} ${data.message || 'Request failed'}`)
  }
  return data
}

async function requestExpectError(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })
  const data = await response.json()
  assert.equal(response.ok, false)
  return {
    statusCode: response.status,
    data,
  }
}

function buildQuery(path, params = {}) {
  const search = new URLSearchParams()

  Object.keys(params).forEach((key) => {
    const value = params[key]
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  })

  const serialized = search.toString()
  return serialized ? `${path}?${serialized}` : path
}

async function resolveTestOpenid() {
  if (process.env.TEST_OPENID) {
    return process.env.TEST_OPENID
  }

  try {
    const session = await request('/auth/wechat/login', {
      method: 'POST',
      body: JSON.stringify({ code: 'dev-code' }),
    })
    assert.equal(session.loggedIn, true)
    assert.ok(session.openid)
    return session.openid
  } catch (error) {
    if (!/WECHAT_LOGIN_FAILED|invalid code/i.test(error.message)) {
      throw error
    }
    return process.env.TEST_OPENID || 'demo-openid'
  }
}

async function run() {
  const headers = {
    'X-Openid': await resolveTestOpenid(),
  }

  const anonymousBootstrap = await request('/app/bootstrap')
  assert.equal(anonymousBootstrap.authSession.loggedIn, false)
  assert.equal(anonymousBootstrap.profile, null)
  assert.equal(anonymousBootstrap.summary.favoriteCount, 0)
  assert.equal(anonymousBootstrap.summary.unreadCount, 0)

  const anonymousHome = await request('/home?pageIndex=1&pageSize=6')
  assert.ok(Array.isArray(anonymousHome.items))
  assert.ok(anonymousHome.items.length > 0)
  assert.ok(anonymousHome.items.every((item) => item.isFavorite === false))

  const bootstrap = await request('/app/bootstrap', { headers })
  assert.ok(bootstrap.profile.nickname)
  assert.ok(typeof bootstrap.summary.favoriteCount === 'number')

  const home = await request('/home?pageIndex=1&pageSize=6', { headers })
  assert.ok(Array.isArray(home.items))
  assert.ok(home.items.length > 0)

  const firstPage = await request(buildQuery('/home', {
    pageIndex: 1,
    pageSize: 2,
  }), { headers })
  const secondPage = await request(buildQuery('/home', {
    pageIndex: 2,
    pageSize: 2,
  }), { headers })
  assert.equal(firstPage.items.length, 2)
  assert.equal(secondPage.items.length, 2)
  assert.equal(
    firstPage.items.filter((item) => secondPage.items.some((candidate) => candidate.id === item.id)).length,
    0
  )

  const categoryHome = await request(buildQuery('/home', {
    pageIndex: 1,
    pageSize: 20,
    activeCategory: '小卡',
  }), { headers })
  assert.ok(categoryHome.matchedCount < categoryHome.totalCount)
  assert.ok(categoryHome.items.length > 0)
  assert.ok(categoryHome.items.every((item) => item.category === '小卡'))

  const idolHome = await request(buildQuery('/home', {
    pageIndex: 1,
    pageSize: 20,
    activeGroup: '时代少年团',
    activeMember: '刘耀文',
  }), { headers })
  assert.ok(idolHome.items.length > 0)
  assert.ok(idolHome.items.every((item) => item.idolGroup.includes('时代少年团')))
  assert.ok(idolHome.items.every((item) => item.idolMember.includes('刘耀文')))

  const tagKeywordHome = await request(buildQuery('/home', {
    pageIndex: 1,
    pageSize: 20,
    keyword: '包邮可议',
  }), { headers })
  assert.ok(tagKeywordHome.items.some((item) => (item.tags || []).includes('包邮可议')))

  const noteKeywordHome = await request(buildQuery('/home', {
    pageIndex: 1,
    pageSize: 20,
    keyword: '非偏可换',
  }), { headers })
  assert.ok(noteKeywordHome.items.some((item) => String(item.note || '').includes('非偏可换')))

  const resetHome = await request(buildQuery('/home', {
    pageIndex: 1,
    pageSize: 2,
  }), { headers })
  assert.deepEqual(
    resetHome.items.map((item) => item.id),
    firstPage.items.map((item) => item.id)
  )
  assert.equal(resetHome.hasMore, firstPage.hasMore)

  const firstProductId = home.items[0].id
  const anonymousDetail = await request(`/products/${firstProductId}`)
  assert.equal(anonymousDetail.id, firstProductId)
  assert.equal(anonymousDetail.isFavorite, false)
  assert.equal(anonymousDetail.isOwner, false)

  const detail = await request(`/products/${firstProductId}`, { headers })
  assert.equal(detail.id, firstProductId)
  assert.ok(Array.isArray(detail.policies))
  assert.ok(Array.isArray(detail.relatedProducts))
  assert.ok(typeof detail.statusLabel === 'string')

  const anonymousFavorite = await requestExpectError(`/favorites/products/${firstProductId}/toggle`, {
    method: 'POST',
  })
  assert.equal(anonymousFavorite.statusCode, 401)
  assert.equal(anonymousFavorite.data.code, 'AUTH_REQUIRED')

  const anonymousPublishMeta = await requestExpectError('/publish/meta')
  assert.equal(anonymousPublishMeta.statusCode, 401)
  assert.equal(anonymousPublishMeta.data.code, 'AUTH_REQUIRED')

  const anonymousMessages = await requestExpectError('/messages?tab=conversation')
  assert.equal(anonymousMessages.statusCode, 401)
  assert.equal(anonymousMessages.data.code, 'AUTH_REQUIRED')

  const anonymousProfile = await requestExpectError('/profile')
  assert.equal(anonymousProfile.statusCode, 401)
  assert.equal(anonymousProfile.data.code, 'AUTH_REQUIRED')

  const anonymousOrders = await requestExpectError('/orders')
  assert.equal(anonymousOrders.statusCode, 401)
  assert.equal(anonymousOrders.data.code, 'AUTH_REQUIRED')

  const anonymousWallet = await requestExpectError('/wallet')
  assert.equal(anonymousWallet.statusCode, 401)
  assert.equal(anonymousWallet.data.code, 'AUTH_REQUIRED')

  const anonymousAddresses = await requestExpectError('/addresses')
  assert.equal(anonymousAddresses.statusCode, 401)
  assert.equal(anonymousAddresses.data.code, 'AUTH_REQUIRED')

  const anonymousReviews = await requestExpectError('/reviews/me')
  assert.equal(anonymousReviews.statusCode, 401)
  assert.equal(anonymousReviews.data.code, 'AUTH_REQUIRED')

  const toggle = await request(`/favorites/products/${firstProductId}/toggle`, {
    method: 'POST',
    headers,
  })
  assert.ok(typeof toggle.isFavorite === 'boolean')

  const publishMeta = await request('/publish/meta', { headers })
  assert.ok(Array.isArray(publishMeta.conditionOptions))

  const created = await request('/products', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: TEST_PRODUCT_TITLE,
      idolType: 'group',
      idolGroup: 'IVE',
      idolMember: '张元英',
      idolDisplayName: 'IVE · 张元英',
      category: '小卡',
      price: '15',
      quantity: '1',
      tradeType: '出物',
      condition: '全新',
      shippingFee: '6',
      note: TEST_PRODUCT_NOTE,
      images: ['https://dummyimage.com/1080x1080/f2dce8/7d5f69.png&text=test'],
    }),
  })
  assert.equal(created.success, true)
  assert.ok(created.product.id)

  const updated = await request(`/products/${created.product.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      title: `${TEST_PRODUCT_TITLE} 更新版`,
      price: '18',
      note: `${TEST_PRODUCT_NOTE} updated`,
    }),
  })
  assert.equal(updated.success, true)
  assert.equal(updated.product.title, `${TEST_PRODUCT_TITLE} 更新版`)
  assert.equal(updated.product.price, 18)

  const reserved = await request(`/products/${created.product.id}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      status: 'reserved',
    }),
  })
  assert.equal(reserved.success, true)
  assert.equal(reserved.product.status, 'reserved')

  const sold = await request(`/products/${created.product.id}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      status: 'sold',
    }),
  })
  assert.equal(sold.success, true)
  assert.equal(sold.product.status, 'sold')

  const messages = await request('/messages?tab=conversation', { headers })
  assert.ok(Array.isArray(messages.list))
  assert.ok(messages.list.length > 0)
  assert.ok(typeof messages.summary.unreadCount === 'number')
  assert.equal(
    messages.summary.unreadCount,
    messages.summary.unreadDetail.conversation + messages.summary.unreadDetail.trade + messages.summary.unreadDetail.system
  )

  const firstConversation = messages.list.find((item) => item.unread > 0) || messages.list[0]
  const unreadBeforeRead = firstConversation.unread
  const conversationBefore = await request(`/conversations/${firstConversation.id}`, { headers })
  assert.equal(conversationBefore.id, firstConversation.id)
  assert.ok(Array.isArray(conversationBefore.messages))
  assert.ok(typeof conversationBefore.summary.unreadCount === 'number')

  const latestMessage = conversationBefore.messages[conversationBefore.messages.length - 1]
  if (latestMessage) {
    assert.equal(firstConversation.content, latestMessage.type === 'product' ? '发来了一张商品卡片' : latestMessage.content)
    assert.equal(firstConversation.time, latestMessage.time || '刚刚')
  }

  const messagesAfterRead = await request('/messages?tab=conversation', { headers })
  const readConversation = messagesAfterRead.list.find((item) => item.id === firstConversation.id)
  assert.ok(readConversation)
  assert.equal(readConversation.unread, 0)

  const summaryAfterRead = await request('/navigation/summary', { headers })
  assert.equal(
    summaryAfterRead.unreadCount,
    summaryAfterRead.unreadDetail.conversation + summaryAfterRead.unreadDetail.trade + summaryAfterRead.unreadDetail.system
  )
  if (unreadBeforeRead > 0) {
    assert.ok(summaryAfterRead.unreadDetail.conversation <= messages.summary.unreadDetail.conversation - unreadBeforeRead)
  }

  const conversationId = firstConversation.id

  const sent = await request(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: TEST_MESSAGE_CONTENT }),
  })
  assert.equal(sent.success, true)
  assert.ok(sent.thread.messages.some((item) => item.content === TEST_MESSAGE_CONTENT))
  assert.ok(typeof sent.summary.unreadCount === 'number')

  const messagesAfterSend = await request('/messages?tab=conversation', { headers })
  assert.equal(messagesAfterSend.list[0].id, conversationId)
  assert.equal(messagesAfterSend.list[0].content, TEST_MESSAGE_CONTENT)
  assert.equal(messagesAfterSend.list[0].time, '刚刚')

  const profile = await request('/profile', { headers })
  assert.ok(Array.isArray(profile.latestPublished))

  const orderSummary = await request('/orders/summary', { headers })
  assert.ok(typeof orderSummary.totalCount === 'number')
  assert.ok(Array.isArray(orderSummary.statuses))
  assert.ok(orderSummary.statuses.some((item) => item.key === 'pending-pay'))

  const pendingOrders = await request('/orders?status=pending-pay', { headers })
  assert.equal(pendingOrders.activeStatus, 'pending-pay')
  assert.ok(Array.isArray(pendingOrders.list))
  assert.ok(pendingOrders.list.every((item) => item.status === 'pending-pay'))

  const allOrders = await request('/orders?status=all', { headers })
  assert.equal(allOrders.activeStatus, 'all')
  assert.ok(allOrders.list.length >= pendingOrders.list.length)

  const wallet = await request('/wallet', { headers })
  assert.ok(typeof wallet.balance === 'number')
  assert.ok(Array.isArray(wallet.bills))

  const addresses = await request('/addresses', { headers })
  assert.ok(Array.isArray(addresses.list))
  assert.ok(addresses.list.some((item) => item.isDefault))

  const reviews = await request('/reviews/me', { headers })
  assert.ok(reviews.stats)
  assert.ok(typeof reviews.stats.averageScore === 'number')
  assert.ok(Array.isArray(reviews.list))

  const cleared = await request('/profile/recent-views', {
    method: 'DELETE',
    headers,
  })
  assert.equal(cleared.success, true)

  const deleted = await request(`/products/${created.product.id}`, {
    method: 'DELETE',
    headers,
  })
  assert.equal(deleted.success, true)

  const summary = await request('/navigation/summary', { headers })
  assert.ok(typeof summary.unreadConversationCount === 'number')
  assert.ok(typeof summary.unreadCount === 'number')
  assert.deepEqual(Object.keys(summary.unreadDetail).sort(), ['conversation', 'system', 'trade'])

  console.log('API checks passed')
}

async function cleanup() {
  const current = await readDb()
  const result = cleanupTestDataSnapshot(current)
  await writeDb(result.snapshot)
}

run()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await cleanup()
    } catch (error) {
      console.error(`Cleanup failed: ${error.message}`)
      process.exitCode = 1
    } finally {
      process.exit(process.exitCode || 0)
    }
  })
