const tcb = require('@cloudbase/node-sdk')
const { buildInitialDb } = require('./seed')
const { readBackendConfig } = require('./config')

const APP_STATE_COLLECTION = 'app_state'
const COLLECTION_NAMES = {
  users: 'users',
  products: 'products',
  favorites: 'favorites',
  conversations: 'conversations',
  messages: 'messages',
  recentViews: 'recent_views',
  uploads: 'uploads',
  messageReads: 'message_reads',
}
const APP_STATE_DOC_IDS = {
  meta: 'meta',
  dictionaries: 'dictionaries',
  tradeNotifications: 'tradeNotifications',
  systemNotifications: 'systemNotifications',
}
const PAGE_SIZE = 100
const CLOUDBASE_TIMEOUT_MS = Number(process.env.CLOUDBASE_TIMEOUT_MS || 15000)

let cachedEnvKey = ''
let cachedDb = null
let cachedEnsureEnvKey = ''
let cachedEnsurePromise = null

function createConfigError(message) {
  const error = new Error(message)
  error.code = 'CLOUDBASE_CONFIG_MISSING'
  error.statusCode = 500
  return error
}

function createCloudbaseError(code, message, details, statusCode = 502) {
  const error = new Error(message)
  error.code = code
  error.details = details
  error.statusCode = statusCode
  return error
}

function getCloudbaseDb() {
  const config = readBackendConfig()
  const envId = config.cloudbase && config.cloudbase.envId
  const secretId = config.cloudbase && config.cloudbase.secretId
  const secretKey = config.cloudbase && config.cloudbase.secretKey

  if (!envId) {
    throw createConfigError('CLOUDBASE_ENV_ID is required when DATA_PROVIDER=cloudbase')
  }

  if (!secretId || !secretKey) {
    throw createConfigError('CLOUDBASE_SECRET_ID and CLOUDBASE_SECRET_KEY are required when DATA_PROVIDER=cloudbase')
  }

  const envKey = `${envId}:${secretId}:${secretKey}`
  if (!cachedDb || cachedEnvKey !== envKey) {
    cachedEnvKey = envKey
    cachedDb = tcb.init({
      env: envId,
      secretId,
      secretKey,
    }).database()
  }

  return cachedDb
}

function isMissingCollectionError(error) {
  const message = String((error && error.message) || '')
  return /collection/i.test(message) && /(not\s*exist|does\s*not\s*exist|not\s*found)/i.test(message)
}

function isCollectionAlreadyExistsError(error) {
  const message = String((error && error.message) || '')
  return /(already\s*exist|table\s*exist|duplicate|conflict|existed)/i.test(message)
}

function isCloudbaseTimeoutError(error) {
  const message = String((error && error.message) || '')
  return /timeout/i.test(message)
}

function normalizeCloudbaseError(error, action) {
  if (!error) {
    return createCloudbaseError('CLOUDBASE_REQUEST_FAILED', `${action} failed`)
  }

  if (error.code && error.statusCode) {
    return error
  }

  if (isCloudbaseTimeoutError(error)) {
    return createCloudbaseError('CLOUDBASE_TIMEOUT', `${action} timed out`, error.message, 504)
  }

  if (isMissingCollectionError(error)) {
    return createCloudbaseError('CLOUDBASE_RESOURCE_NOT_FOUND', `${action} failed because a collection is missing`, error.message, 404)
  }

  return createCloudbaseError('CLOUDBASE_REQUEST_FAILED', `${action} failed`, error.message, 502)
}

function withCloudbaseTimeout(promise, action) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(createCloudbaseError('CLOUDBASE_TIMEOUT', `${action} timed out`, null, 504))
      }, CLOUDBASE_TIMEOUT_MS)
    }),
  ])
}

async function createCollectionIfNeeded(db, collectionName) {
  try {
    await withCloudbaseTimeout(db.createCollection(collectionName), `create collection ${collectionName}`)
  } catch (error) {
    if (isCollectionAlreadyExistsError(error)) {
      return
    }
    throw normalizeCloudbaseError(error, `create collection ${collectionName}`)
  }
}

async function ensureCloudbaseCollections() {
  const config = readBackendConfig()
  const envKey = [
    config.cloudbase && config.cloudbase.envId,
    config.cloudbase && config.cloudbase.secretId,
    config.cloudbase && config.cloudbase.secretKey,
  ].join(':')

  if (!cachedEnsurePromise || cachedEnsureEnvKey !== envKey) {
    cachedEnsureEnvKey = envKey
    const db = getCloudbaseDb()
    const collectionNames = Object.values(COLLECTION_NAMES).concat(APP_STATE_COLLECTION)
    cachedEnsurePromise = Promise.all(collectionNames.map((name) => createCollectionIfNeeded(db, name)))
  }

  return cachedEnsurePromise
}

async function getCollectionDocuments(db, collectionName) {
  const collection = db.collection(collectionName)
  const documents = []
  let skip = 0

  while (true) {
    try {
      const response = await withCloudbaseTimeout(
        collection.skip(skip).limit(PAGE_SIZE).get(),
        `query collection ${collectionName}`
      )
      const items = (response && response.data) || []
      documents.push(...items)
      if (items.length < PAGE_SIZE) {
        return documents
      }
      skip += items.length
    } catch (error) {
      if (isMissingCollectionError(error)) {
        return []
      }
      throw normalizeCloudbaseError(error, `query collection ${collectionName}`)
    }
  }
}

function createStableId(prefix, ...parts) {
  return [prefix].concat(parts).join(':')
}

function getDocumentId(prefix, value) {
  return String(value || `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`)
}

function deserializeUsers(documents) {
  return documents.map((item) => ({
    id: item._id,
    openid: item.openid,
    nickname: item.nickname || '新用户',
    bio: item.bio || '',
    location: item.location || '',
    publishedCount: Number(item.stats && item.stats.publishedCount) || 0,
    soldCount: Number(item.stats && item.stats.soldCount) || 0,
    favoriteCount: Number(item.stats && item.stats.favoriteCount) || 0,
    dealCount: Number(item.stats && item.stats.dealCount) || 0,
    unionId: item.unionId || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))
}

function serializeUsers(users = []) {
  return users.map((item) => ({
    _id: getDocumentId('user', item.id || item._id),
    openid: item.openid,
    nickname: item.nickname,
    bio: item.bio,
    location: item.location,
    unionId: item.unionId || '',
    stats: {
      publishedCount: Number(item.publishedCount) || 0,
      soldCount: Number(item.soldCount) || 0,
      favoriteCount: Number(item.favoriteCount) || 0,
      dealCount: Number(item.dealCount) || 0,
    },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))
}

function deserializeProducts(documents) {
  return documents.map((item) => ({
    id: item._id,
    title: item.title || '',
    idolType: item.idolType || '',
    idolGroup: item.idolGroup || '',
    idolMember: item.idolMember || '',
    idolDisplayName: item.idolDisplayName || '',
    category: item.category || '',
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 1,
    tradeType: item.tradeType || '出物',
    condition: item.condition || '全新',
    shippingFee: Number(item.shippingFee) || 0,
    note: item.note || '',
    images: Array.isArray(item.images) ? item.images : [],
    seller: item.seller || null,
    ownerUserId: item.sellerId || item.ownerUserId || null,
    sellerId: item.sellerId || item.ownerUserId || null,
    status: item.status || 'active',
    tags: Array.isArray(item.tags) ? item.tags : [],
    isHot: Boolean(item.isHot),
    isLatest: item.isLatest !== false,
    conversationId: item.conversationId || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))
}

function serializeProducts(products = []) {
  return products.map((item) => ({
    _id: getDocumentId('product', item.id || item._id),
    title: item.title,
    idolType: item.idolType,
    idolGroup: item.idolGroup,
    idolMember: item.idolMember,
    idolDisplayName: item.idolDisplayName,
    category: item.category,
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 1,
    tradeType: item.tradeType || '出物',
    condition: item.condition || '全新',
    shippingFee: Number(item.shippingFee) || 0,
    note: item.note || '',
    images: Array.isArray(item.images) ? item.images.slice(0, 9) : [],
    sellerId: item.ownerUserId || item.sellerId || '',
    ownerUserId: item.ownerUserId || item.sellerId || '',
    seller: item.seller || null,
    status: item.status || 'active',
    tags: Array.isArray(item.tags) ? item.tags : [],
    isHot: Boolean(item.isHot),
    isLatest: item.isLatest !== false,
    conversationId: item.conversationId || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))
}

function deserializeFavorites(documents) {
  return documents.map((item) => ({
    id: item._id,
    userId: item.userId,
    productId: item.productId,
    createdAt: item.createdAt,
  }))
}

function serializeFavorites(items = []) {
  return items.map((item) => ({
    _id: getDocumentId('favorite', item.id || createStableId('favorite', item.userId, item.productId)),
    userId: item.userId,
    productId: item.productId,
    createdAt: item.createdAt,
  }))
}

function deserializeConversations(documents) {
  return documents.map((item) => ({
    id: item._id,
    title: item.title || '',
    participantIds: Array.isArray(item.participantIds) ? item.participantIds : [],
    relatedProductId: item.relatedProductId || item.productId || '',
    productId: item.productId || item.relatedProductId || '',
    seedPreview: item.seedPreview || '',
    seedTime: item.seedTime || '',
    seedUnread: Number(item.seedUnread) || 0,
    user: item.user || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))
}

function serializeConversations(items = []) {
  return items.map((item) => ({
    _id: getDocumentId('conversation', item.id || item._id),
    title: item.title || (item.user && item.user.name) || '',
    participantIds: Array.isArray(item.participantIds) ? item.participantIds : [],
    productId: item.productId || item.relatedProductId || '',
    relatedProductId: item.relatedProductId || item.productId || '',
    seedPreview: item.seedPreview || '',
    seedTime: item.seedTime || '',
    seedUnread: Number(item.seedUnread) || 0,
    user: item.user || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))
}

function deserializeMessages(documents) {
  return documents.map((item) => ({
    id: item._id,
    conversationId: item.conversationId,
    fromUserId: item.fromUserId || '',
    from: item.from || item.fromUserId || '',
    type: item.type || 'text',
    content: item.content || '',
    productId: item.productId || '',
    time: item.time || '',
    order: Number(item.order) || 0,
    readStatus: item.readStatus || '',
    createdAt: item.createdAt,
  }))
}

function serializeMessages(items = []) {
  return items.map((item) => ({
    _id: getDocumentId('message', item.id || item._id),
    conversationId: item.conversationId,
    fromUserId: item.fromUserId || item.from || '',
    from: item.from || item.fromUserId || '',
    type: item.type || 'text',
    content: item.content || '',
    productId: item.productId || '',
    time: item.time || '',
    order: Number(item.order) || 0,
    readStatus: item.readStatus || '',
    createdAt: item.createdAt,
  }))
}

function deserializeRecentViews(documents) {
  return documents.map((item) => ({
    id: item._id,
    userId: item.userId,
    productId: item.productId,
    viewedAt: item.viewedAt,
  }))
}

function serializeRecentViews(items = []) {
  return items.map((item) => ({
    _id: getDocumentId('recent-view', item.id || createStableId('recent-view', item.userId, item.productId)),
    userId: item.userId,
    productId: item.productId,
    viewedAt: item.viewedAt,
  }))
}

function deserializeUploads(documents) {
  return documents.map((item) => ({
    id: item._id,
    userId: item.userId,
    fileId: item.fileId || '',
    filename: item.filename || '',
    originalName: item.originalName || '',
    mimeType: item.mimeType || '',
    url: item.url || '',
    bizType: item.bizType || '',
    createdAt: item.createdAt,
  }))
}

function serializeUploads(items = []) {
  return items.map((item) => ({
    _id: getDocumentId('upload', item.id || item._id),
    userId: item.userId,
    fileId: item.fileId || '',
    filename: item.filename || '',
    originalName: item.originalName || '',
    mimeType: item.mimeType || '',
    url: item.url || '',
    bizType: item.bizType || '',
    createdAt: item.createdAt,
  }))
}

function deserializeMessageReads(documents) {
  return documents.map((item) => ({
    id: item._id,
    userId: item.userId,
    type: item.type,
    targetId: item.targetId,
    readAt: item.readAt,
  }))
}

function serializeMessageReads(items = []) {
  return items.map((item) => ({
    _id: getDocumentId('message-read', item.id || createStableId('message-read', item.userId, item.type, item.targetId)),
    userId: item.userId,
    type: item.type,
    targetId: item.targetId,
    readAt: item.readAt,
  }))
}

function buildStateDocuments(snapshot) {
  return [
    {
      _id: APP_STATE_DOC_IDS.meta,
      value: snapshot.meta || {},
    },
    {
      _id: APP_STATE_DOC_IDS.dictionaries,
      value: snapshot.dictionaries || {},
    },
    {
      _id: APP_STATE_DOC_IDS.tradeNotifications,
      value: Array.isArray(snapshot.tradeNotifications) ? snapshot.tradeNotifications : [],
    },
    {
      _id: APP_STATE_DOC_IDS.systemNotifications,
      value: Array.isArray(snapshot.systemNotifications) ? snapshot.systemNotifications : [],
    },
  ]
}

function buildRawSnapshot(collections, stateDocuments) {
  const stateById = stateDocuments.reduce((result, item) => {
    result[item._id] = item.value
    return result
  }, {})

  return {
    meta: stateById[APP_STATE_DOC_IDS.meta] || {},
    dictionaries: stateById[APP_STATE_DOC_IDS.dictionaries] || {},
    users: deserializeUsers(collections.users),
    products: deserializeProducts(collections.products),
    favorites: deserializeFavorites(collections.favorites),
    recentViews: deserializeRecentViews(collections.recentViews),
    conversations: deserializeConversations(collections.conversations),
    messages: deserializeMessages(collections.messages),
    tradeNotifications: Array.isArray(stateById[APP_STATE_DOC_IDS.tradeNotifications])
      ? stateById[APP_STATE_DOC_IDS.tradeNotifications]
      : [],
    systemNotifications: Array.isArray(stateById[APP_STATE_DOC_IDS.systemNotifications])
      ? stateById[APP_STATE_DOC_IDS.systemNotifications]
      : [],
    messageReads: deserializeMessageReads(collections.messageReads),
    uploads: deserializeUploads(collections.uploads),
  }
}

function mergeByKey(current = [], fallback = [], getKey) {
  const result = []
  const seen = new Set()

  current.forEach((item) => {
    const key = getKey(item)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  })

  fallback.forEach((item) => {
    const key = getKey(item)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  })

  return result
}

function mergeWithSeed(snapshot) {
  const seed = buildInitialDb()

  return {
    meta: Object.keys(snapshot.meta || {}).length ? snapshot.meta : seed.meta,
    dictionaries: Object.keys(snapshot.dictionaries || {}).length ? snapshot.dictionaries : seed.dictionaries,
    users: mergeByKey(snapshot.users, seed.users, (item) => item.id || item.openid),
    products: mergeByKey(snapshot.products, seed.products, (item) => item.id),
    favorites: mergeByKey(snapshot.favorites, seed.favorites, (item) => `${item.userId}:${item.productId}`),
    recentViews: mergeByKey(snapshot.recentViews, seed.recentViews, (item) => `${item.userId}:${item.productId}`),
    conversations: mergeByKey(snapshot.conversations, seed.conversations, (item) => item.id),
    messages: mergeByKey(snapshot.messages, seed.messages, (item) => item.id),
    tradeNotifications: mergeByKey(snapshot.tradeNotifications, seed.tradeNotifications, (item) => item.id),
    systemNotifications: mergeByKey(snapshot.systemNotifications, seed.systemNotifications, (item) => item.id),
    messageReads: mergeByKey(snapshot.messageReads, seed.messageReads, (item) => `${item.userId}:${item.type}:${item.targetId}`),
    uploads: mergeByKey(snapshot.uploads, seed.uploads, (item) => item.id || item.fileId || item.url),
  }
}

function buildSerializedCollections(snapshot) {
  return {
    users: serializeUsers(snapshot.users),
    products: serializeProducts(snapshot.products),
    favorites: serializeFavorites(snapshot.favorites),
    conversations: serializeConversations(snapshot.conversations),
    messages: serializeMessages(snapshot.messages),
    recentViews: serializeRecentViews(snapshot.recentViews),
    uploads: serializeUploads(snapshot.uploads),
    messageReads: serializeMessageReads(snapshot.messageReads),
    appState: buildStateDocuments(snapshot),
  }
}

async function syncCollection(db, collectionName, documents, replaceExisting) {
  const existingDocuments = await getCollectionDocuments(db, collectionName)
  const existingIds = new Set(existingDocuments.map((item) => item._id))
  const desiredIds = new Set(documents.map((item) => item._id))
  const collection = db.collection(collectionName)

  for (const document of documents) {
    const payload = { ...document }
    delete payload._id
    await withCloudbaseTimeout(collection.doc(document._id).set(payload), `upsert ${collectionName}/${document._id}`)
  }

  if (!replaceExisting) {
    return
  }

  for (const documentId of existingIds) {
    if (!desiredIds.has(documentId)) {
      await withCloudbaseTimeout(collection.doc(documentId).remove(), `remove ${collectionName}/${documentId}`)
    }
  }
}

async function readRawCloudSnapshot() {
  await ensureCloudbaseCollections()
  const db = getCloudbaseDb()
  const [
    users,
    products,
    favorites,
    conversations,
    messages,
    recentViews,
    uploads,
    messageReads,
    appState,
  ] = await Promise.all([
    getCollectionDocuments(db, COLLECTION_NAMES.users),
    getCollectionDocuments(db, COLLECTION_NAMES.products),
    getCollectionDocuments(db, COLLECTION_NAMES.favorites),
    getCollectionDocuments(db, COLLECTION_NAMES.conversations),
    getCollectionDocuments(db, COLLECTION_NAMES.messages),
    getCollectionDocuments(db, COLLECTION_NAMES.recentViews),
    getCollectionDocuments(db, COLLECTION_NAMES.uploads),
    getCollectionDocuments(db, COLLECTION_NAMES.messageReads),
    getCollectionDocuments(db, APP_STATE_COLLECTION),
  ])

  return buildRawSnapshot({
    users,
    products,
    favorites,
    conversations,
    messages,
    recentViews,
    uploads,
    messageReads,
  }, appState)
}

async function writeCloudSnapshot(snapshot, options = {}) {
  await ensureCloudbaseCollections()
  const db = getCloudbaseDb()
  const replaceExisting = options.replaceExisting !== false
  const serialized = buildSerializedCollections(snapshot)

  await syncCollection(db, COLLECTION_NAMES.users, serialized.users, replaceExisting)
  await syncCollection(db, COLLECTION_NAMES.products, serialized.products, replaceExisting)
  await syncCollection(db, COLLECTION_NAMES.favorites, serialized.favorites, replaceExisting)
  await syncCollection(db, COLLECTION_NAMES.conversations, serialized.conversations, replaceExisting)
  await syncCollection(db, COLLECTION_NAMES.messages, serialized.messages, replaceExisting)
  await syncCollection(db, COLLECTION_NAMES.recentViews, serialized.recentViews, replaceExisting)
  await syncCollection(db, COLLECTION_NAMES.uploads, serialized.uploads, replaceExisting)
  await syncCollection(db, COLLECTION_NAMES.messageReads, serialized.messageReads, replaceExisting)
  await syncCollection(db, APP_STATE_COLLECTION, serialized.appState, replaceExisting)

  return snapshot
}

async function removeCloudDocuments(collectionName, predicate) {
  await ensureCloudbaseCollections()
  const db = getCloudbaseDb()
  const documents = await getCollectionDocuments(db, collectionName)
  const matchedIds = documents.filter(predicate).map((item) => item._id)

  for (const documentId of matchedIds) {
    await withCloudbaseTimeout(
      db.collection(collectionName).doc(documentId).remove(),
      `remove ${collectionName}/${documentId}`
    )
  }

  return matchedIds.length
}

async function upsertCloudMessageRead(entry = {}) {
  await ensureCloudbaseCollections()
  const db = getCloudbaseDb()
  const documentId = getDocumentId(
    'message-read',
    entry.id || createStableId('message-read', entry.userId, entry.type, entry.targetId)
  )
  const payload = {
    userId: entry.userId,
    type: entry.type,
    targetId: entry.targetId,
    readAt: entry.readAt,
  }

  await withCloudbaseTimeout(
    db.collection(COLLECTION_NAMES.messageReads).doc(documentId).set(payload),
    `upsert ${COLLECTION_NAMES.messageReads}/${documentId}`
  )

  return {
    id: documentId,
    ...payload,
  }
}

async function upsertCloudFavorite(entry = {}) {
  await ensureCloudbaseCollections()
  const db = getCloudbaseDb()
  const documentId = getDocumentId(
    'favorite',
    entry.id || createStableId('favorite', entry.userId, entry.productId)
  )
  const payload = {
    userId: entry.userId,
    productId: entry.productId,
    createdAt: entry.createdAt,
  }

  await withCloudbaseTimeout(
    db.collection(COLLECTION_NAMES.favorites).doc(documentId).set(payload),
    `upsert ${COLLECTION_NAMES.favorites}/${documentId}`
  )

  return {
    id: documentId,
    ...payload,
  }
}

async function upsertCloudUser(user = {}) {
  await ensureCloudbaseCollections()
  const db = getCloudbaseDb()
  const document = serializeUsers([user])[0]
  const payload = { ...document }
  delete payload._id

  await withCloudbaseTimeout(
    db.collection(COLLECTION_NAMES.users).doc(document._id).set(payload),
    `upsert ${COLLECTION_NAMES.users}/${document._id}`
  )

  return {
    id: document._id,
    ...user,
  }
}

async function removeCloudFavorite(userId, productId) {
  return removeCloudDocuments(
    COLLECTION_NAMES.favorites,
    (item) => item.userId === userId && item.productId === productId
  )
}

async function upsertCloudRecentView(entry = {}) {
  await ensureCloudbaseCollections()
  const db = getCloudbaseDb()
  const documentId = getDocumentId(
    'recent-view',
    entry.id || createStableId('recent-view', entry.userId, entry.productId)
  )
  const payload = {
    userId: entry.userId,
    productId: entry.productId,
    viewedAt: entry.viewedAt,
  }

  await withCloudbaseTimeout(
    db.collection(COLLECTION_NAMES.recentViews).doc(documentId).set(payload),
    `upsert ${COLLECTION_NAMES.recentViews}/${documentId}`
  )

  return {
    id: documentId,
    ...payload,
  }
}

async function clearCloudRecentViews(userId) {
  return removeCloudDocuments(
    COLLECTION_NAMES.recentViews,
    (item) => item.userId === userId
  )
}

async function upsertCloudProduct(product = {}) {
  await ensureCloudbaseCollections()
  const db = getCloudbaseDb()
  const document = serializeProducts([product])[0]
  const payload = { ...document }
  delete payload._id

  await withCloudbaseTimeout(
    db.collection(COLLECTION_NAMES.products).doc(document._id).set(payload),
    `upsert ${COLLECTION_NAMES.products}/${document._id}`
  )

  return {
    id: document._id,
    ...product,
  }
}

async function removeCloudProduct(productId) {
  await ensureCloudbaseCollections()
  const db = getCloudbaseDb()
  await withCloudbaseTimeout(
    db.collection(COLLECTION_NAMES.products).doc(productId).remove(),
    `remove ${COLLECTION_NAMES.products}/${productId}`
  )
  await removeCloudDocuments(COLLECTION_NAMES.favorites, (item) => item.productId === productId)
  await removeCloudDocuments(COLLECTION_NAMES.recentViews, (item) => item.productId === productId)
}

async function repairCloudSnapshot() {
  const merged = mergeWithSeed(await readRawCloudSnapshot())
  await writeCloudSnapshot(merged, { replaceExisting: true })
  return merged
}

async function readCloudSnapshot() {
  const snapshot = await readRawCloudSnapshot()
  if (!Object.keys(snapshot.dictionaries || {}).length) {
    return repairCloudSnapshot()
  }
  return snapshot
}

module.exports = {
  getCloudbaseDb,
  readCloudSnapshot,
  writeCloudSnapshot,
  upsertCloudUser,
  upsertCloudFavorite,
  removeCloudFavorite,
  upsertCloudRecentView,
  clearCloudRecentViews,
  upsertCloudProduct,
  removeCloudProduct,
  upsertCloudMessageRead,
  repairCloudSnapshot,
  ensureCloudbaseCollections,
}
