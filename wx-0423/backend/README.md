# Backend Dev Server

This backend keeps the miniapp page layer unchanged and exposes the same HTTP contract used by `services/http/provider.js`.

## Start

```bash
npm run backend:start
```

Default base URL: `http://127.0.0.1:4000`

## Verify

```bash
npm run backend:test
```

## Notes

- Runtime data is stored in `backend/data/runtime-db.json`.
- Uploaded files are written to `backend/uploads/`.
- `POST /auth/wechat/login` supports real WeChat `code2Session`.
- If `WECHAT_APP_SECRET` is not configured, login falls back to the existing local stub so local debugging keeps working.
- Miniapp image upload can switch to `wx.cloud.uploadFile` by filling `services/http/config.js`.

## WeChat Login

Supported environment variables:

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `WECHAT_LOGIN_MODE=auto|stub|code2session`

Recommended local start command:

```bash
WECHAT_APP_SECRET=your-secret npm run backend:start
```

`WECHAT_APP_ID` defaults to the `appid` in `project.config.json`, so you usually only need to provide `WECHAT_APP_SECRET`.

You can also place local-only values in `backend/.env`:

```env
WECHAT_APP_SECRET=your-secret
WECHAT_LOGIN_MODE=code2session
```

`backend/.env` is ignored by git and is intended for local development only.

## Cloud Upload

Edit `services/http/config.js` and fill:

- `cloudEnv`
- `useCloudUpload: true`
- `cloudUploadPrefix`

When enabled, the miniapp uploads images directly with `wx.cloud.uploadFile`, and `POST /products` stores the returned `cloud://` file IDs.
