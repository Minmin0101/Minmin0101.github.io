(function (window) {
  var rootConfig = window.MINMIN_WEIBO_CONFIG || {};
  var pendingKey = "minmin-weibo-oauth-pending-v1";
  var tokenKey = "github_token";
  var userKey = "github_user";
  var authSource = "minmin-weibo-oauth";
  var installed = false;
  var popupRef = null;
  var popupWatcher = 0;

  function getSessionStorage() {
    try {
      return window.sessionStorage;
    } catch (error) {
      return null;
    }
  }

  function getLocalStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function isLocalMode() {
    return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  }

  function getConfig() {
    var oauth = rootConfig.oauth || {};
    var scoped = isLocalMode() ? oauth.dev || {} : oauth.prod || {};
    var clientID = scoped.clientID || rootConfig.clientID || "";
    var callback = scoped.callback || rootConfig.callback || window.location.origin + "/blog/weibo/oauth-callback/";
    var exchangeURL = scoped.exchangeURL || rootConfig.exchangeURL || "";
    var authorizeURL = scoped.authorizeURL || rootConfig.authorizeURL || "https://github.com/login/oauth/authorize";
    var scope = scoped.scope || rootConfig.scope || "public_repo read:user";

    return {
      clientID: clientID,
      callback: callback,
      exchangeURL: exchangeURL,
      authorizeURL: authorizeURL,
      scope: scope,
      configured: !!(clientID && callback && exchangeURL)
    };
  }

  function dispatch(name, detail) {
    var eventName = "minmin:weibo-oauth:" + name;

    if (typeof window.CustomEvent === "function") {
      window.dispatchEvent(new window.CustomEvent(eventName, { detail: detail || {} }));
      return;
    }

    var legacyEvent = document.createEvent("CustomEvent");
    legacyEvent.initCustomEvent(eventName, false, false, detail || {});
    window.dispatchEvent(legacyEvent);
  }

  function normalizeUser(user) {
    return {
      login: (user && user.login) || "",
      avatarUrl: (user && (user.avatarUrl || user.avatar_url)) || ""
    };
  }

  function hasSession() {
    var storage = getLocalStorage();

    if (!storage) {
      return false;
    }

    try {
      return !!(storage.getItem(tokenKey) && storage.getItem(userKey));
    } catch (error) {
      return false;
    }
  }

  function getToken() {
    var storage = getLocalStorage();

    if (!storage) {
      return "";
    }

    try {
      return storage.getItem(tokenKey) || "";
    } catch (error) {
      return "";
    }
  }

  function getUser() {
    var storage = getLocalStorage();
    var raw = "";

    if (!storage) {
      return normalizeUser({});
    }

    try {
      raw = storage.getItem(userKey) || "";
      return normalizeUser(raw ? JSON.parse(raw) : {});
    } catch (error) {
      return normalizeUser({});
    }
  }

  function saveSession(token, user) {
    var storage = getLocalStorage();

    if (!storage || !token) {
      return false;
    }

    try {
      storage.setItem(tokenKey, token);
      storage.setItem(userKey, JSON.stringify(normalizeUser(user)));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearSession() {
    var storage = getLocalStorage();

    if (!storage) {
      return false;
    }

    try {
      storage.removeItem(tokenKey);
      storage.removeItem(userKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  function showSetup() {
    window.open("https://github.com/settings/developers", "_blank", "noopener,noreferrer");
  }

  function createState() {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var numbers = new Uint32Array(4);
      window.crypto.getRandomValues(numbers);
      return Array.prototype.map
        .call(numbers, function (value) {
          return value.toString(16);
        })
        .join("");
    }

    return String(Date.now()) + String(Math.random()).slice(2);
  }

  function readPending() {
    var storage = getSessionStorage();
    var parsed;

    if (!storage) {
      return null;
    }

    try {
      parsed = JSON.parse(storage.getItem(pendingKey) || "null");
    } catch (error) {
      parsed = null;
    }

    if (!parsed || !parsed.state) {
      return null;
    }

    if (parsed.createdAt && Date.now() - parsed.createdAt > 15 * 60 * 1000) {
      clearPending();
      return null;
    }

    return parsed;
  }

  function writePending(payload) {
    var storage = getSessionStorage();

    if (!storage) {
      return false;
    }

    try {
      storage.setItem(pendingKey, JSON.stringify(payload));
      return true;
    } catch (error) {
      dispatch("error", { error: "storage_write_failed" });
      return false;
    }
  }

  function clearPending() {
    var storage = getSessionStorage();

    if (!storage) {
      return;
    }

    try {
      storage.removeItem(pendingKey);
    } catch (error) {
      // Ignore storage cleanup failures.
    }
  }

  function buildAuthorizeUrl(config, state) {
    var params = new window.URLSearchParams();

    params.set("client_id", config.clientID);
    params.set("redirect_uri", config.callback);
    params.set("scope", config.scope);
    params.set("state", state);

    return config.authorizeURL + (config.authorizeURL.indexOf("?") === -1 ? "?" : "&") + params.toString();
  }

  function shouldUseFullPageAuth() {
    var userAgent = window.navigator.userAgent || "";

    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      return true;
    }

    if (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
      return true;
    }

    return window.innerWidth <= 760;
  }

  function closePopupWatcher() {
    if (popupWatcher) {
      window.clearInterval(popupWatcher);
      popupWatcher = 0;
    }
  }

  function watchPopup() {
    closePopupWatcher();

    popupWatcher = window.setInterval(function () {
      if (!popupRef) {
        closePopupWatcher();
        return;
      }

      if (popupRef.closed) {
        popupRef = null;
        closePopupWatcher();
        dispatch("cancel", { reason: "window_closed" });
      }
    }, 500);
  }

  function exchangeCode(payload) {
    return window
      .fetch(payload.exchangeURL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: payload.code,
          state: payload.state,
          redirect_uri: payload.callback
        })
      })
      .then(function (response) {
        return response.json().catch(function () {
          return { error: "invalid_json_response" };
        }).then(function (data) {
          if (!response.ok || !data || data.error || !data.access_token) {
            var message =
              (data && (data.error_description || data.error || data.message)) ||
              "oauth_exchange_failed";
            throw new Error(message);
          }

          return data;
        });
      });
  }

  function completeLogin(data, pending) {
    dispatch("exchange-start", { action: pending.action || "login" });

    return exchangeCode({
      code: data.code,
      state: data.state,
      callback: pending.callback,
      exchangeURL: pending.exchangeURL
    }).then(function (result) {
      if (!saveSession(result.access_token, result.user || {})) {
        throw new Error("storage_write_failed");
      }
      clearPending();
      dispatch("success", {
        action: pending.action || "login",
        user: normalizeUser(result.user || {})
      });

      if (pending.returnTo) {
        window.location.assign(pending.returnTo);
        return;
      }

      window.location.reload();
    });
  }

  function parseMessageData(event) {
    if (!event || event.origin !== window.location.origin) {
      return null;
    }

    if (typeof event.data === "string") {
      try {
        return JSON.parse(event.data);
      } catch (error) {
        return null;
      }
    }

    return event.data || null;
  }

  function handleAuthMessage(event) {
    var data = parseMessageData(event);
    var pending = readPending();

    if (!data || data.source !== authSource) {
      return;
    }

    closePopupWatcher();

    if (data.status === "error") {
      clearPending();
      dispatch("error", data);
      return;
    }

    if (!pending || pending.state !== data.state) {
      dispatch("error", { error: "state_mismatch" });
      return;
    }

    completeLogin(data, pending).catch(function (error) {
      dispatch("error", {
        error: "exchange_failed",
        message: error && error.message ? error.message : "oauth_exchange_failed"
      });
    });
  }

  function getPopupOptions() {
    var width = Math.max(Math.floor(window.outerWidth * 0.42), 420);
    var height = Math.max(Math.floor(window.outerHeight * 0.7), 640);
    var left = Math.max(window.screenX + Math.floor((window.outerWidth - width) / 2), 0);
    var top = Math.max(window.screenY + Math.floor((window.outerHeight - height) / 3), 0);

    return [
      "toolbar=0",
      "scrollbars=1",
      "status=1",
      "resizable=1",
      "location=1",
      "menubar=0",
      "width=" + width,
      "height=" + height,
      "left=" + left,
      "top=" + top
    ].join(",");
  }

  function startLogin(action) {
    var config = getConfig();
    var state;
    var url;

    if (!config.configured) {
      showSetup();
      dispatch("error", { error: "oauth_not_configured" });
      return;
    }

    state = createState();
    if (
      !writePending({
      state: state,
      action: action || "login",
      callback: config.callback,
      exchangeURL: config.exchangeURL,
      origin: window.location.origin,
      returnTo: window.location.href,
      createdAt: Date.now()
      })
    ) {
      dispatch("error", { error: "pending_state_write_failed" });
      return;
    }

    url = buildAuthorizeUrl(config, state);
    dispatch("start", { action: action || "login" });

    if (shouldUseFullPageAuth()) {
      window.location.assign(url);
      return;
    }

    popupRef = window.open(url, "Minmin GitHub OAuth", getPopupOptions());
    if (!popupRef) {
      window.location.assign(url);
      return;
    }

    if (typeof popupRef.focus === "function") {
      popupRef.focus();
    }

    watchPopup();
  }

  function install() {
    if (installed) {
      return;
    }

    installed = true;
    window.addEventListener("message", handleAuthMessage, false);
  }

  window.MinminWeiboOAuth = {
    install: install,
    getConfig: getConfig,
    hasSession: hasSession,
    getToken: getToken,
    getUser: getUser,
    saveSession: saveSession,
    clearSession: clearSession,
    showSetup: showSetup,
    startLogin: startLogin,
    clearPending: clearPending,
    readPending: readPending,
    constants: {
      pendingKey: pendingKey,
      tokenKey: tokenKey,
      userKey: userKey,
      authSource: authSource
    }
  };
})(window);
