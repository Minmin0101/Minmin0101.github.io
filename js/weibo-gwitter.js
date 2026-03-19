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
    var scoped = isLocalMode() ? oauth.dev || {} : oauth.prod || {};
    var clientID = scoped.clientID || config.clientID || "";
    var exchangeURL = scoped.exchangeURL || config.exchangeURL || "";
    var callback = scoped.callback || config.callback || window.location.origin + "/blog/weibo/oauth-callback/";

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

  function getIssuesApiUrl() {
    return apiBase + "/issues?state=open&per_page=20";
  }

  function getIssueCommentsApiUrl(issueNumber) {
    return apiBase + "/issues/" + issueNumber + "/comments?per_page=100";
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

  function pickIssueTag(issue) {
    var labels = (issue && issue.labels) || [];

    if (labels.length && labels[0] && labels[0].name) {
      return labels[0].name;
    }

    return "微博";
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

  function createApiHeaders(options) {
    var headers = {
      Accept: options.accept || "application/vnd.github+json",
      "X-GitHub-Api-Version": githubApiVersion
    };
    var token = "";

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
      headers = createApiHeaders(settings);
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
    button.disabled = !!state.likeBusy;
    button.setAttribute("aria-pressed", state.liked ? "true" : "false");
    button.setAttribute("title", hasOAuthSession() ? (state.liked ? "取消点赞" : "点赞") : "登录 GitHub 后可直接点赞");
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
    textarea.disabled = !hasSession || !!state.commentSubmitting;
    textarea.placeholder = hasSession ? "写下你的评论，发布后会同步到这条 GitHub Issue。" : "登录 GitHub 后可直接在这里评论。";
    submit.disabled = !hasSession || !!state.commentSubmitting;
    submit.textContent = state.commentSubmitting ? "发送中…" : "发送评论";
    loginButton.hidden = hasSession;
  }

  function applyLoginButtonState() {
    var loginButton = getLoginButton();
    var oauth = getOAuthConfig();
    var viewer = getGithubUser();
    var text = "登录 GitHub";
    var title = "登录 GitHub 后即可在微博页内点赞和评论";

    if (!loginButton) {
      return;
    }

    if (hasOAuthSession()) {
      text = viewer && viewer.login ? "已连接 @" + viewer.login : "已连接 GitHub";
      title = "当前已连接 GitHub，可以直接在微博页内点赞和评论";
    } else if (!oauth.configured) {
      title = "当前还没有配置 OAuth，点击后会先跳转 GitHub 登录";
    }

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

    state.commentsLoading = true;
    state.commentsError = "";
    renderCommentList(card);

    return githubRequest(getIssueCommentsApiUrl(state.issueNumber), {
      accept: "application/vnd.github.html+json"
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
      '<a class="minmin-weibo-action-link" href="' + escapeAttribute(getIssuesUrl()) + '" target="_blank" rel="noopener noreferrer">发布第一条微博</a>' +
      "</div>" +
      "</section>";

    markCard(feed.querySelector(".minmin-weibo-empty-card"), 1);
    publishVisibleCount(0, "empty");
  }

  function createCommentPanelMarkup(issueNumber) {
    return (
      '<section class="minmin-weibo-comment-panel" hidden aria-label="微博评论区">' +
      '<div class="minmin-weibo-comment-feedback" hidden aria-live="polite"></div>' +
      '<div class="minmin-weibo-comment-list" data-issue-number="' + issueNumber + '"></div>' +
      '<form class="minmin-weibo-comment-form" novalidate>' +
      '<textarea class="minmin-weibo-comment-textarea" rows="3" maxlength="1000" placeholder="登录 GitHub 后可直接在这里评论。"></textarea>' +
      '<div class="minmin-weibo-comment-form-footer">' +
      '<span class="minmin-weibo-comment-tip">评论会直接同步到这条 GitHub Issue。</span>' +
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

    return (
      '<article class="minmin-weibo-issue-card minmin-weibo-seed gwitter-card scroll-push-card" data-issue-number="' + state.issueNumber + '" data-issue-url="' + escapeAttribute(state.issueUrl) + '">' +
      '<div class="minmin-weibo-seed-head">' +
      '<div class="minmin-weibo-seed-author">' +
      '<img class="minmin-weibo-seed-avatar" src="' + escapeAttribute(avatarUrl) + '" alt="' + escapeAttribute(author) + '">' +
      '<div class="minmin-weibo-seed-meta">' +
      "<strong>" + escapeHtml(author) + "</strong>" +
      "<span>" + escapeHtml(formatIssueDate(issue.created_at)) + "</span>" +
      "</div>" +
      "</div>" +
      '<span class="minmin-weibo-seed-tag">' + escapeHtml(pickIssueTag(issue)) + "</span>" +
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
      '<a class="minmin-weibo-action-link" href="' + escapeAttribute(state.issueUrl) + '" target="_blank" rel="noopener noreferrer">在 GitHub 中查看</a>' +
      '<span class="minmin-weibo-seed-action-note">登录后可直接在微博页内点赞和评论。</span>' +
      "</div>" +
      createCommentPanelMarkup(state.issueNumber) +
      "</article>"
    );
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

  function fetchIssues() {
    if (!window.fetch) {
      renderEmptyState("当前浏览器不支持 fetch，无法直接读取 GitHub Issues。");
      return;
    }

    renderLoadingState();

    githubRequest(getIssuesApiUrl(), {
      accept: "application/vnd.github.html+json"
    })
      .then(function (payload) {
        renderIssues(normalizeIssues(payload));
      })
      .catch(function () {
        renderEmptyState("暂时没能从 GitHub 读取 Issues，你可以点下面的入口直接打开仓库 Issues 看看。");
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
      "<p>这里现在直接读取 GitHub Issues 作为图文微博流，登录 GitHub 后可以直接在当前页面点赞和评论。</p>" +
      "</div>" +
      '<div class="minmin-weibo-seed-actions">' +
      '<button type="button" class="minmin-weibo-login-button minmin-weibo-seed-action-button" data-action="login"></button>' +
      '<a class="minmin-weibo-action-link" href="' + escapeAttribute(getIssuesUrl()) + '" target="_blank" rel="noopener noreferrer">打开 Issues</a>' +
      '<a class="minmin-weibo-action-link" href="' + escapeAttribute(getRepoUrl()) + '" target="_blank" rel="noopener noreferrer">打开仓库</a>' +
      "</div>" +
      '<p class="minmin-weibo-toolbar-tip">点赞会直接写入 GitHub Reaction，评论会直接发布到对应 Issue，整个过程都留在微博页里完成。</p>' +
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
      applyLoginButtonState();
      return;
    }

    clearPendingInteraction();
    startGithubAuth("login", button);
  }

  function toggleIssueLike(button) {
    var card = button && button.closest ? button.closest(".minmin-weibo-issue-card") : null;
    var state = getIssueStateFromCard(card);
    var request = null;

    if (!card || state.likeBusy) {
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
    Array.prototype.forEach.call(scope.querySelectorAll("button[data-action]"), function (button) {
      if (button.getAttribute("data-action-bound") === "1") {
        return;
      }

      button.setAttribute("data-action-bound", "1");
      button.addEventListener("click", function (event) {
        var action = button.getAttribute("data-action") || "";

        event.preventDefault();
        event.stopPropagation();

        if (action === "login") {
          handleLoginButton(button);
          return;
        }

        if (action === "like") {
          toggleIssueLike(button);
          return;
        }

        if (action === "comment") {
          openCommentPanel(button);
          return;
        }

        if (action === "comment-login") {
          handleCommentLogin(button);
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
      refreshSessionBoundUi(true);
      replayPendingInteraction();
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
