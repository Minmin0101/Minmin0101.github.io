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
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-GitHub-Api-Version",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };

  if (origin && allowedOrigins.indexOf(origin) !== -1) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function createPublicCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-GitHub-Api-Version",
    "Access-Control-Max-Age": "86400"
  };
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

function createTextResponse(origin, allowedOrigins, status, payload, extraHeaders) {
  return new Response(payload, {
    status: status,
    headers: Object.assign(
      {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      createCorsHeaders(origin, allowedOrigins),
      extraHeaders || {}
    )
  });
}

function createPublicJsonResponse(status, payload, extraHeaders) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: Object.assign(
      {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      createPublicCorsHeaders(),
      extraHeaders || {}
    )
  });
}

function createPublicTextResponse(status, payload, extraHeaders) {
  return new Response(payload, {
    status: status,
    headers: Object.assign(
      {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      createPublicCorsHeaders(),
      extraHeaders || {}
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

function sanitizeRepoPart(value) {
  return String(value || "").trim();
}

function buildGithubApiUrl(pathname, searchParams) {
  var url = new URL("https://api.github.com" + pathname);

  searchParams.forEach(function (value, key) {
    if (value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function fetchGithubPublic(url, acceptHeader) {
  return fetch(url, {
    headers: {
      Accept: acceptHeader || "application/vnd.github+json",
      "User-Agent": "minmin-weibo-oauth-worker"
    },
    cf: {
      cacheEverything: true,
      cacheTtl: 300
    }
  });
}

async function readGithubPayload(response) {
  var text = await response.text().catch(function () {
    return "";
  });
  var contentType = response.headers.get("Content-Type") || "";
  var json = null;

  if (text && contentType.indexOf("application/json") !== -1) {
    try {
      json = JSON.parse(text);
    } catch (error) {
      json = null;
    }
  }

  return {
    text: text,
    json: json
  };
}

async function handlePublicIssues(request, env, pathnameParts) {
  var requestUrl = new URL(request.url);
  var owner = sanitizeRepoPart(requestUrl.searchParams.get("owner"));
  var repo = sanitizeRepoPart(requestUrl.searchParams.get("repo"));
  var issueNumber = pathnameParts.length >= 5 ? sanitizeRepoPart(pathnameParts[4]) : "";
  var upstreamParams = new URLSearchParams();
  var apiPath = "";
  var apiUrl = "";
  var response;
  var payload;
  var headers;

  if (!owner || !repo) {
    return createPublicJsonResponse(400, {
      error: "missing_owner_or_repo"
    });
  }

  apiPath = "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/issues";
  if (issueNumber && pathnameParts[5] === "comments") {
    apiPath += "/" + encodeURIComponent(issueNumber) + "/comments";
  }

  if (requestUrl.searchParams.get("state")) {
    upstreamParams.set("state", requestUrl.searchParams.get("state"));
  }
  if (requestUrl.searchParams.get("per_page")) {
    upstreamParams.set("per_page", requestUrl.searchParams.get("per_page"));
  }
  if (requestUrl.searchParams.get("page")) {
    upstreamParams.set("page", requestUrl.searchParams.get("page"));
  }

  apiUrl = buildGithubApiUrl(apiPath, upstreamParams);
  response = await fetchGithubPublic(apiUrl, "application/vnd.github.html+json");
  payload = await readGithubPayload(response);

  if (!response.ok) {
    return createPublicJsonResponse(response.status, payload.json || {
      error: "github_public_fetch_failed",
      message: payload.text || ""
    });
  }

  headers = {
    "Cache-Control": "public, max-age=60, s-maxage=300"
  };

  return createPublicTextResponse(200, payload.text || "[]", headers);
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
    var pathnameParts = url.pathname.split("/");
    var isPublicIssuesRoute = request.method === "GET" && url.pathname === "/github/public/issues";
    var isPublicCommentsRoute =
      request.method === "GET" &&
      pathnameParts.length === 6 &&
      pathnameParts[1] === "github" &&
      pathnameParts[2] === "public" &&
      pathnameParts[3] === "issues" &&
      pathnameParts[5] === "comments";
    var isPublicOptionsRoute =
      request.method === "OPTIONS" &&
      (
        url.pathname === "/github/public/issues" ||
        (
          pathnameParts.length === 6 &&
          pathnameParts[1] === "github" &&
          pathnameParts[2] === "public" &&
          pathnameParts[3] === "issues" &&
          pathnameParts[5] === "comments"
        )
      );

    if (isPublicOptionsRoute) {
      return new Response(null, {
        status: 204,
        headers: createPublicCorsHeaders()
      });
    }

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

    if (isPublicIssuesRoute) {
      return handlePublicIssues(request, env, pathnameParts);
    }

    if (isPublicCommentsRoute) {
      return handlePublicIssues(request, env, pathnameParts);
    }

    return createJsonResponse(origin, config.allowedOrigins, 404, {
      error: "not_found"
    });
  }
};
