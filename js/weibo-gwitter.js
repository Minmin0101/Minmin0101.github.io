(function (window, document) {
  var root = document.getElementById("gwitter");
  var config = window.MINMIN_WEIBO_CONFIG || {};
  var countCacheKey = "minmin-weibo-count-cache-v1";
  var revealObserver = null;
  var compactViewport =
    (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) ||
    window.innerWidth <= 760;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!root) {
    return;
  }

  window.__MINMIN_WEIBO_REPO_CONFIG__ = {
    owner: config.owner || "Minmin0101",
    repo: config.repo || "Minmin0101.github.io"
  };

  function isLocalMode() {
    return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
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

  function getRepoUrl() {
    return "https://github.com/" + (config.owner || "Minmin0101") + "/" + (config.repo || "Minmin0101.github.io");
  }

  function getIssuesUrl() {
    return getRepoUrl() + "/issues";
  }

  function getIssuesApiUrl() {
    return "https://api.github.com/repos/" + (config.owner || "Minmin0101") + "/" + (config.repo || "Minmin0101.github.io") + "/issues?state=open&per_page=20";
  }

  function normalizeButtonText(value) {
    return String(value || "")
      .replace(/\s+/g, "")
      .replace(/[^\w\u4e00-\u9fa5]/g, "")
      .toLowerCase();
  }

  function hasSecureOAuthClient() {
    return !!(
      window.MinminWeiboOAuth &&
      typeof window.MinminWeiboOAuth.startLogin === "function"
    );
  }

  function hasOAuthSession() {
    if (
      window.MinminWeiboOAuth &&
      typeof window.MinminWeiboOAuth.hasSession === "function"
    ) {
      return window.MinminWeiboOAuth.hasSession();
    }

    try {
      return !!(
        window.localStorage &&
        window.localStorage.getItem("github_token") &&
        window.localStorage.getItem("github_user")
      );
    } catch (error) {
      return false;
    }
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

  function resolveActionTargetUrl(button) {
    var card = button && button.closest ? button.closest("[data-issue-url]") : null;
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

  function pickIssueTag(issue) {
    var labels = (issue && issue.labels) || [];
    if (labels.length && labels[0] && labels[0].name) {
      return labels[0].name;
    }
    return "\u5fae\u535a";
  }

  function getLikeCount(issue) {
    var reactions = (issue && issue.reactions) || {};
    return normalizeCount(reactions.heart || reactions["+1"] || reactions.total_count || 0);
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
      return "<p>\u6682\u65e0\u6b63\u6587\u5185\u5bb9\u3002</p>";
    }

    return wrapper.innerHTML;
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

  function getLoginButton() {
    return root.querySelector(".minmin-weibo-login-button");
  }

  function triggerGithubLogin(action, sourceButton) {
    var oauth = getOAuthConfig();
    var targetUrl = resolveActionTargetUrl(sourceButton);

    if (hasOAuthSession()) {
      openGithubTarget(targetUrl, false);
      return;
    }

    if (oauth.configured && hasSecureOAuthClient()) {
      window.MinminWeiboOAuth.startLogin(action || "login");
      return;
    }

    openGithubTarget(targetUrl, true);
  }

  function applyLoginButtonState() {
    var loginButton = getLoginButton();
    var oauth = getOAuthConfig();
    var text = "\u767b\u5f55 GitHub";
    var title = "\u767b\u5f55 GitHub \u540e\u5373\u53ef\u70b9\u8d5e\u548c\u8bc4\u8bba";

    if (!loginButton) {
      return;
    }

    if (hasOAuthSession()) {
      text = "\u5df2\u8fde\u63a5 GitHub";
      title = "\u5f53\u524d\u5df2\u8fde\u63a5 GitHub\uff0c\u53ef\u4ee5\u7ee7\u7eed\u8df3\u8f6c\u5230 Issue \u9875\u9762";
    } else if (!oauth.configured) {
      title = "\u672a\u914d\u7f6e OAuth Worker\uff0c\u70b9\u51fb\u540e\u4f1a\u5148\u8df3\u8f6c GitHub \u767b\u5f55";
    }

    loginButton.setAttribute("title", title);
    loginButton.innerHTML = getLoginButtonMarkup() + '<span class="minmin-weibo-action-text">' + text + "</span>";
  }

  function bindActionButtons(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll("button[data-action]"), function (button) {
      if (button.getAttribute("data-action-bound") === "1") {
        return;
      }

      button.setAttribute("data-action-bound", "1");
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        triggerGithubLogin(button.getAttribute("data-action") || "login", button);
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
      "<strong>\u5fae\u535a\u6d41</strong>" +
      "<p>\u548c\u4f5c\u8005\u7ad9\u4e00\u6837\uff0c\u8fd9\u91cc\u73b0\u5728\u76f4\u63a5\u8bfb\u53d6 GitHub Issues \u4f5c\u4e3a\u56fe\u6587\u5fae\u535a\u6d41\u3002</p>" +
      "</div>" +
      '<div class="minmin-weibo-seed-actions">' +
      '<button type="button" class="minmin-weibo-login-button minmin-weibo-seed-action-button" data-action="login"></button>' +
      '<a class="minmin-weibo-action-link" href="' + escapeAttribute(getIssuesUrl()) + '" target="_blank" rel="noopener noreferrer">\u6253\u5f00 Issues</a>' +
      '<a class="minmin-weibo-action-link" href="' + escapeAttribute(getRepoUrl()) + '" target="_blank" rel="noopener noreferrer">\u6253\u5f00\u4ed3\u5e93</a>' +
      "</div>" +
      '<p class="minmin-weibo-toolbar-tip">\u672a\u767b\u5f55\u65f6\uff0c\u70b9\u8d5e\u548c\u8bc4\u8bba\u4f1a\u5148\u8df3\u8f6c GitHub \u767b\u5f55\uff1b\u767b\u5f55\u540e\u4f1a\u8df3\u5230\u5bf9\u5e94 Issue \u9875\u9762\u7ee7\u7eed\u64cd\u4f5c\u3002</p>' +
      "</section>" +
      '<div class="minmin-weibo-issue-list"></div>';

    bindActionButtons(root);
    applyLoginButtonState();
    markCard(root.querySelector(".minmin-weibo-toolbar-card"), 0);
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
      '<h3 class="minmin-weibo-seed-title">\u6b63\u5728\u52a0\u8f7d\u5fae\u535a\u6d41\u2026</h3>' +
      '<div class="markdown-body minmin-weibo-seed-body"><p>\u6b63\u5728\u4ece GitHub Issues \u8bfb\u53d6\u5185\u5bb9\uff0c\u8bf7\u7a0d\u5019\u4e00\u4e0b\u3002</p></div>' +
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
      '<h3 class="minmin-weibo-seed-title">\u8fd8\u6ca1\u6709\u53ef\u5c55\u793a\u7684\u5fae\u535a</h3>' +
      '<div class="markdown-body minmin-weibo-seed-body"><p>' + escapeHtml(message || "\u8bf7\u5148\u53d1\u5e03\u4e00\u6761 Open Issue\uff0c\u8fd9\u91cc\u5c31\u4f1a\u81ea\u52a8\u51fa\u73b0\u5bf9\u5e94\u7684\u56fe\u6587\u5fae\u535a\u5361\u7247\u3002") + "</p></div>" +
      '<div class="minmin-weibo-seed-actions">' +
      '<a class="minmin-weibo-action-link" href="' + escapeAttribute(getIssuesUrl()) + '" target="_blank" rel="noopener noreferrer">\u53d1\u5e03\u7b2c\u4e00\u6761\u5fae\u535a</a>' +
      "</div>" +
      "</section>";

    bindActionButtons(feed);
    markCard(feed.querySelector(".minmin-weibo-empty-card"), 1);
    publishVisibleCount(0, "empty");
  }

  function renderIssueCard(issue) {
    var issueUrl = issue.html_url || getIssuesUrl();
    var avatarUrl = (issue.user && issue.user.avatar_url) || "/img/avatar.png";
    var author = (issue.user && issue.user.login) || (config.owner || "Minmin0101");
    var bodyHtml = decorateIssueHtml(issue.body_html || "");

    return (
      '<article class="minmin-weibo-issue-card minmin-weibo-seed gwitter-card scroll-push-card" data-issue-url="' + escapeAttribute(issueUrl) + '">' +
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
      '<h3 class="minmin-weibo-seed-title">' + escapeHtml(issue.title || "\u672a\u547d\u540d\u5fae\u535a") + "</h3>" +
      '<div class="markdown-body minmin-weibo-seed-body">' + bodyHtml + "</div>" +
      '<div class="minmin-weibo-seed-actions">' +
      '<button type="button" class="like-button minmin-weibo-seed-action-button" data-action="like">' +
      '<span class="minmin-weibo-seed-action-icon" aria-hidden="true">\u2665</span>' +
      '<span class="minmin-weibo-action-text">\u8d5e ' + getLikeCount(issue) + "</span>" +
      "</button>" +
      '<button type="button" class="comment-button minmin-weibo-seed-action-button" data-action="comment">' +
      '<span class="minmin-weibo-seed-action-icon" aria-hidden="true">\u2709</span>' +
      '<span class="minmin-weibo-action-text">\u8bc4\u8bba ' + normalizeCount(issue.comments) + "</span>" +
      "</button>" +
      '<a class="minmin-weibo-action-link" href="' + escapeAttribute(issueUrl) + '" target="_blank" rel="noopener noreferrer">\u5728 GitHub \u4e2d\u67e5\u770b</a>' +
      '<span class="minmin-weibo-seed-action-note">\u70b9\u51fb\u4f1a\u8df3\u8f6c GitHub \u767b\u5f55\u6216 Issue \u9875\u9762</span>' +
      "</div>" +
      "</article>"
    );
  }

  function syncCards() {
    var cards = root.querySelectorAll(".scroll-push-card");
    var issueCards = root.querySelectorAll(".minmin-weibo-issue-card");

    Array.prototype.forEach.call(cards, function (card, index) {
      markCard(card, index);
    });

    bindActionButtons(root);
    applyLoginButtonState();
    publishVisibleCount(issueCards.length, issueCards.length ? "issues" : "empty");
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
    var ownerName = String(config.owner || "Minmin0101").toLowerCase();

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
      renderEmptyState("\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301 fetch\uff0c\u65e0\u6cd5\u76f4\u63a5\u8bfb\u53d6 GitHub Issues\u3002");
      return;
    }

    renderLoadingState();

    window
      .fetch(getIssuesApiUrl(), {
        headers: {
          Accept: "application/vnd.github.html+json"
        }
      })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("GitHub Issues request failed: " + response.status);
        }

        return response.json();
      })
      .then(function (payload) {
        renderIssues(normalizeIssues(payload));
      })
      .catch(function () {
        renderEmptyState("\u6682\u65f6\u6ca1\u80fd\u4ece GitHub \u8bfb\u53d6 Issues\uff0c\u4f60\u53ef\u4ee5\u70b9\u4e0b\u9762\u7684\u5165\u53e3\u76f4\u63a5\u6253\u5f00\u4ed3\u5e93 Issues \u770b\u770b\u3002");
      });
  }

  function bindSessionUpdates() {
    window.addEventListener("focus", applyLoginButtonState, false);
    window.addEventListener("storage", applyLoginButtonState, false);
    window.addEventListener("minmin:weibo-oauth:success", applyLoginButtonState, false);
    window.addEventListener("minmin:weibo-oauth:error", applyLoginButtonState, false);
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
