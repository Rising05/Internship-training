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
- `POST /auth/wechat/login` is a local development stub that returns the seeded demo account.
- When you move this service to WeChat cloud hosting, replace the login stub with the real `code2Session` exchange and replace local uploads with cloud storage.
