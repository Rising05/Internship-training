# Backend Dev Server

This backend keeps the miniapp page layer unchanged and exposes the same HTTP contract used by `services/http/provider.js`.

## Start

```bash
npm run backend:start
```

Default base URL: `http://127.0.0.1:4000`
Default local mode: `local-file`

## Environment Profiles

The backend supports three runtime profiles through `BACKEND_ENV_PROFILE`:

- `local-file`: local JSON file data source for offline debugging
- `local-cloudbase`: local server + CloudBase database
- `prod-cloudbase`: reserved for deployed CloudBase-backed environments

Recommended commands:

```bash
npm run backend:start:file
npm run backend:start:cloud
```

`npm run backend:start` now forces local file mode so the miniapp can boot without CloudBase credentials or collection bootstrap.

`backend/.env` is the only local secret source. `backend/.env.example` must remain placeholder-only.

## Verify

```bash
npm run backend:test
npm run backend:test:file
npm run backend:test:cloud
```

The smoke test now:

- supports `TEST_OPENID`
- writes namespaced test data
- cleans test data automatically before exiting

Manual cleanup command:

```bash
npm run backend:cleanup:test-data
```

Use the same `BACKEND_ENV_PROFILE` / `DATA_PROVIDER` combination as the environment you want to clean.

## Notes

- Runtime data is stored in `backend/data/runtime-db.json` when `DATA_PROVIDER=file`.
- Uploaded files are written to `backend/uploads/` only when miniapp upload does not use cloud storage.
- `POST /auth/wechat/login` supports real WeChat `code2Session`.
- If `WECHAT_APP_SECRET` is not configured, login falls back to the existing local stub so local debugging keeps working.
- Miniapp image upload can switch to `wx.cloud.uploadFile` by filling `services/http/config.js`.
- Business data storage now supports `DATA_PROVIDER=file|cloudbase`.

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
BACKEND_ENV_PROFILE=local-cloudbase
WECHAT_APP_SECRET=your-secret
WECHAT_LOGIN_MODE=code2session
DATA_PROVIDER=cloudbase
CLOUDBASE_ENV_ID=cloud1-d0gu2xnyn6f49940b
CLOUDBASE_SECRET_ID=your-secret-id
CLOUDBASE_SECRET_KEY=your-secret-key
```

`backend/.env` is ignored by git and is intended for local development only.

## Data Provider

File mode:

```env
BACKEND_ENV_PROFILE=local-file
DATA_PROVIDER=file
```

CloudBase mode:

```env
BACKEND_ENV_PROFILE=local-cloudbase
DATA_PROVIDER=cloudbase
CLOUDBASE_ENV_ID=cloud1-d0gu2xnyn6f49940b
CLOUDBASE_SECRET_ID=your-secret-id
CLOUDBASE_SECRET_KEY=your-secret-key
```

When `DATA_PROVIDER=cloudbase`, the backend reads and writes the following CloudBase collections:

- `users`
- `products`
- `favorites`
- `conversations`
- `messages`
- `recent_views`
- `uploads`
- `message_reads`
- `app_state`

## Cloud Upload

`services/http/config.js` now selects a profile automatically:

- Miniapp `release` runtime uses `prod-cloudbase`
- all other runtimes default to `local-file`

Available frontend profiles:

- `local-file`
- `local-cloudbase`
- `prod-cloudbase`

Each profile controls:

- `baseURL`
- `cloudEnv`
- `useCloudUpload`
- `cloudUploadPrefix`

When enabled, the miniapp uploads images directly with `wx.cloud.uploadFile`, and `POST /products` stores the returned `cloud://` file IDs.

## Cloud Database Bootstrap

Initialize or repair the CloudBase collections with seed data:

```bash
npm run backend:cloud:seed
```

Repair a partially initialized CloudBase environment without changing the page contract:

```bash
npm run backend:cloud:repair
```

Migrate the current local runtime data file into CloudBase:

```bash
npm run backend:cloud:migrate
```

Recommended order:

1. Fill `BACKEND_ENV_PROFILE`, `DATA_PROVIDER`, `CLOUDBASE_ENV_ID`, `CLOUDBASE_SECRET_ID`, `CLOUDBASE_SECRET_KEY` in `backend/.env`
2. Run `npm run backend:cloud:seed`
3. Run `npm run backend:cloud:migrate`
4. Restart the backend with `DATA_PROVIDER=cloudbase`

## Test Data Policy

Backend smoke tests use a dedicated namespace prefix and must not mix with demo seed data.

- test products use a namespaced title
- test messages use a namespaced content prefix
- `npm run backend:cleanup:test-data` removes only namespaced test data and known legacy test leftovers

This cleanup also removes linked favorites and recent views, then rebuilds user counters.
