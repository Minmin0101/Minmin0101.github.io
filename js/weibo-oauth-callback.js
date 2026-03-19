(function (window, document) {
  var storagePrefix = "minmin-weibo-oauth-pending-v1";
  var tokenKey = "github_token";
  var userKey = "github_user";
  var authSource = "minmin-weibo-oauth";
  var statusNode = document.getElementById("oauth-status");
  var detailNode = document.getElementById("oauth-detail");

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

  function setStatus(title, detail, state) {
    if (statusNode) {
      statusNode.textContent = title;
    }

    if (detailNode) {
      detailNode.textContent = detail;
    }

    if (state) {
      document.body.setAttribute("data-oauth-state", state);
    }
  }

  function readPending() {
    var storage = getSessionStorage();

    if (!storage) {
      return null;
    }

    try {
      return JSON.parse(storage.getItem(storagePrefix) || "null");
    } catch (error) {
      return null;
    }
  }

  function clearPending() {
    var storage = getSessionStorage();

    if (!storage) {
      return;
    }

    try {
      storage.removeItem(storagePrefix);
    } catch (error) {
      // Ignore storage cleanup failures.
    }
  }

  function normalizeUser(user) {
    return {
      login: (user && user.login) || "",
      avatarUrl: (user && (user.avatarUrl || user.avatar_url)) || ""
    };
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

  function parseParams() {
    var params = new window.URLSearchParams(window.location.search);

    return {
      code: params.get("code") || "",
      state: params.get("state") || "",
      error: params.get("error") || "",
      errorDescription: params.get("error_description") || ""
    };
  }

  function postToOpener(payload, pending) {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, (pending && pending.origin) || window.location.origin);
        return true;
      }
    } catch (error) {
      return false;
    }

    return false;
  }

  function redirectBack(pending, delay) {
    window.setTimeout(function () {
      window.location.replace((pending && pending.returnTo) || "/blog/weibo/");
    }, delay || 0);
  }

  function exchangeCode(pending, params) {
    return window
      .fetch(pending.exchangeURL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: params.code,
          state: params.state,
          redirect_uri: pending.callback
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

  function closeSoon(delay) {
    window.setTimeout(function () {
      window.close();
    }, delay || 0);
  }

  function handleError(params, pending) {
    var payload = {
      source: authSource,
      status: "error",
      error: params.error || "oauth_error",
      error_description: params.errorDescription || ""
    };

    if (postToOpener(payload, pending)) {
      setStatus("GitHub 登录未完成", "已经把错误状态传回微博页，这个窗口会自动关闭。", "error");
      closeSoon(240);
      return;
    }

    setStatus("GitHub 登录未完成", "请返回微博页后重试一次。", "error");
    clearPending();
    redirectBack(pending, 1000);
  }

  function run() {
    var params = parseParams();
    var pending = readPending();

    if (params.error) {
      handleError(params, pending);
      return;
    }

    if (!params.code || !pending || !pending.state || pending.state !== params.state) {
      setStatus("授权状态校验失败", "请返回微博页重新发起 GitHub 登录。", "error");
      clearPending();
      return;
    }

    if (
      postToOpener(
        {
          source: authSource,
          status: "code",
          code: params.code,
          state: params.state
        },
        pending
      )
    ) {
      setStatus("GitHub 授权已完成", "正在把授权结果传回微博页，这个窗口会自动关闭。", "success");
      closeSoon(240);
      redirectBack(pending, 900);
      return;
    }

    setStatus("正在完成安全登录", "当前设备会走同页回跳流程，正在安全交换访问令牌。", "loading");
    exchangeCode(pending, params)
      .then(function (result) {
        if (!saveSession(result.access_token, result.user || {})) {
          throw new Error("登录信息保存失败，请关闭无痕模式后再试一次。");
        }
        clearPending();
        setStatus("GitHub 登录成功", "稍后会自动回到微博页。", "success");
        redirectBack(pending, 320);
      })
      .catch(function (error) {
        setStatus(
          "GitHub 登录失败",
          (error && error.message) || "请返回微博页后重试一次。",
          "error"
        );
        clearPending();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})(window, document);
