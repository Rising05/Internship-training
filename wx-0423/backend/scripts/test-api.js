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
  const detail = await request(`/products/${firstProductId}`, { headers })
  assert.equal(detail.id, firstProductId)
  assert.ok(Array.isArray(detail.policies))

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

  const messages = await request('/messages?tab=conversation', { headers })
  assert.ok(Array.isArray(messages.list))
  assert.ok(messages.list.length > 0)

  const conversationId = messages.list[0].id
  const thread = await request(`/conversations/${conversationId}`, { headers })
  assert.equal(thread.id, conversationId)

  const sent = await request(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: TEST_MESSAGE_CONTENT }),
  })
  assert.equal(sent.success, true)
  assert.ok(sent.thread.messages.some((item) => item.content === TEST_MESSAGE_CONTENT))

  const profile = await request('/profile', { headers })
  assert.ok(Array.isArray(profile.latestPublished))

  const cleared = await request('/profile/recent-views', {
    method: 'DELETE',
    headers,
  })
  assert.equal(cleared.success, true)

  const summary = await request('/navigation/summary', { headers })
  assert.ok(typeof summary.unreadConversationCount === 'number')

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
