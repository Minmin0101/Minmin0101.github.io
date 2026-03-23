(function (window, document) {
  var root = document.getElementById("gwitter");
  var config = window.MINMIN_WEIBO_CONFIG || {};
  var repoOwner = config.owner || "Minmin0101";
  var repoName = config.repo || "Minmin0101.github.io";
  var apiBase = "https://api.github.com/repos/" + repoOwner + "/" + repoName;
  var countCacheKey = "minmin-weibo-count-cache-v1";
  var pendingInteractionKey = "minmin-weibo-interaction-pending-v1";
  var githubApiVersion = "2022-11-28";
  var issueStateMap = {};
  var revealObserver = null;
  var compactViewport =
    (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) ||
    window.innerWidth <= 760;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!root) {
    return;
  }

  window.__MINMIN_WEIBO_REPO_CONFIG__ = {
    owner: repoOwner,
    repo: repoName
  };

  function isLocalMode() {
    return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  }

  function getLocalStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function getSessionStorage() {
    try {
      return window.sessionStorage;
    } catch (error) {
      return null;
    }
  }

  function getOAuthConfig() {
    var oauth = config.oauth || {};
    var dev = oauth.dev || {};
    var prod = oauth.prod || {};
    var scoped = isLocalMode() ? dev : prod;
    var fallback = isLocalMode() ? prod : dev;
    var effective = scoped;
    var clientID = "";
    var exchangeURL = "";
    var callback = "";

    if (!(scoped && scoped.clientID && scoped.exchangeURL && scoped.callback)) {
      effective = fallback;
    }

    clientID = (effective && effective.clientID) || config.clientID || "";
    exchangeURL = (effective && effective.exchangeURL) || config.exchangeURL || "";
    callback = (effective && effective.callback) || config.callback || window.location.origin + "/blog/weibo/oauth-callback/";

    return {
      clientID: clientID,
      exchangeURL: exchangeURL,
      callback: callback,
      configured: !!(clientID && exchangeURL && callback)
    };
  }

  function hasSecureOAuthClient() {
    return !!(
      window.MinminWeiboOAuth &&
      typeof window.MinminWeiboOAuth.startLogin === "function"
    );
  }

  function getGithubToken() {
    var storage = getLocalStorage();

    if (window.MinminWeiboOAuth && typeof window.MinminWeiboOAuth.getToken === "function") {
      return window.MinminWeiboOAuth.getToken();
    }

    if (!storage) {
      return "";
    }

    try {
      return storage.getItem("github_token") || "";
    } catch (error) {
      return "";
    }
  }

  function getGithubUser() {
    var storage = getLocalStorage();
    var raw = "";

    if (window.MinminWeiboOAuth && typeof window.MinminWeiboOAuth.getUser === "function") {
      return window.MinminWeiboOAuth.getUser();
    }

    if (!storage) {
      return { login: "", avatarUrl: "" };
    }

    try {
      raw = storage.getItem("github_user") || "";
      return raw ? JSON.parse(raw) : { login: "", avatarUrl: "" };
    } catch (error) {
      return { login: "", avatarUrl: "" };
    }
  }

  function hasOAuthSession() {
    if (window.MinminWeiboOAuth && typeof window.MinminWeiboOAuth.hasSession === "function") {
      return window.MinminWeiboOAuth.hasSession();
    }

    return !!(getGithubToken() && getGithubUser().login);
  }

  function clearOAuthSession() {
    var storage = getLocalStorage();

    if (window.MinminWeiboOAuth && typeof window.MinminWeiboOAuth.clearSession === "function") {
      window.MinminWeiboOAuth.clearSession();
      return;
    }

    if (!storage) {
      return;
    }

    try {
      storage.removeItem("github_token");
      storage.removeItem("github_user");
    } catch (error) {
      // Ignore storage cleanup failures.
    }
  }

  function readPendingInteraction() {
    var storage = getSessionStorage();
    var payload = null;

    if (!storage) {
      return null;
    }

    try {
      payload = JSON.parse(storage.getItem(pendingInteractionKey) || "null");
    } catch (error) {
      payload = null;
    }

    if (!payload || !payload.action) {
      return null;
    }

    if (payload.createdAt && Date.now() - payload.createdAt > 15 * 60 * 1000) {
      clearPendingInteraction();
      return null;
    }

    return payload;
  }

  function writePendingInteraction(payload) {
    var storage = getSessionStorage();

    if (!storage) {
      return false;
    }

    try {
      storage.setItem(pendingInteractionKey, JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearPendingInteraction() {
    var storage = getSessionStorage();

    if (!storage) {
      return;
    }

    try {
      storage.removeItem(pendingInteractionKey);
    } catch (error) {
      // Ignore storage cleanup failures.
    }
  }

  function rememberPendingInteraction(action, sourceButton) {
    var card = sourceButton && sourceButton.closest ? sourceButton.closest(".minmin-weibo-issue-card") : null;
    var issueNumber = card ? parseInt(card.getAttribute("data-issue-number") || "0", 10) : 0;

    if (!action || !issueNumber) {
      return false;
    }

    return writePendingInteraction({
      action: action,
      issueNumber: issueNumber,
      createdAt: Date.now()
    });
  }

  function getRepoUrl() {
    return "https://github.com/" + repoOwner + "/" + repoName;
  }

  function getIssuesUrl() {
    return getRepoUrl() + "/issues";
  }

  function getPreferredExchangeUrl() {
    var oauth = config.oauth || {};
    var dev = oauth.dev || {};
    var prod = oauth.prod || {};
    var active = getOAuthConfig();

    return active.exchangeURL || prod.exchangeURL || dev.exchangeURL || config.exchangeURL || "";
  }

  function getPublicProxyBaseUrl() {
    var exchangeUrl = getPreferredExchangeUrl();

    if (!exchangeUrl) {
      return "";
    }

    try {
      return new URL(exchangeUrl).origin + "/github/public";
    } catch (error) {
      return "";
    }
  }

  function getIssuesApiUrl() {
    return apiBase + "/issues?state=open&per_page=20";
  }

  function getPublicIssuesApiUrl() {
    var proxyBase = getPublicProxyBaseUrl();

    if (!proxyBase) {
      return "";
    }

    return (
      proxyBase +
      "/issues?owner=" + encodeURIComponent(repoOwner) +
      "&repo=" + encodeURIComponent(repoName) +
      "&state=open&per_page=20"
    );
  }

  function getIssueCommentsApiUrl(issueNumber) {
    return apiBase + "/issues/" + issueNumber + "/comments?per_page=100";
  }

  function getPublicIssueCommentsApiUrl(issueNumber) {
    var proxyBase = getPublicProxyBaseUrl();
    var normalizedNumber = normalizeCount(issueNumber);

    if (!proxyBase || !normalizedNumber) {
      return "";
    }

    return (
      proxyBase +
      "/issues/" + normalizedNumber +
      "/comments?owner=" + encodeURIComponent(repoOwner) +
      "&repo=" + encodeURIComponent(repoName) +
      "&per_page=100"
    );
  }

  function getIssuesSnapshotUrl() {
    return "/blog/weibo/issues-cache.json?v=20260323";
  }

  function getCommentsSnapshotUrl() {
    return "/blog/weibo/comments-cache.json?v=20260323";
  }

  function getIssueCommentsCreateUrl(issueNumber) {
    return apiBase + "/issues/" + issueNumber + "/comments";
  }

  function getIssueReactionsApiUrl(issueNumber) {
    return apiBase + "/issues/" + issueNumber + "/reactions";
  }

  function getIssueReactionListUrl(issueNumber) {
    return getIssueReactionsApiUrl(issueNumber) + "?per_page=100&content=heart";
  }

  function getIssueReactionDeleteUrl(issueNumber, reactionId) {
    return getIssueReactionsApiUrl(issueNumber) + "/" + reactionId;
  }

  function buildGithubLoginUrl(targetUrl) {
    var targetPath = "/login";

    if (targetUrl) {
      try {
        targetPath = new URL(targetUrl).pathname;
      } catch (error) {
        targetPath = targetUrl;
      }
    }

    return "https://github.com/login?return_to=" + encodeURIComponent(targetPath || "/login");
  }

  function openGithubTarget(targetUrl, requireLogin) {
    var url = targetUrl || getIssuesUrl();

    if (requireLogin) {
      url = buildGithubLoginUrl(url);
    }

    if (compactViewport) {
      window.location.href = url;
      return;
    }

    window.open(url, "GitHub Login", "noopener,noreferrer,width=960,height=780");
  }

  function startGithubAuth(action, sourceButton) {
    var oauth = getOAuthConfig();
    var targetUrl = sourceButton ? resolveActionTargetUrl(sourceButton) : getIssuesUrl();

    if (oauth.configured && hasSecureOAuthClient()) {
      window.MinminWeiboOAuth.startLogin(action || "login");
      return;
    }

    openGithubTarget(targetUrl, true);
  }

  function resolveActionTargetUrl(button) {
    var card = button && button.closest ? button.closest(".minmin-weibo-issue-card") : null;
    return (card && card.getAttribute("data-issue-url")) || getIssuesUrl();
  }

  function resolveGithubActionUrl(element) {
    if (!element || typeof element.getAttribute !== "function") {
      return getIssuesUrl();
    }

    return element.getAttribute("data-github-url") || resolveActionTargetUrl(element);
  }

  function buildGithubGatewayHref(targetUrl) {
    return buildGithubLoginUrl(targetUrl || getIssuesUrl());
  }

  function getLoginButtonMarkup() {
    return (
      '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>'
    );
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function normalizeCount(value) {
    var count = parseInt(value, 10);

    if (isNaN(count) || count < 0) {
      return 0;
    }

    return count;
  }

  function createCountEvent(payload) {
    if (typeof window.CustomEvent === "function") {
      return new window.CustomEvent("minmin:weibo-count", {
        detail: payload
      });
    }

    var legacyEvent = document.createEvent("CustomEvent");
    legacyEvent.initCustomEvent("minmin:weibo-count", false, false, payload);
    return legacyEvent;
  }

  function updateMenuWeiboCount(count) {
    Array.prototype.forEach.call(
      document.querySelectorAll('.statistics .total-link[href="/blog/weibo/"] .count'),
      function (node) {
        node.textContent = String(count);
        node.setAttribute("data-weibo-count", String(count));
      }
    );
  }

  function publishVisibleCount(count, source) {
    var payload = {
      count: normalizeCount(count),
      source: source || "",
      updatedAt: Date.now()
    };

    updateMenuWeiboCount(payload.count);
    window.__MINMIN_WEIBO_COUNT__ = payload.count;

    if (window.localStorage) {
      try {
        window.localStorage.setItem(countCacheKey, JSON.stringify(payload));
      } catch (error) {
        // Ignore storage failures.
      }
    }

    window.dispatchEvent(createCountEvent(payload));
  }

  function formatIssueDate(value) {
    var date = value ? new Date(value) : null;

    if (!date || isNaN(date.getTime())) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(date);
    } catch (error) {
      return date.toISOString().slice(0, 10);
    }
  }

  function formatCommentDate(value) {
    var date = value ? new Date(value) : null;

    if (!date || isNaN(date.getTime())) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    } catch (error) {
      return date.toISOString().slice(0, 16).replace("T", " ");
    }
  }

  function normalizeLabelColor(value, fallback) {
    var color = String(value || "").trim().replace(/^#/, "");

    if (/^[0-9a-f]{3}$/i.test(color)) {
      return color
        .split("")
        .map(function (char) {
          return char + char;
        })
        .join("")
        .toLowerCase();
    }

    if (/^[0-9a-f]{6}$/i.test(color)) {
      return color.toLowerCase();
    }

    return String(fallback || "77aaff").replace(/^#/, "").toLowerCase();
  }

  function hexToRgb(value) {
    var normalized = normalizeLabelColor(value);

    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }

  function getIssueLabels(issue) {
    var labels = Array.isArray(issue && issue.labels) ? issue.labels : [];

    if (!labels.length) {
      return [
        {
          name: "微博",
          color: "77aaff"
        }
      ];
    }

    return labels
      .filter(function (label) {
        return label && label.name;
      })
      .map(function (label) {
        return {
          name: label.name,
          color: normalizeLabelColor(label.color || label.hex || "77aaff")
        };
      });
  }

  function getLabelStyle(color) {
    var rgb = hexToRgb(color);
    var hex = "#" + normalizeLabelColor(color);

    return (
      "--label-color:" + hex + ";" +
      "--label-bg:rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.14);" +
      "--label-border:rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.28);"
    );
  }

  function renderIssueLabels(issue) {
    return getIssueLabels(issue)
      .map(function (label) {
        return (
          '<span class="minmin-weibo-seed-tag" style="' + escapeAttribute(getLabelStyle(label.color)) + '">' +
          escapeHtml(label.name) +
          "</span>"
        );
      })
      .join("");
  }

  function isSnapshotOnlyIssue(issueOrState) {
    if (!issueOrState) {
      return false;
    }

    if (typeof issueOrState === "object" && issueOrState.snapshotOnly !== undefined) {
      return !!issueOrState.snapshotOnly;
    }

    return !!issueOrState.snapshot_only;
  }

  function getLikeCount(issue) {
    var reactions = (issue && issue.reactions) || {};
    return normalizeCount(reactions.heart || reactions["+1"] || reactions.total_count || 0);
  }

  function plainTextToHtml(text) {
    var source = String(text || "").trim();

    if (!source) {
      return "<p>暂无正文内容。</p>";
    }

    return source
      .split(/\n{2,}/)
      .map(function (block) {
        return "<p>" + escapeHtml(block).replace(/\n/g, "<br>") + "</p>";
      })
      .join("");
  }

  function decorateIssueHtml(html) {
    var wrapper = document.createElement("div");
    wrapper.innerHTML = html || "";

    Array.prototype.forEach.call(wrapper.querySelectorAll("a"), function (node) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    });

    Array.prototype.forEach.call(wrapper.querySelectorAll("img"), function (node) {
      node.setAttribute("loading", "lazy");
      node.setAttribute("decoding", "async");
      if (!node.getAttribute("alt")) {
        node.setAttribute("alt", "weibo image");
      }
    });

    if (!wrapper.innerHTML.trim()) {
      return "<p>暂无正文内容。</p>";
    }

    return wrapper.innerHTML;
  }

  function getCommentBodyHtml(comment) {
    return decorateIssueHtml(comment && (comment.body_html || plainTextToHtml(comment.body || "")));
  }

  function createGithubError(status, data) {
    var error = new Error((data && data.message) || "github_request_failed");
    error.status = status;
    error.data = data || null;
    return error;
  }

  function loadJsonSnapshot(url) {
    return window.fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    }).then(function (response) {
      if (!response.ok) {
        throw createGithubError(response.status, { message: "snapshot_fetch_failed" });
      }

      return response.json();
    });
  }

  function shouldAttachGithubApiVersion(url) {
    return /^https:\/\/api\.github\.com\//i.test(String(url || ""));
  }

  function createApiHeaders(options, url) {
    var headers = {
      Accept: options.accept || "application/vnd.github+json"
    };
    var token = "";

    if (shouldAttachGithubApiVersion(url)) {
      headers["X-GitHub-Api-Version"] = githubApiVersion;
    }

    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    if (options.auth) {
      token = getGithubToken();
      if (!token) {
        throw createGithubError(401, { message: "missing_github_token" });
      }
      headers.Authorization = "Bearer " + token;
    }

    return headers;
  }

  function githubRequest(url, options) {
    var settings = options || {};
    var headers = null;

    try {
      headers = createApiHeaders(settings, url);
    } catch (error) {
      return Promise.reject(error);
    }

    return window
      .fetch(url, {
        method: settings.method || "GET",
        headers: headers,
        body: settings.body ? JSON.stringify(settings.body) : undefined
      })
      .then(function (response) {
        if (response.status === 204) {
          return null;
        }

        return response
          .text()
          .catch(function () {
            return "";
          })
          .then(function (text) {
            var data = null;
            var contentType = response.headers.get("Content-Type") || "";

            if (text && contentType.indexOf("application/json") !== -1) {
              try {
                data = JSON.parse(text);
              } catch (error) {
                data = null;
              }
            } else if (text) {
              data = text;
            }

            if (!response.ok) {
              throw createGithubError(response.status, data);
            }

            return data;
          });
      });
  }

  function isAuthError(error) {
    return !!(error && (error.status === 401 || error.status === 403));
  }

  function resolveGithubErrorMessage(error, fallback) {
    var data = error && error.data;

    if (data && typeof data.message === "string" && data.message) {
      return data.message;
    }

    if (error && typeof error.message === "string" && error.message) {
      return error.message;
    }

    return fallback;
  }

  function getIssueState(issueOrNumber) {
    var issueNumber = typeof issueOrNumber === "object" ? normalizeCount(issueOrNumber.number) : normalizeCount(issueOrNumber);
    var issue = typeof issueOrNumber === "object" ? issueOrNumber : null;
    var state = issueStateMap[issueNumber];

    if (!state) {
      state = {
        issueNumber: issueNumber,
        issue: null,
        issueUrl: getIssuesUrl(),
        snapshotOnly: false,
        likeCount: 0,
        commentsCount: 0,
        liked: false,
        reactionId: "",
        comments: [],
        commentsLoaded: false,
        commentsLoading: false,
        commentsOpen: false,
        commentsError: "",
        commentSubmitting: false,
        likeBusy: false,
        viewerSyncedFor: ""
      };
      issueStateMap[issueNumber] = state;
    }

    if (issue) {
      state.issue = issue;
      state.issueUrl = issue.html_url || state.issueUrl;
      state.snapshotOnly = !!issue.snapshot_only;
      state.likeCount = getLikeCount(issue);
      state.commentsCount = normalizeCount(issue.comments);
    }

    return state;
  }

  function findIssueCard(issueNumber) {
    return root.querySelector('.minmin-weibo-issue-card[data-issue-number="' + issueNumber + '"]');
  }

  function getIssueStateFromCard(card) {
    return getIssueState(card ? card.getAttribute("data-issue-number") : 0);
  }

  function getLoginButton() {
    return root.querySelector(".minmin-weibo-login-button");
  }

  function getLikeButton(card) {
    return card ? card.querySelector(".like-button") : null;
  }

  function getCommentButton(card) {
    return card ? card.querySelector(".comment-button") : null;
  }

  function getCommentPanel(card) {
    return card ? card.querySelector(".minmin-weibo-comment-panel") : null;
  }

  function getCommentList(card) {
    return card ? card.querySelector(".minmin-weibo-comment-list") : null;
  }

  function getCommentFeedback(card) {
    return card ? card.querySelector(".minmin-weibo-comment-feedback") : null;
  }

  function getCommentForm(card) {
    return card ? card.querySelector(".minmin-weibo-comment-form") : null;
  }

  function getCommentTextarea(card) {
    return card ? card.querySelector(".minmin-weibo-comment-textarea") : null;
  }

  function getCommentSubmit(card) {
    return card ? card.querySelector(".minmin-weibo-comment-submit") : null;
  }

  function getCommentLoginButton(card) {
    return card ? card.querySelector(".minmin-weibo-comment-login-button") : null;
  }

  function ensureRevealObserver() {
    if (revealObserver || reduceMotion || !("IntersectionObserver" in window)) {
      return;
    }

    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.remove("reveal-ready");
            entry.target.classList.add("reveal-in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: compactViewport ? "0px 0px -4% 0px" : "0px 0px -10% 0px",
        threshold: compactViewport ? 0.06 : 0.14
      }
    );
  }

  function markCard(card, index) {
    if (!card || card.getAttribute("data-reveal-init") === "1") {
      return;
    }

    card.setAttribute("data-reveal-init", "1");

    if (reduceMotion) {
      card.classList.add("reveal-in");
      return;
    }

    card.classList.add("reveal-ready");
    card.style.setProperty("--reveal-delay", Math.min(index * 84, 336) + "ms");

    ensureRevealObserver();
    if (revealObserver) {
      revealObserver.observe(card);
    } else {
      card.classList.add("reveal-in");
    }
  }

  function setCommentFeedback(card, text, state) {
    var feedback = getCommentFeedback(card);

    if (!feedback) {
      return;
    }

    feedback.textContent = text || "";
    feedback.setAttribute("data-state", state || "");
    feedback.hidden = !text;
  }

  function renderCommentList(card) {
    var state = getIssueStateFromCard(card);
    var list = getCommentList(card);

    if (!list) {
      return;
    }

    if (state.commentsError && !state.commentsLoaded) {
      list.innerHTML = '<div class="minmin-weibo-comment-placeholder is-error">' + escapeHtml(state.commentsError) + "</div>";
      return;
    }

    if (state.commentsLoading && !state.commentsLoaded) {
      list.innerHTML = '<div class="minmin-weibo-comment-placeholder">正在加载评论…</div>';
      return;
    }

    if (!state.comments.length) {
      list.innerHTML = '<div class="minmin-weibo-comment-placeholder">还没有评论，来留下第一句吧。</div>';
      return;
    }

    list.innerHTML = state.comments
      .map(function (comment) {
        var user = comment.user || {};
        return (
          '<article class="minmin-weibo-comment-item">' +
          '<img class="minmin-weibo-comment-avatar" src="' + escapeAttribute(user.avatar_url || "/img/avatar.png") + '" alt="' + escapeAttribute(user.login || "GitHub user") + '">' +
          '<div class="minmin-weibo-comment-main">' +
          '<div class="minmin-weibo-comment-meta">' +
          "<strong>" + escapeHtml(user.login || "GitHub 用户") + "</strong>" +
          "<span>" + escapeHtml(formatCommentDate(comment.created_at)) + "</span>" +
          "</div>" +
          '<div class="markdown-body minmin-weibo-comment-body">' + getCommentBodyHtml(comment) + "</div>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function updateLikeButton(card) {
    var state = getIssueStateFromCard(card);
    var button = getLikeButton(card);
    var label = button ? button.querySelector(".minmin-weibo-action-text") : null;

    if (!button || !label) {
      return;
    }

    button.classList.toggle("is-active", !!state.liked);
    button.classList.toggle("is-busy", !!state.likeBusy);
    button.disabled = !!state.likeBusy || !!state.snapshotOnly;
    button.setAttribute("aria-pressed", state.liked ? "true" : "false");
    button.setAttribute(
      "title",
      state.snapshotOnly
        ? "这条测试微博暂不连接真实 GitHub 点赞。"
        : (hasOAuthSession() ? (state.liked ? "取消点赞" : "点赞") : "登录 GitHub 后可直接点赞")
    );
    label.textContent = "赞 " + normalizeCount(state.likeCount);
  }

  function updateCommentButton(card) {
    var state = getIssueStateFromCard(card);
    var button = getCommentButton(card);
    var label = button ? button.querySelector(".minmin-weibo-action-text") : null;

    if (!button || !label) {
      return;
    }

    button.classList.toggle("is-active", !!state.commentsOpen);
    button.setAttribute("aria-expanded", state.commentsOpen ? "true" : "false");
    button.setAttribute("title", hasOAuthSession() ? "展开评论并直接评论" : "展开评论列表");
    label.textContent = "评论 " + normalizeCount(state.commentsCount);
  }

  function updateCommentFormState(card) {
    var state = getIssueStateFromCard(card);
    var form = getCommentForm(card);
    var textarea = getCommentTextarea(card);
    var submit = getCommentSubmit(card);
    var loginButton = getCommentLoginButton(card);
    var hasSession = hasOAuthSession();

    if (!form || !textarea || !submit || !loginButton) {
      return;
    }

    form.classList.toggle("is-disabled", !hasSession);
    textarea.disabled = !hasSession || !!state.commentSubmitting || !!state.snapshotOnly;
    textarea.placeholder = state.snapshotOnly
      ? "这组测试微博只用来检查排版与标签效果，暂不连接真实评论。"
      : (hasSession ? "写下你的评论，发布后会同步到这条 GitHub Issue。" : "登录 GitHub 后可直接在这里评论。");
    submit.disabled = !hasSession || !!state.commentSubmitting || !!state.snapshotOnly;
    submit.textContent = state.commentSubmitting ? "发送中…" : "发送评论";
    loginButton.hidden = hasSession || !!state.snapshotOnly;
  }

  function applyLoginButtonState() {
    var loginButton = getLoginButton();
    var oauth = getOAuthConfig();
    var viewer = getGithubUser();
    var connected = hasOAuthSession();
    var text = "\u767b\u5f55 GitHub";
    var title = "\u767b\u5f55 GitHub \u540e\u4f1a\u56de\u5230\u5fae\u535a\u9875\uff0c\u4e4b\u540e\u5373\u53ef\u5728\u5f53\u524d\u9875\u9762\u70b9\u8d5e\u548c\u8bc4\u8bba";

    if (!loginButton) {
      return;
    }

    if (connected) {
      text = "\u9000\u51fa GitHub";
      title = viewer && viewer.login
        ? "\u5f53\u524d\u5df2\u4ee5 @" + viewer.login + " \u767b\u5f55\uff0c\u70b9\u51fb\u5373\u53ef\u9000\u51fa"
        : "\u5f53\u524d\u5df2\u8fde\u63a5 GitHub\uff0c\u70b9\u51fb\u5373\u53ef\u9000\u51fa";
    } else if (!oauth.configured) {
      title = "\u5f53\u524d\u8fd8\u6ca1\u6709\u914d\u7f6e OAuth\uff0c\u70b9\u51fb\u540e\u4f1a\u6253\u5f00 GitHub \u914d\u7f6e";
    }

    loginButton.classList.toggle("is-connected", connected);
    loginButton.setAttribute("title", title);
    loginButton.innerHTML = getLoginButtonMarkup() + '<span class="minmin-weibo-action-text">' + escapeHtml(text) + "</span>";
  }

  function findViewerHeartReaction(reactions) {
    var viewer = getGithubUser();
    var viewerLogin = String((viewer && viewer.login) || "").toLowerCase();
    var matched = null;

    if (!viewerLogin) {
      return null;
    }

    Array.prototype.forEach.call(reactions || [], function (reaction) {
      var userLogin = String((reaction && reaction.user && reaction.user.login) || "").toLowerCase();

      if (!matched && reaction && reaction.content === "heart" && userLogin === viewerLogin) {
        matched = reaction;
      }
    });

    return matched;
  }

  function syncLikeState(card, force) {
    var state = getIssueStateFromCard(card);
    var viewer = getGithubUser();
    var viewerLogin = String((viewer && viewer.login) || "").toLowerCase();

    if (!card) {
      return Promise.resolve();
    }

    if (state.snapshotOnly) {
      state.liked = false;
      state.reactionId = "";
      state.viewerSyncedFor = "";
      updateLikeButton(card);
      return Promise.resolve();
    }

    if (!hasOAuthSession() || !viewerLogin) {
      state.liked = false;
      state.reactionId = "";
      state.viewerSyncedFor = "";
      updateLikeButton(card);
      return Promise.resolve();
    }

    if (!force && state.viewerSyncedFor === viewerLogin) {
      updateLikeButton(card);
      return Promise.resolve();
    }

    return githubRequest(getIssueReactionListUrl(state.issueNumber), {
      auth: true
    }).then(function (reactions) {
      var matched = findViewerHeartReaction(reactions || []);

      state.likeCount = Array.isArray(reactions) ? reactions.length : normalizeCount(state.likeCount);
      state.liked = !!matched;
      state.reactionId = matched && matched.id ? String(matched.id) : "";
      state.viewerSyncedFor = viewerLogin;
      updateLikeButton(card);
    });
  }

  function loadComments(card, forceRefresh) {
    var state = getIssueStateFromCard(card);
    var hasSession = hasOAuthSession();
    var commentsUrl = hasSession ? getIssueCommentsApiUrl(state.issueNumber) : (getPublicIssueCommentsApiUrl(state.issueNumber) || getIssueCommentsApiUrl(state.issueNumber));

    if (!card) {
      return Promise.resolve([]);
    }

    if (state.commentsLoading) {
      return Promise.resolve(state.comments || []);
    }

    if (state.commentsLoaded && !forceRefresh) {
      renderCommentList(card);
      return Promise.resolve(state.comments || []);
    }

    if (state.snapshotOnly) {
      state.commentsLoading = true;
      state.commentsError = "";
      renderCommentList(card);

      return loadJsonSnapshot(getCommentsSnapshotUrl())
        .then(function (snapshot) {
          var snapshotComments = snapshot && snapshot[String(state.issueNumber)];

          state.comments = Array.isArray(snapshotComments) ? snapshotComments : [];
          state.commentsLoaded = true;
          state.commentsError = "";
          state.commentsCount = state.comments.length;
          renderCommentList(card);
          updateCommentButton(card);
          return state.comments;
        })
        .catch(function (error) {
          state.commentsError = resolveGithubErrorMessage(error, "测试评论加载失败，请稍后再试。");
          renderCommentList(card);
          throw error;
        })
        .finally(function () {
          state.commentsLoading = false;
        });
    }

    state.commentsLoading = true;
    state.commentsError = "";
    renderCommentList(card);

    return githubRequest(commentsUrl, {
      accept: "application/vnd.github.html+json",
      auth: hasSession
    })
      .then(function (comments) {
        state.comments = Array.isArray(comments) ? comments : [];
        state.commentsLoaded = true;
        state.commentsError = "";
        state.commentsCount = state.comments.length;
        renderCommentList(card);
        updateCommentButton(card);
        return state.comments;
      })
      .catch(function (error) {
        if (!hasSession) {
          return loadJsonSnapshot(getCommentsSnapshotUrl())
            .then(function (snapshot) {
              var snapshotComments = snapshot && snapshot[String(state.issueNumber)];

              if (!Array.isArray(snapshotComments)) {
                throw error;
              }

              state.comments = snapshotComments;
              state.commentsLoaded = true;
              state.commentsError = "";
              state.commentsCount = state.comments.length;
              renderCommentList(card);
              updateCommentButton(card);
              return state.comments;
            })
            .catch(function () {
              state.commentsError = resolveGithubErrorMessage(error, "评论加载失败，请稍后再试。");
              renderCommentList(card);
              throw error;
            });
        }

        state.commentsError = resolveGithubErrorMessage(error, "评论加载失败，请稍后再试。");
        renderCommentList(card);
        throw error;
      })
      .finally(function () {
        state.commentsLoading = false;
      });
  }

  function setCommentPanelOpen(card, options) {
    var state = getIssueStateFromCard(card);
    var panel = getCommentPanel(card);
    var textarea = getCommentTextarea(card);
    var loginButton = getCommentLoginButton(card);
    var settings = options || {};

    if (!panel) {
      return;
    }

    state.commentsOpen = settings.forceOpen ? true : !state.commentsOpen;
    panel.hidden = !state.commentsOpen;
    card.classList.toggle("is-comment-open", !!state.commentsOpen);
    updateCommentButton(card);
    updateCommentFormState(card);

    if (!state.commentsOpen) {
      return;
    }

    loadComments(card, false)
      .catch(function () {
        return null;
      })
      .then(function () {
        if (settings.focusComposer && textarea && !textarea.disabled) {
          textarea.focus();
        } else if (settings.focusLogin && loginButton && !loginButton.hidden) {
          loginButton.focus();
        }
      });
  }

  function renderLoadingState() {
    var feed = null;

    ensureShell();
    feed = root.querySelector(".minmin-weibo-issue-list");
    if (!feed) {
      return;
    }

    feed.innerHTML =
      '<section class="gwitter-card minmin-weibo-seed minmin-weibo-empty-card scroll-push-card">' +
      '<h3 class="minmin-weibo-seed-title">正在加载微博流…</h3>' +
      '<div class="markdown-body minmin-weibo-seed-body"><p>正在从 GitHub Issues 读取内容，请稍候一下。</p></div>' +
      "</section>";

    markCard(feed.querySelector(".minmin-weibo-empty-card"), 1);
  }

  function renderEmptyState(message) {
    var feed = null;

    ensureShell();
    feed = root.querySelector(".minmin-weibo-issue-list");
    if (!feed) {
      return;
    }

    feed.innerHTML =
      '<section class="gwitter-card minmin-weibo-seed minmin-weibo-empty-card scroll-push-card">' +
      '<h3 class="minmin-weibo-seed-title">还没有可展示的微博</h3>' +
      '<div class="markdown-body minmin-weibo-seed-body"><p>' + escapeHtml(message || "请先发布一条 Open Issue，这里就会自动出现对应的图文微博卡片。") + "</p></div>" +
      '<div class="minmin-weibo-seed-actions">' +
      '<a class="minmin-weibo-action-link" data-action="open-issues" data-github-url="' + escapeAttribute(getIssuesUrl()) + '" href="' + escapeAttribute(buildGithubGatewayHref(getIssuesUrl())) + '" target="_blank" rel="noopener noreferrer">发布第一条微博</a>' +
      "</div>" +
      "</section>";

    markCard(feed.querySelector(".minmin-weibo-empty-card"), 1);
    publishVisibleCount(0, "empty");
  }

  function createCommentPanelMarkup(issueNumber, snapshotOnly) {
    return (
      '<section class="minmin-weibo-comment-panel" hidden aria-label="微博评论区">' +
      '<div class="minmin-weibo-comment-feedback" hidden aria-live="polite"></div>' +
      '<div class="minmin-weibo-comment-list" data-issue-number="' + issueNumber + '"></div>' +
      '<form class="minmin-weibo-comment-form" novalidate>' +
      '<textarea class="minmin-weibo-comment-textarea" rows="3" maxlength="1000" placeholder="登录 GitHub 后可直接在这里评论。"></textarea>' +
      '<div class="minmin-weibo-comment-form-footer">' +
      '<span class="minmin-weibo-comment-tip">' + escapeHtml(snapshotOnly ? "这条是页面测试微博，评论区只用于展示样式。" : "评论会直接同步到这条 GitHub Issue。") + "</span>" +
      '<div class="minmin-weibo-comment-form-actions">' +
      '<button type="button" class="minmin-weibo-comment-login-button minmin-weibo-seed-action-button" data-action="comment-login">登录后评论</button>' +
      '<button type="submit" class="minmin-weibo-comment-submit">发送评论</button>' +
      "</div>" +
      "</div>" +
      "</form>" +
      "</section>"
    );
  }

  function renderIssueCard(issue) {
    var state = getIssueState(issue);
    var avatarUrl = (issue.user && issue.user.avatar_url) || "/img/avatar.png";
    var author = (issue.user && issue.user.login) || repoOwner;
    var bodyHtml = decorateIssueHtml(issue.body_html || "");
    var snapshotOnly = !!state.snapshotOnly;
    var issueViewMarkup = snapshotOnly
      ? '<span class="minmin-weibo-action-link is-static">测试微博</span>'
      : '<a class="minmin-weibo-action-link" data-action="view-issue" data-github-url="' + escapeAttribute(state.issueUrl) + '" href="' + escapeAttribute(buildGithubGatewayHref(state.issueUrl)) + '" target="_blank" rel="noopener noreferrer">在 GitHub 中查看</a>';
    var actionNote = snapshotOnly
      ? "这组测试微博只用来检查文案、图片和标签颜色，真实点赞评论仍以 GitHub Issues 为准。"
      : "登录后可直接在微博页内点赞和评论。";

    return (
      '<article class="minmin-weibo-issue-card minmin-weibo-seed gwitter-card scroll-push-card" data-issue-number="' + state.issueNumber + '" data-issue-url="' + escapeAttribute(state.issueUrl) + '" data-snapshot-only="' + (snapshotOnly ? "1" : "0") + '">' +
      '<div class="minmin-weibo-seed-head">' +
      '<div class="minmin-weibo-seed-author">' +
      '<img class="minmin-weibo-seed-avatar" src="' + escapeAttribute(avatarUrl) + '" alt="' + escapeAttribute(author) + '">' +
      '<div class="minmin-weibo-seed-meta">' +
      "<strong>" + escapeHtml(author) + "</strong>" +
      "<span>" + escapeHtml(formatIssueDate(issue.created_at)) + "</span>" +
      "</div>" +
      "</div>" +
      '<div class="minmin-weibo-seed-tags">' + renderIssueLabels(issue) + "</div>" +
      "</div>" +
      '<h3 class="minmin-weibo-seed-title">' + escapeHtml(issue.title || "未命名微博") + "</h3>" +
      '<div class="markdown-body minmin-weibo-seed-body">' + bodyHtml + "</div>" +
      '<div class="minmin-weibo-seed-actions">' +
      '<button type="button" class="like-button minmin-weibo-seed-action-button" data-action="like">' +
      '<span class="minmin-weibo-seed-action-icon" aria-hidden="true">♥</span>' +
      '<span class="minmin-weibo-action-text">赞 ' + normalizeCount(state.likeCount) + "</span>" +
      "</button>" +
      '<button type="button" class="comment-button minmin-weibo-seed-action-button" data-action="comment">' +
      '<span class="minmin-weibo-seed-action-icon" aria-hidden="true">✉</span>' +
      '<span class="minmin-weibo-action-text">评论 ' + normalizeCount(state.commentsCount) + "</span>" +
      "</button>" +
      issueViewMarkup +
      '<span class="minmin-weibo-seed-action-note">' + escapeHtml(actionNote) + "</span>" +
      "</div>" +
      createCommentPanelMarkup(state.issueNumber, snapshotOnly) +
      "</article>"
    );
  }

  function mergeIssues(primaryIssues, snapshotIssues) {
    var mergedMap = {};

    (primaryIssues || []).forEach(function (issue) {
      if (issue && issue.number) {
        mergedMap[String(issue.number)] = issue;
      }
    });

    (snapshotIssues || []).forEach(function (issue) {
      if (issue && issue.number && !mergedMap[String(issue.number)]) {
        mergedMap[String(issue.number)] = issue;
      }
    });

    return Object.keys(mergedMap)
      .map(function (key) {
        return mergedMap[key];
      })
      .sort(function (left, right) {
        return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
      });
  }

  function syncCards() {
    var cards = root.querySelectorAll(".scroll-push-card");
    var issueCards = root.querySelectorAll(".minmin-weibo-issue-card");

    Array.prototype.forEach.call(cards, function (card, index) {
      markCard(card, index);
    });

    Array.prototype.forEach.call(issueCards, function (card) {
      updateLikeButton(card);
      updateCommentButton(card);
      updateCommentFormState(card);
    });

    bindActionButtons(root);
    applyLoginButtonState();
    publishVisibleCount(issueCards.length, issueCards.length ? "issues" : "empty");
    hydrateIssueInteractions(issueCards);
    replayPendingInteraction();
  }

  function renderIssues(issues) {
    var feed = null;

    ensureShell();
    feed = root.querySelector(".minmin-weibo-issue-list");
    if (!feed) {
      return;
    }

    if (!issues.length) {
      renderEmptyState();
      return;
    }

    feed.innerHTML = issues.map(renderIssueCard).join("");
    syncCards();
  }

  function normalizeIssues(payload) {
    var onlyShowOwner = config.onlyShowOwner !== false;
    var ownerName = String(repoOwner).toLowerCase();

    return (payload || [])
      .filter(function (item) {
        if (!item || item.pull_request) {
          return false;
        }

        if (!onlyShowOwner) {
          return true;
        }

        return item.user && String(item.user.login || "").toLowerCase() === ownerName;
      })
      .map(function (item) {
        return item;
      });
  }

  function loadSnapshotIssues() {
    return loadJsonSnapshot(getIssuesSnapshotUrl())
      .then(function (snapshot) {
        return normalizeIssues(snapshot);
      })
      .catch(function () {
        return [];
      });
  }

  function fetchIssues() {
    var hasSession = hasOAuthSession();
    var issuesUrl = hasSession ? getIssuesApiUrl() : (getPublicIssuesApiUrl() || getIssuesApiUrl());

    if (!window.fetch) {
      renderEmptyState("当前浏览器不支持 fetch，无法直接读取 GitHub Issues。");
      return;
    }

    renderLoadingState();

    githubRequest(issuesUrl, {
      accept: "application/vnd.github.html+json",
      auth: hasSession
    })
      .then(function (payload) {
        return loadSnapshotIssues().then(function (snapshotIssues) {
          var primaryIssues = normalizeIssues(payload);
          renderIssues(primaryIssues.length ? primaryIssues : snapshotIssues);
        });
      })
      .catch(function (error) {
        return loadSnapshotIssues().then(function (snapshotIssues) {
          if (snapshotIssues.length) {
            renderIssues(snapshotIssues);
            return;
          }

          if (!hasSession) {
            if (!hasOAuthSession() && error && error.status === 403) {
              renderEmptyState("当前 GitHub 公共接口已达到匿名访问频率上限。登录 GitHub 后会自动回到微博页，并重新读取已经发布的微博。");
              return;
            }

            renderEmptyState(resolveGithubErrorMessage(error, "暂时没能从 GitHub 读取 Issues，你可以点下面的入口直接打开仓库 Issues 看看。"));
            return;
          }

          if (!hasOAuthSession() && error && error.status === 403) {
            renderEmptyState("当前 GitHub 公共接口已达到匿名访问频率上限。登录 GitHub 后会自动回到微博页，并重新读取已经发布的微博。");
            return;
          }

          renderEmptyState(resolveGithubErrorMessage(error, "暂时没能从 GitHub 读取 Issues，你可以点下面的入口直接打开仓库 Issues 看看。"));
        });
      });
  }

  function ensureShell() {
    if (root.getAttribute("data-weibo-shell-ready") === "1") {
      return;
    }

    root.setAttribute("data-weibo-shell-ready", "1");
    root.innerHTML =
      '<section class="gwitter-card minmin-weibo-seed minmin-weibo-toolbar-card scroll-push-card">' +
      '<div class="minmin-weibo-toolbar-copy">' +
      "<strong>微博流</strong>" +
      "<p>把那些来不及写成长文的心情、烟火和晚风，都轻轻收进这一页生活里。</p>" +
      "</div>" +
      '<div class="minmin-weibo-seed-actions">' +
      '<button type="button" class="minmin-weibo-login-button minmin-weibo-seed-action-button" data-action="login"></button>' +
      '<a class="minmin-weibo-action-link" data-action="open-issues" data-github-url="' + escapeAttribute(getIssuesUrl()) + '" href="' + escapeAttribute(buildGithubGatewayHref(getIssuesUrl())) + '" target="_blank" rel="noopener noreferrer">打开 Issues</a>' +
      '<a class="minmin-weibo-action-link" data-action="open-repo" data-github-url="' + escapeAttribute(getRepoUrl()) + '" href="' + escapeAttribute(buildGithubGatewayHref(getRepoUrl())) + '" target="_blank" rel="noopener noreferrer">打开仓库</a>' +
      "</div>" +
      '<p class="minmin-weibo-toolbar-tip">登录 GitHub 后会回到当前微博页，之后就能在这里直接点赞和评论。只有打开 Issues、打开仓库和在 GitHub 中查看会先跳转 GitHub 登录。</p>' +
      "</section>" +
      '<div class="minmin-weibo-issue-list"></div>';

    bindActionButtons(root);
    applyLoginButtonState();
    markCard(root.querySelector(".minmin-weibo-toolbar-card"), 0);
  }

  function handleAuthFailure(action, sourceButton) {
    clearOAuthSession();
    refreshSessionBoundUi(true);

    if (action && sourceButton) {
      rememberPendingInteraction(action, sourceButton);
    }

    startGithubAuth(action || "login", sourceButton);
  }

  function handleLoginButton(button) {
    if (hasOAuthSession()) {
      handleLogoutButton(button);
      return;
    }

    clearPendingInteraction();
    startGithubAuth("login", button);
  }

  function handleLogoutButton(button) {
    if (window.MinminWeiboOAuth && typeof window.MinminWeiboOAuth.clearPending === "function") {
      window.MinminWeiboOAuth.clearPending();
    }

    clearPendingInteraction();
    clearOAuthSession();
    refreshSessionBoundUi(true);

    if (button && typeof button.blur === "function") {
      button.blur();
    }
  }

  function handleGithubGatewayAction(element) {
    var targetUrl = resolveGithubActionUrl(element);
    var loginUrl = buildGithubGatewayHref(targetUrl);

    if (compactViewport) {
      window.location.assign(loginUrl);
      return;
    }

    window.open(loginUrl, "_blank", "noopener,noreferrer");
  }

  function toggleIssueLike(button) {
    var card = button && button.closest ? button.closest(".minmin-weibo-issue-card") : null;
    var state = getIssueStateFromCard(card);
    var request = null;

    if (!card || state.likeBusy) {
      return;
    }

    if (state.snapshotOnly) {
      setCommentFeedback(card, "这条测试微博只展示排版和标签效果，暂不连接真实点赞。", "info");
      updateLikeButton(card);
      return;
    }

    if (!hasOAuthSession()) {
      rememberPendingInteraction("like", button);
      startGithubAuth("like", button);
      return;
    }

    state.likeBusy = true;
    setCommentFeedback(card, "", "");
    updateLikeButton(card);

    if (state.liked && state.reactionId) {
      request = githubRequest(getIssueReactionDeleteUrl(state.issueNumber, state.reactionId), {
        method: "DELETE",
        auth: true
      });
    } else if (state.liked) {
      request = syncLikeState(card, true).then(function () {
        if (!state.reactionId) {
          return null;
        }

        return githubRequest(getIssueReactionDeleteUrl(state.issueNumber, state.reactionId), {
          method: "DELETE",
          auth: true
        });
      });
    } else {
      request = githubRequest(getIssueReactionsApiUrl(state.issueNumber), {
        method: "POST",
        auth: true,
        body: {
          content: "heart"
        }
      });
    }

    request
      .then(function () {
        return syncLikeState(card, true);
      })
      .catch(function (error) {
        if (isAuthError(error)) {
          handleAuthFailure("like", button);
          return;
        }

        setCommentFeedback(card, resolveGithubErrorMessage(error, "点赞操作失败，请稍后再试。"), "error");
      })
      .finally(function () {
        state.likeBusy = false;
        updateLikeButton(card);
      });
  }

  function openCommentPanel(button) {
    var card = button && button.closest ? button.closest(".minmin-weibo-issue-card") : null;

    if (!card) {
      return;
    }

    setCommentFeedback(card, "", "");
    setCommentPanelOpen(card, {
      focusComposer: hasOAuthSession(),
      focusLogin: !hasOAuthSession()
    });
  }

  function handleCommentLogin(button) {
    var card = button && button.closest ? button.closest(".minmin-weibo-issue-card") : null;

    if (!card) {
      return;
    }

    rememberPendingInteraction("comment", button);
    startGithubAuth("comment", button);
  }

  function submitComment(form) {
    var card = form && form.closest ? form.closest(".minmin-weibo-issue-card") : null;
    var state = getIssueStateFromCard(card);
    var textarea = getCommentTextarea(card);
    var commentButton = getCommentButton(card);
    var content = textarea ? String(textarea.value || "").trim() : "";

    if (!card || !textarea) {
      return;
    }

    if (state.snapshotOnly) {
      setCommentFeedback(card, "这条测试微博只展示评论区域样式，暂不连接真实评论。", "info");
      return;
    }

    if (!hasOAuthSession()) {
      rememberPendingInteraction("comment", commentButton || form);
      startGithubAuth("comment", commentButton || form);
      return;
    }

    if (!content) {
      setCommentFeedback(card, "评论内容还没填写。", "error");
      textarea.focus();
      return;
    }

    state.commentSubmitting = true;
    setCommentFeedback(card, "", "");
    updateCommentFormState(card);

    githubRequest(getIssueCommentsCreateUrl(state.issueNumber), {
      method: "POST",
      auth: true,
      accept: "application/vnd.github.html+json",
      body: {
        body: content
      }
    })
      .then(function (comment) {
        state.commentsLoaded = true;
        state.commentsError = "";
        state.comments = Array.isArray(state.comments) ? state.comments.slice() : [];
        state.comments.push(comment);
        state.commentsCount = state.comments.length;
        textarea.value = "";
        renderCommentList(card);
        updateCommentButton(card);
        setCommentFeedback(card, "评论已发送。", "success");
      })
      .catch(function (error) {
        if (isAuthError(error)) {
          handleAuthFailure("comment", commentButton || form);
          return;
        }

        setCommentFeedback(card, resolveGithubErrorMessage(error, "评论发送失败，请稍后再试。"), "error");
      })
      .finally(function () {
        state.commentSubmitting = false;
        updateCommentFormState(card);
      });
  }

  function hydrateIssueInteractions(scope) {
    var cards = scope || root.querySelectorAll(".minmin-weibo-issue-card");

    Array.prototype.forEach.call(cards, function (card) {
      updateCommentFormState(card);
      syncLikeState(card, false).catch(function () {
        return null;
      });
    });
  }

  function refreshSessionBoundUi(forceLikeSync) {
    var issueCards = root.querySelectorAll(".minmin-weibo-issue-card");

    applyLoginButtonState();
    Array.prototype.forEach.call(issueCards, function (card) {
      var state = getIssueStateFromCard(card);

      if (!hasOAuthSession()) {
        state.liked = false;
        state.reactionId = "";
        state.viewerSyncedFor = "";
      }

      updateLikeButton(card);
      updateCommentButton(card);
      updateCommentFormState(card);

      if (hasOAuthSession()) {
        syncLikeState(card, !!forceLikeSync).catch(function () {
          return null;
        });
      }
    });
  }

  function replayPendingInteraction() {
    var pending = readPendingInteraction();
    var retries = 0;

    if (!pending || !hasOAuthSession()) {
      return;
    }

    function runReplay() {
      var card = findIssueCard(pending.issueNumber);
      var likeButton = getLikeButton(card);
      var commentButton = getCommentButton(card);

      if (!card) {
        retries += 1;
        if (retries <= 8) {
          window.setTimeout(runReplay, 220);
        } else {
          clearPendingInteraction();
        }
        return;
      }

      clearPendingInteraction();

      if (pending.action === "like" && likeButton) {
        toggleIssueLike(likeButton);
        return;
      }

      if (pending.action === "comment" && commentButton) {
        setCommentPanelOpen(card, {
          forceOpen: true,
          focusComposer: true
        });
      }
    }

    runReplay();
  }

  function bindActionButtons(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll("[data-action]"), function (element) {
      if (element.getAttribute("data-action-bound") === "1") {
        return;
      }

      element.setAttribute("data-action-bound", "1");
      element.addEventListener("click", function (event) {
        var action = element.getAttribute("data-action") || "";

        event.preventDefault();
        event.stopPropagation();

        if (action === "login") {
          handleLoginButton(element);
          return;
        }

        if (action === "logout") {
          handleLogoutButton(element);
          return;
        }

        if (action === "open-issues" || action === "open-repo" || action === "view-issue") {
          handleGithubGatewayAction(element);
          return;
        }

        if (action === "like") {
          toggleIssueLike(element);
          return;
        }

        if (action === "comment") {
          openCommentPanel(element);
          return;
        }

        if (action === "comment-login") {
          handleCommentLogin(element);
        }
      });
    });

    Array.prototype.forEach.call(scope.querySelectorAll(".minmin-weibo-comment-form"), function (form) {
      if (form.getAttribute("data-submit-bound") === "1") {
        return;
      }

      form.setAttribute("data-submit-bound", "1");
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        submitComment(form);
      });
    });
  }

  function bindSessionUpdates() {
    window.addEventListener("focus", function () {
      refreshSessionBoundUi(false);
      replayPendingInteraction();
    }, false);

    window.addEventListener("storage", function () {
      refreshSessionBoundUi(true);
      replayPendingInteraction();
    }, false);

    window.addEventListener("minmin:weibo-oauth:success", function () {
      fetchIssues();
    }, false);

    window.addEventListener("minmin:weibo-oauth:error", function () {
      refreshSessionBoundUi(false);
    }, false);
  }

  function boot() {
    ensureShell();

    if (
      window.MinminWeiboOAuth &&
      typeof window.MinminWeiboOAuth.install === "function"
    ) {
      window.MinminWeiboOAuth.install();
    }

    bindSessionUpdates();
    fetchIssues();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window, document);
