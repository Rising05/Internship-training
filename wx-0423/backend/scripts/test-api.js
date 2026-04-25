const assert = require('node:assert/strict')

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

async function resolveTestOpenid() {
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
      title: '接口测试商品',
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
      note: '接口测试发布',
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
    body: JSON.stringify({ content: '接口测试消息' }),
  })
  assert.equal(sent.success, true)
  assert.ok(sent.thread.messages.some((item) => item.content === '接口测试消息'))

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

run().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
