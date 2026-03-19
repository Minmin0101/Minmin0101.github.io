# GitHub OAuth Worker

This Worker keeps the GitHub OAuth `client_secret` on the server side and only exposes a public `exchangeURL` to the static blog.

## What it does

- Accepts `code`, `state`, and `redirect_uri` from the blog page
- Validates request origin and allowed callback URLs
- Exchanges the GitHub OAuth code with the server-side `client_secret`
- Returns `access_token` plus basic user info to the browser

## Required secrets

Set these with `wrangler secret put`:

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

## Allowed origins and callback URLs

Edit [wrangler.toml](./wrangler.toml) before deploy:

- `ALLOWED_ORIGINS`
  - `https://minmin0101.github.io`
  - `http://127.0.0.1:4000`
- `ALLOWED_REDIRECT_URIS`
  - `https://minmin0101.github.io/blog/weibo/oauth-callback/`
  - `http://127.0.0.1:4000/blog/weibo/oauth-callback/`

## Deploy

```bash
cd serverless/github-oauth-worker
npm install -g wrangler
wrangler login
wrangler deploy
```

## Fill back into the blog

After deploy, copy the Worker endpoint:

- Production `exchangeURL`
  - `https://<your-worker>.workers.dev/oauth/github/exchange`
- Local dev `exchangeURL`
  - `http://127.0.0.1:8787/oauth/github/exchange` when using `wrangler dev`

Then update [blog/weibo/index.html](../../blog/weibo/index.html):

- `MINMIN_WEIBO_CONFIG.oauth.prod.clientID`
- `MINMIN_WEIBO_CONFIG.oauth.prod.exchangeURL`
- `MINMIN_WEIBO_CONFIG.oauth.dev.clientID`
- `MINMIN_WEIBO_CONFIG.oauth.dev.exchangeURL`

The callback URL in your GitHub OAuth App should now be:

- Production: `https://minmin0101.github.io/blog/weibo/oauth-callback/`
- Local: `http://127.0.0.1:4000/blog/weibo/oauth-callback/`

## Local dev

```bash
cd serverless/github-oauth-worker
wrangler dev
```

The static blog already points local mode to `http://127.0.0.1:8787/oauth/github/exchange`.
