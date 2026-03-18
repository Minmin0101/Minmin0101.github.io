(function (window, document) {
  var CACHE_KEY = "minmin-weibo-count-cache-v1";
  var REMOTE_TTL = 90000;
  var DEFAULT_OWNER = "Minmin0101";
  var DEFAULT_REPO = "Minmin0101.github.io";
  var DEFAULT_FALLBACK_COUNT = 4;

  function parseCount(value) {
    var count = parseInt(value, 10);

    if (isNaN(count) || count < 0) {
      return null;
    }

    return count;
  }

  function getCountNodes() {
    return document.querySelectorAll('.statistics .total-link[href="/blog/weibo/"] .count');
  }

  function applyCount(count) {
    Array.prototype.forEach.call(getCountNodes(), function (node) {
      node.textContent = String(count);
      node.setAttribute("data-weibo-count", String(count));
    });

    window.__MINMIN_WEIBO_COUNT__ = count;
  }

  function readCache() {
    var payload = null;

    if (!window.localStorage) {
      return null;
    }

    try {
      payload = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
    } catch (error) {
      payload = null;
    }

    if (!payload || parseCount(payload.count) === null || parseCount(payload.updatedAt) === null) {
      return null;
    }

    return {
      count: parseCount(payload.count),
      updatedAt: parseCount(payload.updatedAt),
      source: payload.source || ""
    };
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

  function publishCount(count, source) {
    var payload = {
      count: count,
      updatedAt: Date.now(),
      source: source || ""
    };

    applyCount(count);

    if (window.localStorage) {
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      } catch (error) {
        // Ignore private-mode or storage quota failures.
      }
    }

    window.dispatchEvent(createCountEvent(payload));
  }

  function getFallbackCount() {
    var config = window.MINMIN_WEIBO_CONFIG || {};
    var seedCount = parseCount(window.__MINMIN_WEIBO_SEED_COUNT__);
    var explicitCount = parseCount(config.fallbackCount);

    if (seedCount !== null) {
      return seedCount;
    }

    if (explicitCount !== null) {
      return explicitCount;
    }

    return DEFAULT_FALLBACK_COUNT;
  }

  function getRepoConfig() {
    var config = window.MINMIN_WEIBO_CONFIG || {};
    var shared = window.__MINMIN_WEIBO_REPO_CONFIG__ || {};

    return {
      owner: shared.owner || config.owner || DEFAULT_OWNER,
      repo: shared.repo || config.repo || DEFAULT_REPO
    };
  }

  function fetchRemoteCount() {
    var repoConfig = getRepoConfig();
    var fallbackCount = getFallbackCount();
    var search = encodeURIComponent("repo:" + repoConfig.owner + "/" + repoConfig.repo + " is:issue state:open");

    if (!window.fetch) {
      return;
    }

    window
      .fetch("https://api.github.com/search/issues?q=" + search + "&per_page=1", {
        headers: {
          Accept: "application/vnd.github+json"
        }
      })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("GitHub search failed: " + response.status);
        }

        return response.json();
      })
      .then(function (payload) {
        var remoteCount = parseCount(payload && payload.total_count);
        var nextCount = remoteCount !== null && remoteCount > 0 ? remoteCount : fallbackCount;

        publishCount(nextCount, remoteCount !== null && remoteCount > 0 ? "github" : "seed");
      })
      .catch(function () {
        var cache = readCache();

        if (cache) {
          applyCount(cache.count);
          return;
        }

        applyCount(fallbackCount);
      });
  }

  function initWeiboCountSync() {
    var nodes = getCountNodes();
    var cache = readCache();
    var presetCount = parseCount(window.__MINMIN_WEIBO_COUNT__);

    if (!nodes.length) {
      return;
    }

    if (presetCount !== null) {
      applyCount(presetCount);
    } else if (cache) {
      applyCount(cache.count);
    } else {
      applyCount(getFallbackCount());
    }

    window.addEventListener("storage", function (event) {
      var nextCache = null;

      if (event.key !== CACHE_KEY) {
        return;
      }

      nextCache = readCache();
      if (nextCache) {
        applyCount(nextCache.count);
      }
    });

    window.addEventListener("minmin:weibo-count", function (event) {
      var detail = event && event.detail;
      var nextCount = parseCount(detail && detail.count);

      if (nextCount !== null) {
        applyCount(nextCount);
      }
    });

    if (!cache || Date.now() - cache.updatedAt > REMOTE_TTL) {
      fetchRemoteCount();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWeiboCountSync);
  } else {
    initWeiboCountSync();
  }
})(window, document);
