(function (window, document) {
  var root = document.getElementById("gwitter");
  var config = window.MINMIN_WEIBO_CONFIG || {};
  var revealObserver = null;
  var mutationObserver = null;
  var emptyStateTimer = 0;
  var bootAttempts = 0;
  var countCacheKey = "minmin-weibo-count-cache-v1";
  var seedPosts = config.seedPosts || [
    {
      date: "2026-03-18",
      title: "测试微博 01：最近把博客重做了一遍，才发现真正费时间的不是写代码，而是把每个边角都磨顺",
      tag: "布局测试",
      likes: 12,
      comments: 4,
      body:
        "<p>这两天一直在把博客从“能看”往“顺手”上推。最开始以为只是换个首页结构、补几个入口、把卡片样式统一一下，做着做着才发现，真正耗时的是那些你本来以为根本不重要的小地方。</p>" +
        "<p>比如标题区和正文之间的留白，如果大一点会松散，小一点又会拥挤；再比如右下角的固定按钮，在桌面端看很自然，到了移动端和 iPhone 安全区叠在一起就会显得很挤。很多时候不是某一个地方明显出错，而是十几个小地方都差一点点，最后体验就会不对。</p>" +
        "<p>所以我现在越来越理解，页面完成度其实不是靠“某个大设计”撑起来的，而是靠很多很小但一致的决定叠出来的。今天先把微博页、文章页和移动端头部顺了一遍，接下来还想继续补内容，把这个站点慢慢养成一个真正能长期记录的地方。</p>"
    },
    {
      date: "2026-03-17",
      title: "测试微博 02：如果只是想留下生活里的片段，微博流比长文章更适合那些还没长成完整表达的念头",
      tag: "内容测试",
      likes: 9,
      comments: 2,
      body:
        "<p>有些内容其实并不适合一上来就写成长文。它们可能只是某天晚上路过一家便利店时突然想到的一句话，也可能是做某个功能时顺手记下来的一个小判断，又或者只是今天情绪比昨天平静了一点点。</p>" +
        "<p>如果硬要把这些内容写成正式文章，反而很容易拖着不写，最后就这么散掉了。微博流的好处是，它允许这些还没有完全长成形状的想法，先以很轻的方式被留住。等以后回头看，也许其中有一些会长成新的文章、项目，或者只是提醒自己：原来那段时间是这么过来的。</p>" +
        "<p>所以我现在挺想把微博页认真经营起来，不一定每条都很“有信息量”，但至少它们都是真实发生过、真实想到过的东西。长期看，这种细碎的记录也会慢慢拼出一个更完整的自己。</p>"
    },
    {
      date: "2026-03-16",
      title: "测试微博 03：移动端适配最容易低估，但真正决定一个页面是不是能每天都愿意打开",
      tag: "移动端测试",
      likes: 15,
      comments: 6,
      body:
        "<p>最近反复在手机上看自己的页面，感受特别明显：很多在桌面端觉得“没问题”的设计，到了手机上就完全不是一回事。按钮离边缘太近一点、标题断行多一行、列表之间的间距少一点，都会立刻影响读下去的心情。</p>" +
        "<p>尤其是 iOS 端，安全区、回弹、输入框焦点和固定元素之间的关系都特别敏感。你在电脑上只觉得是一个悬浮按钮，到了手机上它可能就会挡住手势区；你在桌面端觉得卡片阴影刚刚好，到了小屏上可能就显得很重。适配这件事从来不是把尺寸缩小就结束，而是要重新判断“这个页面在手里滑动时是不是舒服”。</p>" +
        "<p>所以这次做微博页，我反而把很多精力放在了小屏上的点击区、安全区、段落密度和滚动节奏上。页面如果想长期用下去，最后决定体验的往往不是大视觉，而是这些看起来没那么显眼的细节。</p>"
    },
    {
      date: "2026-03-15",
      title: "测试微博 04：我想把这个站慢慢养成一个不用刻意包装，也愿意持续更新的记录空间",
      tag: "长文测试",
      likes: 18,
      comments: 5,
      body:
        "<p>以前每次想更新博客，都会下意识觉得“这篇得像一篇完整文章才值得发”。结果就是很多想法停留在草稿箱里，因为它们还不够成熟、不够完整，或者只是没整理到一个适合公开发布的程度。</p>" +
        "<p>但这段时间我越来越想明白一件事：记录本身就有价值，不一定非得等到一切都准备好才开始。你正在经历的调整、今天做出的一个小决定、甚至是某个本来很普通的下午，都有可能在未来某一天变成很重要的参照物。真正的记录空间，不是只收纳那些“已经完成”的东西，也应该能容纳过程、犹豫、试错和变化。</p>" +
        "<p>所以这次把微博页做出来，对我来说不只是多了一个栏目，而是多了一种更轻的表达方式。以后这里可以放项目过程中的碎片、生活里的小感受、最近在读的东西，或者只是某一天特别想记住的一瞬间。希望慢慢地，这里会比以前更像一个真实生活着的站点。</p>"
    }
  ];
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var compactViewport =
    (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) ||
    window.innerWidth <= 760;

  window.__MINMIN_WEIBO_REPO_CONFIG__ = {
    owner: config.owner || "Minmin0101",
    repo: config.repo || "Minmin0101.github.io"
  };
  window.__MINMIN_WEIBO_SEED_COUNT__ = seedPosts.length;

  if (!root) {
    return;
  }

  function isLocalMode() {
    return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  }

  function getOAuthConfig() {
    var oauth = config.oauth || {};
    var scoped = isLocalMode() ? oauth.dev || {} : oauth.prod || {};
    var clientID = scoped.clientID || config.clientID || "";
    var clientSecret = scoped.clientSecret || config.clientSecret || "";
    var callback = scoped.callback || window.location.href;

    return {
      clientID: clientID,
      clientSecret: clientSecret,
      callback: callback,
      configured: !!(clientID && clientSecret)
    };
  }

  function getRepoUrl() {
    var owner = config.owner || "Minmin0101";
    var repo = config.repo || "Minmin0101.github.io";

    return "https://github.com/" + owner + "/" + repo;
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
        // Ignore storage failures in private mode.
      }
    }

    window.dispatchEvent(createCountEvent(payload));
  }

  function getLoginButton() {
    var buttons = root.querySelectorAll("button");
    var found = null;

    Array.prototype.forEach.call(buttons, function (button) {
      if (found) {
        return;
      }

      if ((button.textContent || "").replace(/\s+/g, "").indexOf("登录GitHub") !== -1) {
        found = button;
      }
    });

    return found;
  }

  function triggerGithubLogin(action) {
    var loginButton = getLoginButton();
    var repoUrl = getRepoUrl();

    if (loginButton) {
      loginButton.click();
      return;
    }

    window.open(repoUrl + "/issues", "_blank", "noopener,noreferrer");
    if (window.console && window.console.info) {
      window.console.info("GitHub login button not found, opened repo issues instead for action:", action);
    }
  }

  function applyLoginButtonState() {
    var oauth = getOAuthConfig();
    var loginButton = getLoginButton();

    if (!loginButton) {
      return;
    }

    if (!oauth.configured) {
      loginButton.setAttribute("data-login-configured", "0");
      loginButton.title = "先在 MINMIN_WEIBO_CONFIG.oauth 中填写 GitHub OAuth 配置";
      loginButton.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>配置 GitHub 登录';

      if (loginButton.getAttribute("data-login-fallback-bound") !== "1") {
        loginButton.setAttribute("data-login-fallback-bound", "1");
        loginButton.addEventListener(
          "click",
          function (event) {
            event.preventDefault();
            event.stopPropagation();
            window.open("https://github.com/settings/developers", "_blank", "noopener,noreferrer");
          },
          true
        );
      }
      return;
    }

    loginButton.setAttribute("data-login-configured", "1");
  }

  function bindSeedActions(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll(".minmin-weibo-seed-action-button"), function (button) {
      if (button.getAttribute("data-action-bound") === "1") {
        return;
      }

      button.setAttribute("data-action-bound", "1");
      button.addEventListener("click", function () {
        triggerGithubLogin(button.getAttribute("data-action") || "interact");
      });
    });
  }

  function createSeedList() {
    var list = document.createElement("div");

    list.className = "minmin-weibo-seed-list";
    list.innerHTML = seedPosts
      .map(function (post) {
        return (
          '<article class="minmin-weibo-seed gwitter-card scroll-push-card">' +
          '<div class="minmin-weibo-seed-head">' +
          '<div class="minmin-weibo-seed-author">' +
          '<img class="minmin-weibo-seed-avatar" src="/img/avatar.png" alt="衰小孩">' +
          '<div class="minmin-weibo-seed-meta">' +
          '<strong>衰小孩</strong>' +
          "<span>" +
          post.date +
          "</span>" +
          "</div>" +
          "</div>" +
          '<span class="minmin-weibo-seed-tag">' +
          post.tag +
          "</span>" +
          "</div>" +
          '<h3 class="minmin-weibo-seed-title">' +
          post.title +
          "</h3>" +
          '<div class="markdown-body minmin-weibo-seed-body">' +
          post.body +
          "</div>" +
          '<div class="minmin-weibo-seed-actions">' +
          '<button type="button" class="minmin-weibo-seed-action-button" data-action="like" title="登录 GitHub 后点赞">' +
          '<span class="minmin-weibo-seed-action-icon" aria-hidden="true">♡</span>' +
          '<span class="minmin-weibo-seed-action-text">赞 ' +
          post.likes +
          "</span>" +
          "</button>" +
          '<button type="button" class="minmin-weibo-seed-action-button" data-action="comment" title="登录 GitHub 后评论">' +
          '<span class="minmin-weibo-seed-action-icon" aria-hidden="true">⌁</span>' +
          '<span class="minmin-weibo-seed-action-text">评论 ' +
          post.comments +
          "</span>" +
          "</button>" +
          '<span class="minmin-weibo-seed-action-note">点击会跳转 GitHub 登录</span>' +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    bindSeedActions(list);

    return list;
  }

  function isIssueCard(node) {
    return !!(
      node &&
      node.querySelector &&
      node.querySelectorAll(".like-button").length === 1 &&
      node.querySelectorAll(".comment-button").length === 1 &&
      node.querySelectorAll(".markdown-body").length === 1 &&
      node.querySelector('a[title="在 GitHub 中查看"], a[href*="/issues/"]') &&
      node.offsetHeight > 120
    );
  }

  function findIssueCards() {
    var cards = [];
    var seen = [];

    Array.prototype.forEach.call(root.querySelectorAll(".like-button"), function (button) {
      var node = button.parentElement;

      while (node && node !== root) {
        if (isIssueCard(node)) {
          if (seen.indexOf(node) === -1) {
            seen.push(node);
            cards.push(node);
          }
          break;
        }

        node = node.parentElement;
      }
    });

    return cards;
  }

  function revealCard(card) {
    card.classList.remove("reveal-ready");
    card.classList.add("reveal-in");
  }

  function ensureRevealObserver() {
    if (revealObserver || reduceMotion || !("IntersectionObserver" in window)) {
      return;
    }

    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            revealCard(entry.target);
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
    if (card.getAttribute("data-reveal-init") === "1") {
      return;
    }

    card.setAttribute("data-reveal-init", "1");
    card.classList.add("weibo-entry", "scroll-push-card", "gwitter-card");

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
      revealCard(card);
    }
  }

  function syncSeedFeed(cards) {
    var existing = root.querySelector(".minmin-weibo-seed-list");

    if (cards.length) {
      publishVisibleCount(cards.length, "issues");

      if (emptyStateTimer) {
        window.clearTimeout(emptyStateTimer);
        emptyStateTimer = 0;
      }

      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }

      return;
    }

    if (!seedPosts.length || existing || emptyStateTimer) {
      if (!seedPosts.length && !existing) {
        publishVisibleCount(0, "empty");
      }
      return;
    }

    emptyStateTimer = window.setTimeout(function () {
      emptyStateTimer = 0;
      if (!findIssueCards().length && !root.querySelector(".minmin-weibo-seed-list")) {
        root.appendChild(createSeedList());
        Array.prototype.forEach.call(root.querySelectorAll(".minmin-weibo-seed"), function (card, index) {
          markCard(card, index);
        });
        bindSeedActions(root);
        publishVisibleCount(seedPosts.length, "seed");
      }
    }, 1800);
  }

  function syncCards() {
    var cards = findIssueCards();

    cards.forEach(function (card, index) {
      markCard(card, index);
    });

    syncSeedFeed(cards);
    applyLoginButtonState();

    if (cards.length) {
      publishVisibleCount(cards.length, "issues");
      return;
    }

    if (root.querySelector(".minmin-weibo-seed-list")) {
      publishVisibleCount(seedPosts.length, "seed");
      return;
    }

    if (!seedPosts.length) {
      publishVisibleCount(0, "empty");
    }
  }

  function mountGwitter() {
    var oauth = getOAuthConfig();
    var request = {
      owner: config.owner || "Minmin0101",
      repo: config.repo || "Minmin0101.github.io"
    };

    // Fill MINMIN_WEIBO_CONFIG.oauth.dev / prod with your own GitHub OAuth App credentials.
    if (oauth.clientID) {
      request.clientID = oauth.clientID;
    }

    if (oauth.clientSecret) {
      request.clientSecret = oauth.clientSecret;
    }

    window.gwitter({
      container: root,
      config: {
        app: {
          enableAbout: false,
          enableEgg: false,
          onlyShowOwner: true,
          enableRepoSwitcher: false
        },
        request: request
      }
    });
  }

  function boot() {
    if (!window.gwitter) {
      bootAttempts += 1;
      if (bootAttempts < 25) {
        window.setTimeout(boot, 120);
      }
      return;
    }

    if (!root.getAttribute("data-gwitter-mounted")) {
      root.setAttribute("data-gwitter-mounted", "1");
      mountGwitter();
    }

    if (!mutationObserver) {
      mutationObserver = new MutationObserver(syncCards);
      mutationObserver.observe(root, { childList: true, subtree: true });
    }

    syncCards();
    window.setTimeout(syncCards, 800);
    window.setTimeout(syncCards, 2200);
    window.setTimeout(syncCards, 4200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window, document);
