(function () {
  var win = window;
  var doc = document;
  var blog = win.BLOG || {};
  var root = (blog.ROOT || "/").replace(/\/?$/, "/");
  var interactionEvent = blog.even || ("ontouchstart" in win ? "touchstart" : "click");
  var postsCache = null;
  var requestState = {
    loading: false,
    queue: []
  };
  var entityDecoder = doc.createElement("textarea");
  var searchWrap = doc.querySelector("#search-wrap");
  var searchButton = doc.querySelector("#search");
  var backButton = doc.querySelector("#back");
  var searchInput = doc.querySelector("#key");
  var searchPanel = doc.querySelector("#search-panel");
  var searchResult = doc.querySelector("#search-result");
  var html = doc.documentElement;

  if (!searchWrap || !searchButton || !backButton || !searchInput || !searchPanel || !searchResult) {
    return;
  }

  if (searchWrap.getAttribute("data-fuzzy-search-ready") === "1") {
    return;
  }

  searchWrap.setAttribute("data-fuzzy-search-ready", "1");
  injectStyles();

  searchButton = replaceNode(searchButton);
  backButton = replaceNode(backButton);
  searchInput = replaceNode(searchInput);

  bindActivate(searchButton, function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (searchWrap.classList.contains("in") && !searchInput.value.trim()) {
      closeSearch();
      return;
    }

    openSearch();
  });

  bindActivate(backButton, function (event) {
    event.preventDefault();
    event.stopPropagation();
    closeSearch();
  });

  searchInput.addEventListener("input", function (event) {
    performSearch(event.target.value);
  });

  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      performSearch(searchInput.value, true);
    }
  });

  searchResult.addEventListener("click", function (event) {
    var item = findResultItem(event.target);

    if (!item) {
      return;
    }

    event.preventDefault();
    navigateTo(item.getAttribute("data-path"));
  });

  searchResult.addEventListener("keydown", function (event) {
    var item = findResultItem(event.target);

    if (!item) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateTo(item.getAttribute("data-path"));
    }
  });

  stopInside(searchWrap);
  stopInside(searchPanel);

  doc.addEventListener("click", function (event) {
    if (!searchWrap.classList.contains("in")) {
      return;
    }

    if (searchWrap.contains(event.target) || searchPanel.contains(event.target)) {
      return;
    }

    closeSearch();
  });

  if (interactionEvent !== "click") {
    doc.addEventListener(interactionEvent, function (event) {
      if (!searchWrap.classList.contains("in")) {
        return;
      }

      if (searchWrap.contains(event.target) || searchPanel.contains(event.target)) {
        return;
      }

      closePanel();
    });
  }

  function injectStyles() {
    if (doc.getElementById("search-fuzzy-style")) {
      return;
    }

    var link = doc.createElement("link");
    link.id = "search-fuzzy-style";
    link.rel = "stylesheet";
    link.href = (root + "css/search-fuzzy.css?v=20260319-3").replace(/\/{2,}/g, "/");
    doc.head.appendChild(link);
  }

  function replaceNode(node) {
    var clone = node.cloneNode(true);
    node.parentNode.replaceChild(clone, node);
    return clone;
  }

  function bindActivate(element, handler) {
    var lastTouchAt = 0;

    element.addEventListener("click", function (event) {
      if (interactionEvent !== "click" && Date.now() - lastTouchAt < 420) {
        event.preventDefault();
        return;
      }

      handler(event);
    });

    if (interactionEvent !== "click") {
      element.addEventListener(interactionEvent, function (event) {
        lastTouchAt = Date.now();
        handler(event);
      });
    }
  }

  function stopInside(element) {
    element.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    if (interactionEvent !== "click") {
      element.addEventListener(interactionEvent, function (event) {
        event.stopPropagation();
      });
    }
  }

  function openSearch() {
    searchWrap.classList.add("in");
    searchInput.focus();

    if (searchInput.value.trim()) {
      performSearch(searchInput.value);
    } else {
      searchResult.innerHTML = "";
      closePanel();
    }
  }

  function closeSearch() {
    searchWrap.classList.remove("in");
    searchInput.blur();
    searchInput.value = "";
    closePanel();
  }

  function openPanel() {
    if (win.innerWidth < 760) {
      html.classList.add("lock-size");
    }

    searchPanel.classList.add("in");
  }

  function closePanel() {
    if (win.innerWidth < 760) {
      html.classList.remove("lock-size");
    }

    searchPanel.classList.remove("in");
  }

  function performSearch(rawQuery, fromEnter) {
    var query = String(rawQuery || "").trim();

    if (!query) {
      searchResult.innerHTML = "";
      closePanel();
      return;
    }

    if (!searchWrap.classList.contains("in")) {
      searchWrap.classList.add("in");
    }

    loadPosts(function (posts) {
      if (String(searchInput.value || "").trim() !== query) {
        return;
      }

      renderResults(searchPosts(posts, query, fromEnter), query);
    });
  }

  function loadPosts(callback) {
    if (postsCache) {
      callback(postsCache);
      return;
    }

    requestState.queue.push(callback);

    if (requestState.loading) {
      return;
    }

    requestState.loading = true;

    var xhr = new XMLHttpRequest();
    xhr.open("GET", (root + "content.json").replace(/\/{2,}/g, "/"), true);
    xhr.onload = function () {
      var data = [];

      if (this.status >= 200 && this.status < 300) {
        try {
          data = JSON.parse(this.responseText);
          data = data instanceof Array ? data : data.posts;
          postsCache = preparePosts(data || []);
        } catch (error) {
          console.error(error);
          postsCache = [];
        }
      } else {
        console.error(this.statusText);
        postsCache = [];
      }

      requestState.loading = false;
      flushQueue();
    };
    xhr.onerror = function () {
      console.error(this.statusText);
      postsCache = [];
      requestState.loading = false;
      flushQueue();
    };
    xhr.send();
  }

  function flushQueue() {
    var queue = requestState.queue.slice();
    requestState.queue.length = 0;

    queue.forEach(function (callback) {
      callback(postsCache);
    });
  }

  function preparePosts(items) {
    return items.map(function (item, index) {
      var tags = Array.isArray(item.tags)
        ? item.tags
            .map(function (tag) {
              return decodeHtml(tag && tag.name ? tag.name : "");
            })
            .filter(Boolean)
        : [];
      var title = decodeHtml(item && item.title ? item.title : "");
      var text = decodeHtml(stripHtml(item && item.text ? item.text : "")).replace(/\s+/g, " ").trim();

      return {
        index: index,
        title: title,
        titleNorm: normalizeText(title),
        path: item && item.path ? item.path : "",
        date: item && item.date ? item.date : "",
        tags: tags,
        tagsNorm: normalizeText(tags.join(" ")),
        text: text,
        textNorm: normalizeText(text)
      };
    });
  }

  function searchPosts(posts, rawQuery) {
    var query = normalizeText(rawQuery);
    var tokens = tokenizeQuery(query);

    return posts
      .map(function (entry) {
        return {
          entry: entry,
          score: scoreEntry(entry, query, tokens)
        };
      })
      .filter(function (item) {
        return item.score > 0;
      })
      .sort(function (left, right) {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        var rightDate = Date.parse(right.entry.date) || 0;
        var leftDate = Date.parse(left.entry.date) || 0;

        if (rightDate !== leftDate) {
          return rightDate - leftDate;
        }

        return left.entry.index - right.entry.index;
      })
      .slice(0, 10)
      .map(function (item) {
        return item.entry;
      });
  }

  function tokenizeQuery(query) {
    return query
      .split(/\s+/)
      .map(function (token) {
        return token.trim();
      })
      .filter(Boolean);
  }

  function scoreEntry(entry, fullQuery, tokens) {
    var matchedTokens = 0;
    var total = 0;

    tokens.forEach(function (token) {
      var titleScore = scoreField(entry.titleNorm, token, 7.2, 3.6);
      var tagScore = scoreField(entry.tagsNorm, token, 4.8, 2.5);
      var textScore = scoreField(entry.textNorm, token, 2.8, 1.2);
      var tokenScore = Math.max(titleScore, tagScore, textScore);

      if (tokenScore > 0) {
        matchedTokens += 1;
        total += titleScore + tagScore + textScore;
      }
    });

    if (!matchedTokens) {
      return 0;
    }

    if (tokens.length > 1 && matchedTokens < tokens.length) {
      return 0;
    }

    total += scoreField(entry.titleNorm, fullQuery, 3.8, 1.6);
    total += scoreField(entry.tagsNorm, fullQuery, 2.2, 1.1);
    total += scoreField(entry.textNorm, fullQuery, 1.1, 0.4);

    if (entry.titleNorm.indexOf(fullQuery) === 0) {
      total += 80;
    }

    if (entry.tagsNorm.indexOf(fullQuery) === 0) {
      total += 36;
    }

    return total;
  }

  function scoreField(source, token, exactWeight, fuzzyWeight) {
    if (!source || !token) {
      return 0;
    }

    return exactScore(source, token) * exactWeight + subsequenceScore(source, token) * fuzzyWeight;
  }

  function exactScore(source, token) {
    var index = source.indexOf(token);

    if (index === -1) {
      return 0;
    }

    return Math.max(44, 132 - Math.min(index, 88)) + token.length * 10;
  }

  function subsequenceScore(source, token) {
    if (token.length < 2) {
      return 0;
    }

    var lastIndex = -1;
    var gap = 0;

    for (var i = 0; i < token.length; i += 1) {
      var nextIndex = source.indexOf(token.charAt(i), lastIndex + 1);

      if (nextIndex === -1) {
        return 0;
      }

      if (lastIndex !== -1) {
        gap += nextIndex - lastIndex - 1;
      }

      lastIndex = nextIndex;
    }

    return Math.max(0, token.length * 15 - gap * 1.8);
  }

  function renderResults(results, query) {
    if (!results.length) {
      searchResult.innerHTML =
        '<li class="tips"><i class="icon icon-coffee icon-2x"></i><p>没有找到相关内容，换个关键词试试。</p></li>';
      openPanel();
      return;
    }

    searchResult.innerHTML = results
      .map(function (entry) {
        var metaParts = [];
        var safeTitle = escapeHtml(entry.title || "Untitled");
        var safePath = escapeAttr(buildPath(entry.path));
        var excerpt = buildExcerpt(entry, query);

        if (entry.date) {
          metaParts.push(formatDate(entry.date));
        }

        if (entry.tags.length) {
          metaParts.push(
            entry.tags
              .map(function (tag) {
                return "#" + escapeHtml(tag);
              })
              .join(" ")
          );
        }

        return (
          '<li class="item waves-block waves-effect" tabindex="0" role="link" data-path="' +
          safePath +
          '">' +
          '<div class="title" title="' +
          escapeAttr(entry.title || "Untitled") +
          '">' +
          safeTitle +
          "</div>" +
          (metaParts.length ? '<div class="search-meta">' + metaParts.join(" · ") + "</div>" : "") +
          (excerpt ? '<div class="search-excerpt">' + escapeHtml(excerpt) + "</div>" : "") +
          "</li>"
        );
      })
      .join("");

    if (win.Waves && typeof win.Waves.attach === "function") {
      win.Waves.attach(".search-result .item", ["waves-block"]);
    }

    openPanel();
  }

  function buildExcerpt(entry, query) {
    var text = entry.text || "";

    if (!text) {
      return "";
    }

    var lowerText = text.toLowerCase();
    var tokens = tokenizeQuery(query);
    var index = lowerText.indexOf(query);

    if (index === -1) {
      for (var i = 0; i < tokens.length; i += 1) {
        index = lowerText.indexOf(tokens[i]);

        if (index !== -1) {
          break;
        }
      }
    }

    if (index === -1) {
      index = 0;
    }

    var start = Math.max(0, index - 26);
    var end = Math.min(text.length, index + 82);
    var snippet = text.slice(start, end).trim();

    if (start > 0) {
      snippet = "..." + snippet;
    }

    if (end < text.length) {
      snippet += "...";
    }

    return snippet;
  }

  function formatDate(dateValue) {
    var date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("zh-CN");
  }

  function buildPath(path) {
    return (root + String(path || "")).replace(/\/{2,}/g, "/");
  }

  function navigateTo(path) {
    if (!path) {
      return;
    }

    win.location.href = path;
  }

  function findResultItem(target) {
    var node = target;

    while (node && node !== searchResult) {
      if (node.classList && node.classList.contains("item")) {
        return node;
      }

      node = node.parentNode;
    }

    return null;
  }

  function stripHtml(value) {
    return String(value || "").replace(/<[^>]*>/g, " ");
  }

  function decodeHtml(value) {
    entityDecoder.innerHTML = String(value || "");
    return entityDecoder.value;
  }

  function normalizeText(value) {
    return decodeHtml(value)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
