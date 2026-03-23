(function (window, document) {
  var WEIBO_CACHE_KEY = "minmin-weibo-count-cache-v1";
  var GALLERY_CACHE_KEY = "minmin-gallery-count-cache-v1";
  var REMOTE_TTL = 90000;
  var DEFAULT_OWNER = "Minmin0101";
  var DEFAULT_REPO = "Minmin0101.github.io";
  var DEFAULT_FALLBACK_COUNT = 4;
  var DEFAULT_GALLERY_COUNT = 3;

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

  function getGalleryCountNodes() {
    return document.querySelectorAll('.statistics .total-link[href="/gallery/"] .count');
  }

  function applyCount(count) {
    Array.prototype.forEach.call(getCountNodes(), function (node) {
      node.textContent = String(count);
      node.setAttribute("data-weibo-count", String(count));
    });

    window.__MINMIN_WEIBO_COUNT__ = count;
  }

  function applyGalleryCount(count) {
    Array.prototype.forEach.call(getGalleryCountNodes(), function (node) {
      node.textContent = String(count);
      node.setAttribute("data-gallery-count", String(count));
    });

    window.__MINMIN_GALLERY_COUNT__ = count;
  }

  function readCache(cacheKey) {
    var payload = null;

    if (!window.localStorage) {
      return null;
    }

    try {
      payload = JSON.parse(window.localStorage.getItem(cacheKey) || "null");
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

  function createCountEvent(eventName, payload) {
    if (typeof window.CustomEvent === "function") {
      return new window.CustomEvent(eventName, {
        detail: payload
      });
    }

    var legacyEvent = document.createEvent("CustomEvent");
    legacyEvent.initCustomEvent(eventName, false, false, payload);
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
        window.localStorage.setItem(WEIBO_CACHE_KEY, JSON.stringify(payload));
      } catch (error) {
        // Ignore private-mode or storage quota failures.
      }
    }

    window.dispatchEvent(createCountEvent("minmin:weibo-count", payload));
  }

  function publishGalleryCount(count, source) {
    var payload = {
      count: count,
      updatedAt: Date.now(),
      source: source || ""
    };

    applyGalleryCount(count);

    if (window.localStorage) {
      try {
        window.localStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify(payload));
      } catch (error) {
        // Ignore private-mode or storage quota failures.
      }
    }

    window.dispatchEvent(createCountEvent("minmin:gallery-count", payload));
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

  function getGalleryFallbackCount() {
    var explicitCount = parseCount(window.__MINMIN_GALLERY_COUNT__);

    if (explicitCount !== null) {
      return explicitCount;
    }

    if (Array.isArray(window.galleryAlbums) && window.galleryAlbums.length) {
      return window.galleryAlbums.length;
    }

    return DEFAULT_GALLERY_COUNT;
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
        var cache = readCache(WEIBO_CACHE_KEY);

        if (cache) {
          applyCount(cache.count);
          return;
        }

        applyCount(fallbackCount);
      });
  }

  function extractGalleryCountFromHtml(html) {
    var payloadMatch = html && html.match(/window\.galleryAlbums=(\[[\s\S]*?\])<\/script>/);
    var countMatch = html && html.match(/href="\/gallery\/"><div class="count">(\d+)<\/div><div class="type">相册<\/div><\/a>/);
    var albums = null;
    var parsedCount = null;

    if (payloadMatch) {
      try {
        albums = JSON.parse(payloadMatch[1]);
      } catch (error) {
        albums = null;
      }

      if (Array.isArray(albums)) {
        return albums.length;
      }
    }

    if (countMatch) {
      parsedCount = parseCount(countMatch[1]);
    }

    return parsedCount;
  }

  function fetchGalleryRemoteCount() {
    var fallbackCount = getGalleryFallbackCount();

    if (!window.fetch) {
      return;
    }

    window
      .fetch("/gallery/index.html", {
        credentials: "same-origin"
      })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Gallery page fetch failed: " + response.status);
        }

        return response.text();
      })
      .then(function (html) {
        var remoteCount = extractGalleryCountFromHtml(html);
        var nextCount = remoteCount !== null && remoteCount > 0 ? remoteCount : fallbackCount;

        publishGalleryCount(nextCount, remoteCount !== null && remoteCount > 0 ? "gallery-page" : "seed");
      })
      .catch(function () {
        var cache = readCache(GALLERY_CACHE_KEY);

        if (cache) {
          applyGalleryCount(cache.count);
          return;
        }

        applyGalleryCount(fallbackCount);
      });
  }

  function initWeiboCountSync() {
    var nodes = getCountNodes();
    var cache = readCache(WEIBO_CACHE_KEY);
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

      if (event.key !== WEIBO_CACHE_KEY) {
        return;
      }

      nextCache = readCache(WEIBO_CACHE_KEY);
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

  function initGalleryCountSync() {
    var nodes = getGalleryCountNodes();
    var cache = readCache(GALLERY_CACHE_KEY);
    var presetCount = parseCount(window.__MINMIN_GALLERY_COUNT__);

    if (!nodes.length) {
      return;
    }

    if (presetCount !== null) {
      applyGalleryCount(presetCount);
    } else if (Array.isArray(window.galleryAlbums) && window.galleryAlbums.length) {
      applyGalleryCount(window.galleryAlbums.length);
    } else if (cache) {
      applyGalleryCount(cache.count);
    } else {
      applyGalleryCount(getGalleryFallbackCount());
    }

    window.addEventListener("storage", function (event) {
      var nextCache = null;

      if (event.key !== GALLERY_CACHE_KEY) {
        return;
      }

      nextCache = readCache(GALLERY_CACHE_KEY);
      if (nextCache) {
        applyGalleryCount(nextCache.count);
      }
    });

    window.addEventListener("minmin:gallery-count", function (event) {
      var detail = event && event.detail;
      var nextCount = parseCount(detail && detail.count);

      if (nextCount !== null) {
        applyGalleryCount(nextCount);
      }
    });

    if (!cache || Date.now() - cache.updatedAt > REMOTE_TTL) {
      fetchGalleryRemoteCount();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initWeiboCountSync();
      initGalleryCountSync();
    });
  } else {
    initWeiboCountSync();
    initGalleryCountSync();
  }
})(window, document);
