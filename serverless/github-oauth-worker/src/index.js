function splitList(value) {
  return String(value || "")
    .split(",")
    .map(function (item) {
      return item.trim();
    })
    .filter(Boolean);
}

function createCorsHeaders(origin, allowedOrigins) {
  var headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };

  if (origin && allowedOrigins.indexOf(origin) !== -1) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function createJsonResponse(origin, allowedOrigins, status, payload) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: Object.assign(
      {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      createCorsHeaders(origin, allowedOrigins)
    )
  });
}

function ensureAllowedOrigin(origin, allowedOrigins) {
  return !!(origin && allowedOrigins.indexOf(origin) !== -1);
}

function getWorkerConfig(env) {
  return {
    clientID: env.GITHUB_CLIENT_ID || "",
    clientSecret: env.GITHUB_CLIENT_SECRET || "",
    allowedOrigins: splitList(env.ALLOWED_ORIGINS),
    allowedRedirectUris: splitList(env.ALLOWED_REDIRECT_URIS)
  };
}

async function exchangeGithubCode(body, config) {
  var params = new URLSearchParams();

  params.set("client_id", config.clientID);
  params.set("client_secret", config.clientSecret);
  params.set("code", body.code);
  params.set("redirect_uri", body.redirect_uri);

  if (body.state) {
    params.set("state", body.state);
  }

  return fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
}

async function fetchGithubUser(accessToken) {
  return fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + accessToken,
      "User-Agent": "minmin-weibo-oauth-worker"
    }
  });
}

async function handleExchange(request, env) {
  var origin = request.headers.get("Origin") || "";
  var config = getWorkerConfig(env);
  var body;
  var oauthResponse;
  var oauthData;
  var userResponse;
  var userData;

  if (!ensureAllowedOrigin(origin, config.allowedOrigins)) {
    return createJsonResponse(origin, config.allowedOrigins, 403, {
      error: "origin_not_allowed"
    });
  }

  if (!config.clientID || !config.clientSecret) {
    return createJsonResponse(origin, config.allowedOrigins, 500, {
      error: "worker_not_configured"
    });
  }

  try {
    body = await request.json();
  } catch (error) {
    return createJsonResponse(origin, config.allowedOrigins, 400, {
      error: "invalid_json_body"
    });
  }

  if (!body || !body.code || !body.redirect_uri) {
    return createJsonResponse(origin, config.allowedOrigins, 400, {
      error: "missing_code_or_redirect_uri"
    });
  }

  if (config.allowedRedirectUris.indexOf(body.redirect_uri) === -1) {
    return createJsonResponse(origin, config.allowedOrigins, 400, {
      error: "redirect_uri_not_allowed"
    });
  }

  oauthResponse = await exchangeGithubCode(body, config);
  oauthData = await oauthResponse.json().catch(function () {
    return null;
  });

  if (!oauthResponse.ok || !oauthData || oauthData.error || !oauthData.access_token) {
    return createJsonResponse(origin, config.allowedOrigins, 400, {
      error: (oauthData && oauthData.error) || "oauth_exchange_failed",
      error_description: oauthData && oauthData.error_description ? oauthData.error_description : ""
    });
  }

  userResponse = await fetchGithubUser(oauthData.access_token);
  userData = await userResponse.json().catch(function () {
    return null;
  });

  if (!userResponse.ok || !userData || !userData.login) {
    return createJsonResponse(origin, config.allowedOrigins, 400, {
      error: "user_fetch_failed"
    });
  }

  return createJsonResponse(origin, config.allowedOrigins, 200, {
    access_token: oauthData.access_token,
    token_type: oauthData.token_type || "bearer",
    scope: oauthData.scope || "",
    user: {
      login: userData.login,
      avatar_url: userData.avatar_url,
      html_url: userData.html_url
    }
  });
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var config = getWorkerConfig(env);
    var origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: createCorsHeaders(origin, config.allowedOrigins)
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return createJsonResponse(origin, config.allowedOrigins, 200, {
        ok: true,
        service: "minmin-weibo-github-oauth"
      });
    }

    if (request.method === "GET" && url.pathname === "/healthz") {
      return createJsonResponse(origin, config.allowedOrigins, 200, {
        ok: true
      });
    }

    if (request.method === "POST" && url.pathname === "/oauth/github/exchange") {
      return handleExchange(request, env);
    }

    return createJsonResponse(origin, config.allowedOrigins, 404, {
      error: "not_found"
    });
  }
};
