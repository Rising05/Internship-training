# Backend API Plan

## Goal

Keep the current page layer unchanged and replace the data source behind `services/index.js`.
The backend should first satisfy the existing frontend service contract, then add missing production capabilities such as login, upload authorization, and order flow.

## Current frontend service contract

| Service method | Used by | Suggested endpoint | Notes |
| --- | --- | --- | --- |
| `bootstrapApp()` | `app.js` | `GET /app/bootstrap` | Returns initial auth, profile, and tab summary |
| `getHomeData(params)` | `pages/index/index.js` | `GET /home` | Aggregated homepage payload |
| `getProductDetail(id)` | `pages/detail/detail.js` | `GET /products/:id` | Includes seller and policy data |
| `toggleProductFavorite(id)` | `pages/index/index.js`, `pages/detail/detail.js` | `POST /favorites/products/:id/toggle` | Keeps current toggle-style contract |
| `getPublishPageData()` | `pages/publish/publish.js` | `GET /publish/meta` | Form metadata and seller defaults |
| `submitProduct(payload)` | `pages/publish/publish.js` | `POST /products` | Requires image upload support |
| `getMessagesPageData(tab)` | `pages/messages/messages.js` | `GET /messages?tab=...` | Returns tab definitions and message list |
| `markMessageAsRead(type, id)` | `pages/messages/messages.js` | `POST /messages/read` | Marks conversation/trade/system item as read |
| `getChatDetail(conversationId)` | `pages/chat/chat.js` | `GET /conversations/:id` | Returns thread detail and related product |
| `sendChatMessage(conversationId, content)` | `pages/chat/chat.js` | `POST /conversations/:id/messages` | Current frontend sends text only |
| `getProfilePageData()` | `pages/profile/profile.js` | `GET /profile` | Profile aggregates and lists |
| `clearProfileRecentViews()` | `pages/profile/profile.js` | `DELETE /profile/recent-views` | Clears browsing history |
| `getNavigationSummary()` | tab summary sync | `GET /navigation/summary` | Lightweight unread/favorite/published counts |
| `resetThreadStore()` | debug only | `DELETE /debug/chat-threads` | Optional debug endpoint |

## Data shapes to preserve

### Bootstrap response

```json
{
  "authSession": {
    "loggedIn": false,
    "nickname": "user nickname",
    "openid": "wechat-openid"
  },
  "profile": {
    "id": "user001",
    "nickname": "user nickname",
    "bio": "profile bio",
    "location": "Shanghai",
    "publishedCount": 8,
    "soldCount": 25,
    "favoriteCount": 18,
    "dealCount": 8
  },
  "summary": {
    "favoriteCount": 2,
    "recentCount": 1,
    "unreadConversationCount": 3,
    "publishedCount": 8
  }
}
```

### Product card

```json
{
  "id": "xc001",
  "title": "item title",
  "idolType": "group",
  "idolGroup": "IVE",
  "idolMember": "JANG WONYOUNG",
  "idolDisplayName": "IVE · JANG WONYOUNG",
  "idol": "IVE · JANG WONYOUNG",
  "category": "photocard",
  "price": 12,
  "quantity": 1,
  "images": ["https://..."],
  "condition": "new",
  "tradeType": "sell",
  "shippingFee": 6,
  "tags": ["official", "negotiable"],
  "note": "item description",
  "seller": {
    "id": "seller001",
    "name": "seller name",
    "city": "Shanghai",
    "level": "trusted",
    "intro": "seller intro",
    "avatarText": "S"
  },
  "isHot": true,
  "isLatest": true,
  "conversationId": "conv001",
  "createdAt": "2026-04-24T10:12:00+08:00",
  "isFavorite": true
}
```

### Product detail additions

```json
{
  "seller": {
    "publishedCount": 12,
    "responseRate": "95%"
  },
  "policies": [
    "policy text 1",
    "policy text 2"
  ]
}
```

### Homepage response

```json
{
  "hero": {
    "title": "brand title",
    "subtitle": "brand subtitle",
    "announcement": "announcement text"
  },
  "quickEntries": [],
  "searchSuggestions": [],
  "idolOptions": [],
  "idolDirectory": {
    "group": {
      "kpop": [],
      "jpop": [],
      "cpop": []
    },
    "solo": {
      "kpop": [],
      "jpop": [],
      "cpop": []
    }
  },
  "memberDirectory": {},
  "categoryOptions": [],
  "feedModes": [],
  "totalCount": 0,
  "matchedCount": 0,
  "hasMore": false,
  "items": []
}
```

### Publish metadata response

```json
{
  "idolOptions": [],
  "idolDirectory": {},
  "memberDirectory": {},
  "categoryOptions": [],
  "categorySections": {
    "common": [],
    "extra": []
  },
  "conditionOptions": [],
  "tradeTypeOptions": [],
  "seller": {
    "nickname": "user nickname",
    "location": "Shanghai"
  },
  "tips": []
}
```

### Message page response

```json
{
  "tabs": [],
  "activeTab": "conversation",
  "list": [],
  "summary": {
    "favoriteCount": 0,
    "recentCount": 0,
    "unreadConversationCount": 0,
    "publishedCount": 0
  }
}
```

### Conversation detail response

```json
{
  "id": "conv001",
  "title": "chat title",
  "subtitle": "chat subtitle",
  "user": {
    "id": "user002",
    "name": "chat peer"
  },
  "relatedProduct": {},
  "messages": [
    {
      "id": "msg001",
      "type": "text",
      "from": "self",
      "content": "hello",
      "time": "10:30"
    }
  ]
}
```

### Profile page response

```json
{
  "profile": {},
  "profileInitial": "X",
  "stats": {
    "publishedCount": 0,
    "soldCount": 0,
    "favoriteCount": 0,
    "dealCount": 0
  },
  "orderShortcuts": [],
  "menuItems": [],
  "policyHighlights": [],
  "favoriteProducts": [],
  "recentViews": [],
  "latestPublished": []
}
```

## Missing production capabilities

These are not fully wired in the current frontend, but the backend should be designed with them in mind:

1. WeChat login exchange: `wx.login()` code -> backend session -> user identity.
2. Image upload: the publish page currently holds local temp file paths only.
3. Real read-state persistence for message center.
4. Product ownership, moderation status, and audit trail.
5. Order and payment flow behind the current "buy now" placeholder.

## Recommended delivery order

1. Base infrastructure
   - session auth
   - unified response and error format
   - image upload endpoint
2. Product domain
   - homepage aggregate query
   - product detail
   - create product
   - favorite toggle
3. User domain
   - bootstrap
   - profile aggregate
   - recent views clear
   - navigation summary
4. Messaging domain
   - message list by tab
   - mark as read
   - conversation detail
   - send message
5. Later production features
   - buy flow
   - payment
   - moderation
   - notification push

## Suggested backend modules

- `auth`
- `products`
- `favorites`
- `uploads`
- `messages`
- `conversations`
- `profile`
- `navigation`

## Frontend switch plan

1. Fill `services/http/config.js` with the real `baseURL`.
2. Implement backend endpoints using the contracts above.
3. Change `services/config.js` `activeProvider` from `mock` to `http`.
4. Run the miniapp and fix only response-shape mismatches, not page logic.
