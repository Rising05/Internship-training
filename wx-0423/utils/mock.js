const { normalizeIdolPayload } = require('./idol')
const customIdolConfig = require('../data/idol-config')

const PRODUCT_REMOTE_THEMES = {
  xc001: { bg: 'ffe3ee', fg: '8d6b79', labels: ['时代少年团 刘耀文', '官拆小卡 细节图'] },
  xc002: { bg: 'fce5ef', fg: '7b6570', labels: ['SEVENTEEN WONWOO', '边角细节展示'] },
  xc003: { bg: 'ffe8db', fg: '8f6b5f', labels: ['IVE 张元英 吧唧'] },
  xc004: { bg: 'efe7ff', fg: '655c88', labels: ['aespa 柳智敏', '仅拆封检查'] },
  xc005: { bg: 'e6f4ff', fg: '5a7484', labels: ['EXO BAEKHYUN', '亚克力立牌底座'] },
  xc006: { bg: 'e7fff4', fg: '56756d', labels: ['TXT BEOMGYU', '交换专区 求换同类'] },
}

function encodePlaceholderText(value = '') {
  return encodeURIComponent(value).replace(/%20/g, '+')
}

function buildRemoteImages(productId, count) {
  const theme = PRODUCT_REMOTE_THEMES[productId] || { bg: 'fff0f5', fg: '8f7f88', labels: [] }
  return Array.from({ length: count }, (_, index) => {
    const label = theme.labels[index] || `${productId.toUpperCase()}-${index + 1}`
    return `https://dummyimage.com/1080x1080/${theme.bg}/${theme.fg}.png&text=${encodePlaceholderText(label)}`
  })
}

function normalizeDirectoryKey(value = '') {
  return value.trim().toLowerCase()
}

function mergeUnique(base = [], extra = []) {
  const seen = new Set()
  const result = []

  base.concat(extra).forEach((item) => {
    const value = typeof item === 'string' ? item.trim() : ''
    const normalized = normalizeDirectoryKey(value)
    if (!normalized || seen.has(normalized)) {
      return
    }
    seen.add(normalized)
    result.push(value)
  })

  return result
}

function mergeMemberDirectory(base = {}, extra = {}) {
  const merged = { ...base }

  Object.keys(extra).forEach((groupName) => {
    merged[groupName] = mergeUnique(base[groupName] || [], extra[groupName] || [])
  })

  return merged
}

function buildIdolOptionsFromDirectory(directory = {}) {
  return mergeUnique(
    ['全部'],
    []
      .concat(directory.group.kpop || [])
      .concat(directory.group.jpop || [])
      .concat(directory.group.cpop || [])
      .concat(directory.solo.kpop || [])
      .concat(directory.solo.jpop || [])
      .concat(directory.solo.cpop || [])
  )
}

function createProduct(data) {
  return normalizeIdolPayload(data)
}

const idolDirectory = {
  group: {
    kpop: mergeUnique([], customIdolConfig.idolDirectory.group.kpop || []),
    jpop: mergeUnique([], customIdolConfig.idolDirectory.group.jpop || []),
    cpop: mergeUnique([], customIdolConfig.idolDirectory.group.cpop || []),
  },
  solo: {
    kpop: mergeUnique([], customIdolConfig.idolDirectory.solo.kpop || []),
    jpop: mergeUnique([], customIdolConfig.idolDirectory.solo.jpop || []),
    cpop: mergeUnique([], customIdolConfig.idolDirectory.solo.cpop || []),
  },
}

const memberDirectory = mergeMemberDirectory({}, customIdolConfig.memberDirectory || {})

const idolOptions = buildIdolOptionsFromDirectory(idolDirectory)

const categoryOptions = [
  '全部',
  '小卡',
  '吧唧',
  '应援物',
  '立牌',
  '海报',
  '玩偶',
  '手幅',
  '其他',
]

const conditionOptions = ['全新', '近全新', '轻微瑕疵', '明显瑕疵']

const tradeTypeOptions = ['出物', '交换', '求收']

const homeQuickEntries = [
  { key: 'photocard', label: '小卡', iconPath: '/static/image/cropped/category-photocard.png', category: '小卡' },
  { key: 'badge', label: '吧唧', iconPath: '/static/image/cropped/category-badge.png', category: '吧唧' },
  { key: 'support', label: '应援物', iconPath: '/static/image/cropped/category-support.png', category: '应援物' },
  { key: 'standee', label: '立牌', iconPath: '/static/image/cropped/category-standee.png', category: '立牌' },
  { key: 'poster', label: '海报', iconPath: '/static/image/cropped/category-poster.png', category: '海报' },
  { key: 'plush', label: '玩偶', iconPath: '/static/image/cropped/category-plush.png', category: '玩偶' },
  { key: 'other', label: '其他', iconPath: '/static/image/cropped/category-other.png', category: '其他' },
]

const feedModes = [
  { key: 'latest', label: '最新发布' },
  { key: 'hot', label: '推荐商品' },
]

const searchSuggestions = [
  '小卡',
  '官周',
  '吧唧',
  '全新',
]

const messageTabs = [
  { key: 'conversation', label: '互动消息', iconPath: '/static/image/cropped/message-conversation.png' },
  { key: 'trade', label: '收藏提醒', iconPath: '/static/image/cropped/message-trade.png' },
  { key: 'system', label: '系统通知', iconPath: '/static/image/cropped/message-system.png' },
]

const orderShortcuts = [
  { key: 'pending-pay', label: '待付款', iconPath: '/static/image/cropped/wallet.png' },
  { key: 'shipping', label: '待发货', iconPath: '/static/image/cropped/doc-sparkle.png' },
  { key: 'receiving', label: '待收货', iconPath: '/static/image/cropped/doc-transfer.png' },
  { key: 'done', label: '已完成', iconPath: '/static/image/cropped/cube-star.png' },
]

const profileMenuItems = [
  { key: 'wallet', title: '我的钱包', desc: '余额、账单与优惠券' },
  { key: 'address', title: '地址管理', desc: '维护常用收件信息' },
  { key: 'review', title: '我的评价', desc: '查看公开交易反馈' },
  { key: 'help', title: '帮助与反馈', desc: '平台规则、帮助中心与意见反馈' },
  { key: 'policy', title: '隐私说明', desc: '隐私政策、用户协议与合规说明' },
  { key: 'about', title: '关于星仓', desc: '项目介绍与后续版本规划' },
]

const policyHighlights = [
  '平台已预留登录、发布审核与图片上传接口位',
  '交易规则、隐私说明和帮助反馈入口已纳入正式版结构',
  '当前阶段使用本地模拟数据，后续可平滑切换真实服务',
]

const orderStatuses = [
  { key: 'all', label: '全部' },
  { key: 'pending-pay', label: '待付款' },
  { key: 'shipping', label: '待发货' },
  { key: 'receiving', label: '待收货' },
  { key: 'done', label: '已完成' },
]

const orderRecords = [
  {
    id: 'ord001',
    productId: 'xc001',
    status: 'pending-pay',
    price: 18,
    sellerId: 'seller001',
    sellerName: '星星糖',
    sellerCity: '上海',
    buyerUserId: 'user001',
    buyerName: '小星星',
    createdAt: '2026-04-25T09:30:00+08:00',
  },
  {
    id: 'ord002',
    productId: 'xc004',
    status: 'shipping',
    price: 24,
    sellerId: 'seller004',
    sellerName: '银河补给站',
    sellerCity: '深圳',
    buyerUserId: 'user001',
    buyerName: '小星星',
    createdAt: '2026-04-24T16:12:00+08:00',
  },
  {
    id: 'ord003',
    productId: 'xc003',
    status: 'receiving',
    price: 17.6,
    sellerId: 'seller003',
    sellerName: '云朵贩卖机',
    sellerCity: '南京',
    buyerUserId: 'user001',
    buyerName: '小星星',
    createdAt: '2026-04-23T18:08:00+08:00',
  },
  {
    id: 'ord004',
    productId: 'xc005',
    status: 'done',
    price: 62,
    sellerId: 'seller005',
    sellerName: '薄荷仓库',
    sellerCity: '成都',
    buyerUserId: 'user001',
    buyerName: '小星星',
    createdAt: '2026-04-21T11:20:00+08:00',
  },
]

const walletSnapshot = {
  balance: 128.5,
  pendingSettlement: 36,
  couponCount: 2,
  bills: [
    {
      id: 'bill001',
      title: '订单退款到账',
      amount: 24,
      direction: 'income',
      time: '今天 10:26',
    },
    {
      id: 'bill002',
      title: '购买商品支付',
      amount: 18,
      direction: 'expense',
      time: '昨天 18:40',
    },
    {
      id: 'bill003',
      title: '卖出商品结算',
      amount: 62,
      direction: 'income',
      time: '04-22 14:10',
    },
  ],
  tips: [
    '钱包页首版仅提供余额和账单只读展示。',
    '后续可接入提现、优惠券和售后退款流转。',
  ],
}

const addressBook = [
  {
    id: 'addr001',
    name: '小星星',
    phone: '13800138000',
    region: '上海市 浦东新区',
    detail: '花木街道 星仓路 88 号 8 栋 1202',
    tag: '默认',
    isDefault: true,
  },
  {
    id: 'addr002',
    name: '小星星',
    phone: '13900139000',
    region: '浙江省 杭州市',
    detail: '滨江区 星光大道 66 号 2 单元 901',
    tag: '学校',
    isDefault: false,
  },
]

const reviewRecords = [
  {
    id: 'review001',
    score: 5,
    role: '买家评价',
    authorName: '银河补给站',
    content: '沟通顺畅，付款及时，确认收货也很快。',
    productId: 'xc004',
    createdAt: '2026-04-20T19:40:00+08:00',
  },
  {
    id: 'review002',
    score: 4,
    role: '卖家评价',
    authorName: '奶油小熊',
    content: '补图很及时，包装仔细，整体交易体验不错。',
    productId: 'xc002',
    createdAt: '2026-04-18T13:15:00+08:00',
  },
  {
    id: 'review003',
    score: 5,
    role: '买家评价',
    authorName: '胡萝卜邮局',
    content: '交换流程清晰，确认细节后发货很快。',
    productId: 'xc006',
    createdAt: '2026-04-16T21:00:00+08:00',
  },
]

const products = [
  createProduct({
    id: 'xc001',
    title: '明星小卡官拆 全新未拆',
    idolType: 'group',
    idolGroup: '时代少年团',
    idolMember: '刘耀文',
    category: '小卡',
    price: 12,
    quantity: 1,
    images: buildRemoteImages('xc001', 2),
    condition: '全新',
    tradeType: '出物',
    shippingFee: 6,
    tags: ['包邮可议', '官方周边'],
    note: '官拆周边小卡，全新未拆，保护良好，非偏可换。',
    seller: {
      id: 'seller001',
      name: '星星糖',
      city: '上海',
      level: '信用良好',
      intro: '主营小卡、吧唧和官周，回复及时。',
      avatarText: '星',
    },
    isHot: true,
    isLatest: true,
    conversationId: 'conv001',
    createdAt: '2026-04-24T10:12:00+08:00',
  }),
  createProduct({
    id: 'xc002',
    title: '明星小卡兔兔脸 官拆免瑕',
    idolType: 'group',
    idolGroup: 'SEVENTEEN',
    idolMember: 'WONWOO',
    category: '小卡',
    price: 8.8,
    quantity: 1,
    images: buildRemoteImages('xc002', 2),
    condition: '近全新',
    tradeType: '出物',
    shippingFee: 6,
    tags: ['可小刀', '卡套保护'],
    note: '正面品相良好，背面边角有轻微白点，已拍近图。',
    seller: {
      id: 'seller002',
      name: '奶油小熊',
      city: '杭州',
      level: '回头客较多',
      intro: '主出韩团纸类与随机特典。',
      avatarText: '奶',
    },
    isHot: true,
    isLatest: true,
    conversationId: 'conv002',
    createdAt: '2026-04-24T09:48:00+08:00',
  }),
  createProduct({
    id: 'xc003',
    title: '萌系Q版应援吧唧 捆出优先',
    idolType: 'group',
    idolGroup: 'IVE',
    idolMember: '张元英',
    category: '吧唧',
    price: 8.8,
    quantity: 2,
    images: buildRemoteImages('xc003', 1),
    condition: '近全新',
    tradeType: '出物',
    shippingFee: 8,
    tags: ['捆出优先', '保护袋齐全'],
    note: '保存良好，默认带保护袋出。',
    seller: {
      id: 'seller003',
      name: '云朵贩卖机',
      city: '南京',
      level: '学生卖家',
      intro: '主出平价周边，支持补视频。',
      avatarText: '云',
    },
    isHot: true,
    isLatest: false,
    conversationId: 'conv003',
    createdAt: '2026-04-23T22:00:00+08:00',
  }),
  createProduct({
    id: 'xc004',
    title: '官方拍立得卡 仅拆封检查',
    idolType: 'group',
    idolGroup: 'aespa',
    idolMember: '柳智敏',
    category: '小卡',
    price: 18,
    quantity: 1,
    images: buildRemoteImages('xc004', 1),
    condition: '全新',
    tradeType: '出物',
    shippingFee: 6,
    tags: ['全新', '可补近图'],
    note: '仅拆封确认成员，收到后立即入袋。',
    seller: {
      id: 'seller004',
      name: '银河补给站',
      city: '深圳',
      level: '高信用',
      intro: '专注韩团小卡和现场周边。',
      avatarText: '银',
    },
    isHot: false,
    isLatest: true,
    conversationId: 'conv004',
    createdAt: '2026-04-24T08:32:00+08:00',
  }),
  createProduct({
    id: 'xc005',
    title: '成员亚克力立牌 全套带底座',
    idolType: 'group',
    idolGroup: 'EXO',
    idolMember: 'BAEKHYUN',
    category: '应援物',
    price: 52,
    quantity: 1,
    images: buildRemoteImages('xc005', 2),
    condition: '近全新',
    tradeType: '出物',
    shippingFee: 10,
    tags: ['官方大物', '整套出售'],
    note: '盒损轻微，亚克力主体无划痕。',
    seller: {
      id: 'seller005',
      name: '薄荷仓库',
      city: '成都',
      level: '包装仔细',
      intro: '主出亚克力和应援大物。',
      avatarText: '薄',
    },
    isHot: true,
    isLatest: false,
    conversationId: 'conv005',
    createdAt: '2026-04-22T16:12:00+08:00',
  }),
  createProduct({
    id: 'xc006',
    title: '交换专区 求换同团同类小卡',
    idolType: 'group',
    idolGroup: 'TXT',
    idolMember: 'BEOMGYU',
    category: '其他',
    price: 0,
    quantity: 1,
    images: buildRemoteImages('xc006', 1),
    condition: '轻微瑕疵',
    tradeType: '交换',
    shippingFee: 0,
    tags: ['交换优先', '同团可补差'],
    note: '希望换同团小卡，细节可私聊确认。',
    seller: {
      id: 'seller006',
      name: '胡萝卜邮局',
      city: '苏州',
      level: '换物友好',
      intro: '长期交换纸类周边，流程清晰。',
      avatarText: '胡',
    },
    isHot: false,
    isLatest: true,
    conversationId: 'conv006',
    createdAt: '2026-04-24T07:26:00+08:00',
  }),
]

const conversationMessages = [
  { id: 'conv001', name: '星星糖', initial: '星', content: '宝！这个小卡还在吗？', time: '12:00', unread: 1, relatedProductId: 'xc001' },
  { id: 'conv002', name: '奶油小熊', initial: '奶', content: '好的，我给你补细节图。', time: '11:30', unread: 0, relatedProductId: 'xc002' },
  { id: 'conv003', name: '云朵贩卖机', initial: '云', content: '可以换哦，同团优先。', time: '昨天', unread: 2, relatedProductId: 'xc003' },
  { id: 'conv004', name: '小熊软糖', initial: '糖', content: '谢谢，价格我再考虑一下。', time: '04-22', unread: 0, relatedProductId: 'xc004' },
  { id: 'conv005', name: '薄荷仓库', initial: '薄', content: '全套带底座，盒损比较轻。', time: '昨天', unread: 0, relatedProductId: 'xc005' },
  { id: 'conv006', name: '胡萝卜邮局', initial: '胡', content: '你好，可以求换同系列吗？', time: '今天', unread: 1, relatedProductId: 'xc006' },
]

const tradeNotifications = [
  { id: 'trade001', type: '收藏提醒', title: '你的商品被收藏', content: '明星小卡官拆 全新未拆 今日新增 3 次收藏。', time: '刚刚', unread: 1 },
  { id: 'trade002', type: '议价提醒', title: '收到新的议价', content: '买家希望 10 元包邮带走 xc001。', time: '今天 10:16', unread: 0 },
  { id: 'trade003', type: '发布提醒', title: '发布成功', content: '你的商品已进入推荐池，将持续获得曝光。', time: '昨天', unread: 1 },
]

const systemMessages = [
  { id: 'sys001', type: '平台公告', title: '发布规范更新', content: '图片、价格、数量与成色说明建议尽量填写完整。', time: '04-23', unread: 1 },
  { id: 'sys002', type: '隐私说明', title: '隐私政策已更新', content: '正式版接入登录后，将展示完整隐私与用户协议页面。', time: '04-21', unread: 0 },
]

const chatThreads = {
  conv001: {
    id: 'conv001',
    conversationId: 'conv001',
    user: {
      name: '星星糖',
      avatarText: '星',
      subtitle: '信用良好 · 交易 12 次',
    },
    relatedProductId: 'xc001',
    messages: [
      { id: 'msg001', type: 'text', from: 'other', content: '宝！这个小卡还在吗？', time: '11:56' },
      { id: 'msg002', type: 'text', from: 'self', content: '在的在的～', time: '11:57' },
      { id: 'msg003', type: 'product', from: 'self', productId: 'xc001', time: '11:58' },
      { id: 'msg004', type: 'text', from: 'other', content: '可以换吗～', time: '12:00' },
    ],
  },
  conv002: {
    id: 'conv002',
    conversationId: 'conv002',
    user: {
      name: '奶油小熊',
      avatarText: '奶',
      subtitle: '回头客较多 · 交易 23 次',
    },
    relatedProductId: 'xc002',
    messages: [
      { id: 'msg005', type: 'text', from: 'other', content: '你好，这张能补个边角细节吗？', time: '11:18' },
      { id: 'msg006', type: 'text', from: 'self', content: '可以呀，我拍给你。', time: '11:22' },
      { id: 'msg007', type: 'text', from: 'other', content: '好的，我给你补细节图。', time: '11:30' },
    ],
  },
  conv003: {
    id: 'conv003',
    conversationId: 'conv003',
    user: {
      name: '云朵贩卖机',
      avatarText: '云',
      subtitle: '学生卖家 · 响应很快',
    },
    relatedProductId: 'xc003',
    messages: [
      { id: 'msg008', type: 'text', from: 'other', content: '这个可以换同团吧唧吗？', time: '昨天 20:20' },
      { id: 'msg009', type: 'text', from: 'self', content: '可以，发我看看你的图。', time: '昨天 20:30' },
      { id: 'msg010', type: 'text', from: 'other', content: '可以换哦，同团优先。', time: '昨天 20:48' },
    ],
  },
  conv004: {
    id: 'conv004',
    conversationId: 'conv004',
    user: {
      name: '小熊软糖',
      avatarText: '糖',
      subtitle: '交易 9 次 · 支持议价',
    },
    relatedProductId: 'xc004',
    messages: [
      { id: 'msg011', type: 'text', from: 'self', content: '这个是仅拆吗？', time: '04-22 19:36' },
      { id: 'msg012', type: 'text', from: 'other', content: '对，只拆封确认成员。', time: '04-22 19:40' },
      { id: 'msg013', type: 'text', from: 'other', content: '谢谢，价格我再考虑一下。', time: '04-22 19:42' },
    ],
  },
  conv005: {
    id: 'conv005',
    conversationId: 'conv005',
    user: {
      name: '薄荷仓库',
      avatarText: '薄',
      subtitle: '包装仔细 · 官方大物',
    },
    relatedProductId: 'xc005',
    messages: [
      { id: 'msg014', type: 'product', from: 'other', productId: 'xc005', time: '昨天 18:30' },
      { id: 'msg015', type: 'text', from: 'other', content: '全套带底座，盒损比较轻。', time: '昨天 18:31' },
    ],
  },
  conv006: {
    id: 'conv006',
    conversationId: 'conv006',
    user: {
      name: '胡萝卜邮局',
      avatarText: '胡',
      subtitle: '换物友好 · 同担优先',
    },
    relatedProductId: 'xc006',
    messages: [
      { id: 'msg016', type: 'text', from: 'other', content: '你好，可以求换同系列吗？', time: '今天 08:10' },
      { id: 'msg017', type: 'text', from: 'self', content: '可以，发我你想换的卡面。', time: '今天 08:18' },
    ],
  },
}

function getBaseProductById(id) {
  return products.find((item) => item.id === id)
}

function getBaseProductsByIds(ids = []) {
  return ids.map((id) => getBaseProductById(id)).filter(Boolean)
}

function getBaseConversationById(id) {
  return conversationMessages.find((item) => item.id === id)
}

module.exports = {
  idolDirectory,
  memberDirectory,
  idolOptions,
  categoryOptions,
  conditionOptions,
  tradeTypeOptions,
  homeQuickEntries,
  feedModes,
  searchSuggestions,
  messageTabs,
  orderShortcuts,
  orderStatuses,
  profileMenuItems,
  policyHighlights,
  orderRecords,
  walletSnapshot,
  addressBook,
  reviewRecords,
  products,
  conversationMessages,
  tradeNotifications,
  systemMessages,
  chatThreads,
  getBaseProductById,
  getBaseProductsByIds,
  getBaseConversationById,
}
