const TEST_NAMESPACE = '[smoke-test]'
const TEST_PRODUCT_TITLE = `${TEST_NAMESPACE} 接口测试商品`
const TEST_MESSAGE_CONTENT = `${TEST_NAMESPACE} 接口测试消息`
const TEST_PRODUCT_NOTE = `${TEST_NAMESPACE} 接口测试发布`
const LEGACY_TEST_PRODUCT_TITLES = new Set([
  '接口测试商品',
  '云数据库验收商品',
  'A',
])
const LEGACY_TEST_MESSAGE_CONTENTS = new Set([
  '接口测试消息',
  'CloudBase smoke test',
])

function isNamespacedValue(value = '') {
  return String(value).trim().startsWith(TEST_NAMESPACE)
}

function isTestProduct(product = {}) {
  return isNamespacedValue(product.title)
    || LEGACY_TEST_PRODUCT_TITLES.has(String(product.title || '').trim())
}

function isTestMessage(message = {}) {
  return isNamespacedValue(message.content)
    || LEGACY_TEST_MESSAGE_CONTENTS.has(String(message.content || '').trim())
}

function rebuildUserStats(snapshot) {
  snapshot.users = (snapshot.users || []).map((user) => ({
    ...user,
    publishedCount: (snapshot.products || []).filter((item) => item.ownerUserId === user.id && item.status !== 'hidden').length,
    favoriteCount: (snapshot.favorites || []).filter((item) => item.userId === user.id).length,
    updatedAt: new Date().toISOString(),
  }))
}

function cleanupTestDataSnapshot(snapshot) {
  const deletedProducts = (snapshot.products || []).filter((item) => isTestProduct(item))
  const deletedProductIds = new Set(deletedProducts.map((item) => item.id))
  const deletedMessages = (snapshot.messages || []).filter((item) => isTestMessage(item))

  snapshot.products = (snapshot.products || []).filter((item) => !deletedProductIds.has(item.id))
  snapshot.favorites = (snapshot.favorites || []).filter((item) => !deletedProductIds.has(item.productId))
  snapshot.recentViews = (snapshot.recentViews || []).filter((item) => !deletedProductIds.has(item.productId))
  snapshot.messages = (snapshot.messages || []).filter((item) => !isTestMessage(item))
  rebuildUserStats(snapshot)

  return {
    snapshot,
    deletedProducts: deletedProducts.map((item) => ({ id: item.id, title: item.title })),
    deletedMessages: deletedMessages.map((item) => ({
      id: item.id,
      conversationId: item.conversationId,
      content: item.content,
    })),
  }
}

module.exports = {
  TEST_NAMESPACE,
  TEST_PRODUCT_TITLE,
  TEST_PRODUCT_NOTE,
  TEST_MESSAGE_CONTENT,
  cleanupTestDataSnapshot,
  isTestMessage,
  isTestProduct,
}
