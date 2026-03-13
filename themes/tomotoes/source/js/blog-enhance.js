(function(window, document) {
    var root = document.documentElement;

    function hashCode(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function formatLink(text, href) {
        return '<a href="' + href + '">' + text + '</a>';
    }

    function getScrollTop() {
        var rootElement = document.scrollingElement || document.documentElement || document.body;
        return window.pageYOffset || rootElement.scrollTop || document.body.scrollTop || document.documentElement.scrollTop || 0;
    }

    function getHeaderOffset() {
        var header = document.getElementById('header');
        return (header ? header.offsetHeight : 0) + 18;
    }

    function normalizeHash(hash) {
        if (!hash) {
            return '';
        }
        var raw = hash.charAt(0) === '#' ? hash.slice(1) : hash;
        try {
            return decodeURIComponent(raw);
        } catch (error) {
            return raw;
        }
    }

    function setSlidingBar(activeItem) {
        var nav = document.querySelector('#menu .nav');
        var bar = nav && nav.querySelector('.sliding-bar');
        if (!nav || !bar || !activeItem) {
            return;
        }
        bar.style.opacity = '1';
        bar.style.transform = 'translateY(' + activeItem.offsetTop + 'px)';
    }

    function initMenuBar() {
        var compactTouchViewport = !!(
            window.matchMedia &&
            window.matchMedia('(hover: none) and (pointer: coarse)').matches
        );
        var nav = document.querySelector('#menu .nav');
        var bar = nav && nav.querySelector('.sliding-bar');
        var activeItem = document.querySelector('#menu .nav .items.active');
        var items = document.querySelectorAll('#menu .nav .items');
        if (compactTouchViewport) {
            if (bar && activeItem) {
                setSlidingBar(activeItem);
            } else if (bar) {
                bar.style.opacity = '0';
                bar.style.transform = 'none';
            }
            return;
        }
        if (activeItem) {
            setSlidingBar(activeItem);
        }
        Array.prototype.forEach.call(items, function(item) {
            item.addEventListener('mouseenter', function() {
                setSlidingBar(item);
            });
        });
        if (nav) {
            nav.addEventListener('mouseleave', function() {
                var current = document.querySelector('#menu .nav .items.active');
                if (current) {
                    setSlidingBar(current);
                }
            });
        }
    }

    function createGridAnimation(canvas) {
        var ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var width = 0;
        var height = 0;
        var points = [];
        var pointer = { x: 0.62, y: 0.32 };
        var lastFrame = 0;

        function resize() {
            width = canvas.offsetWidth || canvas.parentNode.offsetWidth;
            height = canvas.offsetHeight || canvas.parentNode.offsetHeight;
            canvas.width = width * Math.min(window.devicePixelRatio || 1, 2);
            canvas.height = height * Math.min(window.devicePixelRatio || 1, 2);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(Math.min(window.devicePixelRatio || 1, 2), Math.min(window.devicePixelRatio || 1, 2));
            points = [];
            for (var i = 0; i < 20; i++) {
                points.push({
                    x: Math.random(),
                    y: Math.random(),
                    phase: Math.random() * Math.PI * 2
                });
            }
        }

        function render(time) {
            if (reduceMotion) {
                time = lastFrame || time || 0;
            } else if (document.hidden) {
                window.requestAnimationFrame(render);
                return;
            } else if (lastFrame && time - lastFrame < 33) {
                window.requestAnimationFrame(render);
                return;
            }
            lastFrame = time || 0;
            var t = time * 0.001;
            var gridSize = window.innerWidth < 760 ? 28 : 34;
            ctx.clearRect(0, 0, width, height);

            var gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, 'rgba(255,255,255,0.04)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            for (var x = 0; x <= width; x += gridSize) {
                ctx.strokeStyle = 'rgba(255,255,255,' + (0.06 + 0.02 * Math.sin((x / Math.max(width, 1)) * 4 + t)).toFixed(3) + ')';
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (var y = 0; y <= height; y += gridSize) {
                ctx.strokeStyle = 'rgba(255,255,255,' + (0.06 + 0.02 * Math.cos((y / Math.max(height, 1)) * 4 + t)).toFixed(3) + ')';
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            points.forEach(function(point, index) {
                var px = point.x * width + Math.sin(t + point.phase) * 18;
                var py = point.y * height + Math.cos(t * 1.2 + point.phase) * 18;
                var radius = 1.2 + Math.sin(t * 1.4 + index) * 0.8;
                ctx.beginPath();
                ctx.arc(px, py, Math.max(radius, 0.4), 0, Math.PI * 2);
                ctx.fill();
            });

            var glowX = pointer.x * width;
            var glowY = pointer.y * height;
            var glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, Math.max(width, height) * 0.28);
            glow.addColorStop(0, 'rgba(255,255,255,0.18)');
            glow.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, width, height);
            if (!reduceMotion) {
                window.requestAnimationFrame(render);
            }
        }

        canvas.parentNode.addEventListener('pointermove', function(event) {
            var rect = canvas.getBoundingClientRect();
            pointer.x = (event.clientX - rect.left) / rect.width;
            pointer.y = (event.clientY - rect.top) / rect.height;
        });

        canvas.parentNode.addEventListener('pointerleave', function() {
            pointer.x = 0.62;
            pointer.y = 0.32;
        });

        window.addEventListener('resize', resize);
        resize();
        if (reduceMotion) {
            render(0);
        } else {
            window.requestAnimationFrame(render);
        }
    }

    function initFlickeringGrid() {
        Array.prototype.forEach.call(document.querySelectorAll('.flickering-grid-canvas'), createGridAnimation);
    }

    function createCoverPainter(canvas) {
        var ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var tone = canvas.getAttribute('data-tone') || 'tone-a';
        var toneColors = {
            'tone-a': ['#0f172a', '#1d4f91', '#86b3ec'],
            'tone-b': ['#31142b', '#8f4d76', '#f0c1aa'],
            'tone-c': ['#143129', '#2f6a53', '#9bd9c2'],
            'tone-d': ['#221733', '#5f5692', '#d4c8f0']
        };
        var colors = toneColors[tone] || toneColors['tone-a'];
        var width = 0;
        var height = 0;
        var seed = hashCode(canvas.getAttribute('data-post-id') || 'post');
        var lastFrame = 0;

        function resize() {
            width = canvas.offsetWidth || canvas.parentNode.offsetWidth;
            height = canvas.offsetHeight || canvas.parentNode.offsetHeight;
            canvas.width = width * Math.min(window.devicePixelRatio || 1, 2);
            canvas.height = height * Math.min(window.devicePixelRatio || 1, 2);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(Math.min(window.devicePixelRatio || 1, 2), Math.min(window.devicePixelRatio || 1, 2));
        }

        function draw(time) {
            if (reduceMotion) {
                time = lastFrame || time || 0;
            } else if (document.hidden) {
                window.requestAnimationFrame(draw);
                return;
            } else if (lastFrame && time - lastFrame < 41) {
                window.requestAnimationFrame(draw);
                return;
            }
            lastFrame = time || 0;
            var t = time * 0.0009;
            var gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, colors[0]);
            gradient.addColorStop(0.52, colors[1]);
            gradient.addColorStop(1, colors[2]);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            for (var i = 0; i < 3; i++) {
                var x = width * (0.2 + i * 0.26) + Math.sin(t + i + seed * 0.002) * 20;
                var y = height * (0.35 + (i % 2) * 0.22) + Math.cos(t * 1.3 + i * 0.8) * 24;
                var radius = width * (0.16 + i * 0.03);
                var glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
                glow.addColorStop(0, 'rgba(255,255,255,0.18)');
                glow.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = glow;
                ctx.fillRect(0, 0, width, height);
            }

            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            for (var j = 0; j < 5; j++) {
                ctx.beginPath();
                for (var xIndex = 0; xIndex <= width; xIndex += 18) {
                    var waveY = height * (0.2 + j * 0.14) + Math.sin((xIndex * 0.012) + (t * 4) + j + seed * 0.01) * 10;
                    if (xIndex === 0) {
                        ctx.moveTo(xIndex, waveY);
                    } else {
                        ctx.lineTo(xIndex, waveY);
                    }
                }
                ctx.stroke();
            }
            ctx.restore();
            if (!reduceMotion) {
                window.requestAnimationFrame(draw);
            }
        }

        window.addEventListener('resize', resize);
        resize();
        if (reduceMotion) {
            draw(0);
        } else {
            window.requestAnimationFrame(draw);
        }
    }

    function initCoverCanvases() {
        Array.prototype.forEach.call(document.querySelectorAll('.canvas-cover'), createCoverPainter);
    }

    function loadRealImage(img) {
        if (!img || img.dataset.loaded === '1' || !img.dataset.original) {
            return;
        }
        img.dataset.loaded = '1';
        img.classList.add('is-placeholder');
        var real = new Image();
        real.onload = function() {
            img.src = img.dataset.original;
            img.classList.remove('is-placeholder');
        };
        real.src = img.dataset.original;
    }

    function initLazyBubbleImages() {
        var images = document.querySelectorAll('.image-bubble img[data-original]');
        if (!images.length) {
            return;
        }
        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        loadRealImage(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '180px 0px'
            });
            Array.prototype.forEach.call(images, function(img) {
                observer.observe(img);
            });
        } else {
            Array.prototype.forEach.call(images, loadRealImage);
        }
        Array.prototype.forEach.call(images, function(img) {
            img.addEventListener('click', function() {
                loadRealImage(img);
            });
        });
    }

    function initKaTeX() {
        if (!window.renderMathInElement) {
            return;
        }
        Array.prototype.forEach.call(document.querySelectorAll('pre, code'), function(node) {
            node.classList.add('ignore-opencc');
        });
        window.renderMathInElement(document.body, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\[', right: '\\]', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false }
            ],
            throwOnError: false,
            strict: 'ignore',
            trust: true,
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
            ignoredClasses: ['ignore-opencc']
        });
        Array.prototype.forEach.call(document.querySelectorAll('.katex, .katex-display'), function(node) {
            node.classList.add('ignore-opencc');
        });
    }

    function initPostTitleTyping() {
        var title = document.querySelector('.post-card-title[data-title]');
        if (!title || window.innerWidth < 760) {
            return;
        }
        var text = title.getAttribute('data-title') || '';
        title.textContent = '';
        var index = 0;
        var timer = window.setInterval(function() {
            index += 1;
            title.textContent = text.slice(0, index);
            if (index >= text.length) {
                window.clearInterval(timer);
            }
        }, 38);
    }

    function initQuickRail() {
        var rail = document.querySelector('.blog-home-rail');
        if (!rail) {
            return;
        }
        var links = rail.querySelectorAll('a[href^="#"]');

        function activate() {
            var postStart = document.getElementById('post-list-start');
            var scrollTop = getScrollTop();
            Array.prototype.forEach.call(links, function(link) {
                link.classList.remove('active');
            });
            if (postStart && scrollTop + 120 >= postStart.offsetTop) {
                rail.querySelector('a[href="#post-list-start"]').classList.add('active');
            } else if (rail.querySelector('a[href="#blog-top"]')) {
                rail.querySelector('a[href="#blog-top"]').classList.add('active');
            }
        }

        Array.prototype.forEach.call(links, function(link) {
            link.addEventListener('click', function(event) {
                var target = document.querySelector(link.getAttribute('href'));
                if (!target) {
                    return;
                }
                event.preventDefault();
                window.scrollTo({
                    top: Math.max(target.offsetTop - 80, 0),
                    behavior: 'smooth'
                });
            });
        });

        window.addEventListener('scroll', activate, { passive: true });
        activate();
    }

    function initScrollReveal() {
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var groups = [
            {
                selector: '.rich-post-list .post-list-item',
                revealClass: 'scroll-push-item',
                step: 72,
                limit: 360
            },
            {
                selector: '.weibo-stream .weibo-entry',
                revealClass: 'scroll-push-card',
                step: 84,
                limit: 336
            },
            {
                selector: '.physics-container',
                revealClass: 'scroll-push-block',
                step: 0,
                limit: 0
            }
        ];
        var targets = [];

        function reveal(element) {
            element.classList.remove('reveal-ready');
            element.classList.add('reveal-in');
        }

        groups.forEach(function(group) {
            Array.prototype.forEach.call(document.querySelectorAll(group.selector), function(element, index) {
                if (element.getAttribute('data-reveal-init') === '1') {
                    return;
                }
                element.setAttribute('data-reveal-init', '1');
                element.classList.add(group.revealClass);
                if (!reduceMotion) {
                    element.classList.add('reveal-ready');
                    element.style.setProperty('--reveal-delay', Math.min(index * group.step, group.limit) + 'ms');
                }
                targets.push(element);
            });
        });

        if (!targets.length) {
            return;
        }

        if (reduceMotion || !('IntersectionObserver' in window)) {
            targets.forEach(reveal);
            return;
        }

        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (!entry.isIntersecting) {
                    return;
                }
                reveal(entry.target);
                observer.unobserve(entry.target);
            });
        }, {
            rootMargin: '0px 0px -10% 0px',
            threshold: 0.14
        });

        targets.forEach(function(target) {
            observer.observe(target);
        });
    }

    function initThemeTools() {
        var colorInput = document.getElementById('theme-color-input');
        var swatches = document.querySelectorAll('.color-swatch');
        if (colorInput) {
            colorInput.value = window.themeColor || colorInput.value;
            colorInput.addEventListener('input', function() {
                window.changeColor(colorInput.value);
            });
        }
        Array.prototype.forEach.call(swatches, function(button) {
            button.addEventListener('click', function() {
                var color = button.getAttribute('data-color');
                if (!color) {
                    return;
                }
                window.changeColor(color);
                if (colorInput) {
                    colorInput.value = color;
                }
            });
        });
    }

    function initModals() {
        if (!window.BLOG || !window.BLOG.modal) {
            return;
        }
        var colorModal = new window.BLOG.modal('#color-picker');
        var wechatModal = new window.BLOG.modal('#wechat');
        var colorBtn = document.getElementById('color-picker-icon');
        var wechatBtn = document.getElementById('link-wechat');
        if (colorBtn) {
            colorBtn.addEventListener('click', function(event) {
                colorModal.toggle();
                event.preventDefault();
            });
        }
        if (wechatBtn) {
            wechatBtn.addEventListener('click', function(event) {
                wechatModal.toggle();
                event.preventDefault();
            });
        }
    }

    function getLatestPostHref() {
        var latestLink = document.querySelector('.author-post-card .post-more');
        return latestLink ? latestLink.getAttribute('href') : '/blog/';
    }

    function createAssistantReply(message) {
        var latestHref = getLatestPostHref();
        var lower = message.toLowerCase();
        if (/最新|文章|blog|博客/.test(lower)) {
            return '最新文章在这里：' + formatLink('去看看', latestHref);
        }
        if (/标签|tag/.test(lower)) {
            return '标签页已经准备好了：' + formatLink('打开标签页', '/tags/');
        }
        if (/归档|archive/.test(lower)) {
            return '想按时间找内容的话，走这里：' + formatLink('打开归档', '/archives/');
        }
        if (/相册|照片|gallery/.test(lower)) {
            return '相册入口在这里：' + formatLink('打开相册', '/gallery/');
        }
        if (/公式|数学|化学|markdown|演示|示例/.test(lower)) {
            return '可以直接去看长文测试：' + formatLink('打开测试文章', '/2026/03/12/post-interaction-long-test/');
        }
        return '我可以带你去看最新文章、标签页、归档、相册，或者 Markdown 长文测试。';
    }

    function appendAssistantMessage(container, type, content) {
        if (!container) {
            return;
        }
        var item = document.createElement('div');
        item.className = 'assistant-message assistant-message-' + type;
        item.innerHTML = content;
        container.appendChild(item);
        container.scrollTop = container.scrollHeight;
    }

    function initAssistant() {
        var assistant = document.getElementById('ai-assistant');
        var toggle = document.getElementById('assistant-toggle');
        var panel = document.getElementById('assistant-panel');
        var form = document.getElementById('assistant-form');
        var input = document.getElementById('assistant-input');
        var messages = document.getElementById('assistant-messages');
        var actionButtons = document.querySelectorAll('.assistant-quick-actions button');
        var actions = {
            latest: function() {
                window.location.href = getLatestPostHref();
            },
            tags: function() {
                window.location.href = '/tags/';
            },
            gallery: function() {
                window.location.href = '/gallery/';
            },
            demo: function() {
                window.location.href = '/2026/03/12/post-interaction-long-test/';
            }
        };

        if (!toggle || !panel) {
            return;
        }

        function setOpen(open) {
            panel.classList.toggle('open', open);
            panel.setAttribute('aria-hidden', open ? 'false' : 'true');
            if (assistant) {
                assistant.classList.toggle('assistant-open', open);
            }
        }

        toggle.addEventListener('click', function() {
            setOpen(!panel.classList.contains('open'));
        });

        document.addEventListener('click', function(event) {
            if (!panel.contains(event.target) && !toggle.contains(event.target)) {
                setOpen(false);
            }
        });

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        });

        Array.prototype.forEach.call(actionButtons, function(button) {
            button.addEventListener('click', function() {
                var action = button.getAttribute('data-action');
                if (actions[action]) {
                    actions[action]();
                }
            });
        });

        if (form && input && messages) {
            form.addEventListener('submit', function(event) {
                event.preventDefault();
                var value = input.value.trim();
                if (!value) {
                    return;
                }
                appendAssistantMessage(messages, 'user', value);
                appendAssistantMessage(messages, 'bot', createAssistantReply(value));
                input.value = '';
            });
        }
    }

    function initPostNavigator() {
        if (!document.body.classList.contains('post-detail-page')) {
            return;
        }
        var toc = document.getElementById('post-toc');
        var gotop = document.getElementById('gotop');
        var scrollRoot = document.scrollingElement || document.documentElement || document.body;
        var scrollTarget = document.body && document.body.scrollHeight > document.body.clientHeight ? document.body : scrollRoot;
        var headings = document.querySelectorAll('#post-content h1, #post-content h2, #post-content h3, #post-content h4, #post-content h5, #post-content h6');
        var links = toc ? toc.querySelectorAll('a[href^="#"]') : [];
        var activeLinkRef = null;
        var syncScheduled = false;
        if (!toc || !headings.length || !links.length) {
            return;
        }

        function scrollToPosition(top) {
            var nextTop = Math.max(top, 0);
            scrollRoot.scrollTop = nextTop;
            document.body.scrollTop = nextTop;
            document.documentElement.scrollTop = nextTop;
            if (typeof window.scrollTo === 'function' && window.pageYOffset !== nextTop) {
                window.scrollTo(0, nextTop);
            }
            if (gotop) {
                gotop.classList.toggle('in', nextTop > 320);
            }
        }

        function getHeadingById(id) {
            for (var i = 0; i < headings.length; i++) {
                if (headings[i].id === id) {
                    return headings[i];
                }
            }
            return null;
        }

        function getLinkById(id) {
            for (var i = 0; i < links.length; i++) {
                if (normalizeHash(links[i].getAttribute('href')) === id) {
                    return links[i];
                }
            }
            return null;
        }

        function setActive(link, shouldReveal) {
            if (activeLinkRef === link) {
                return;
            }
            if (activeLinkRef && activeLinkRef.parentNode) {
                activeLinkRef.parentNode.classList.remove('active');
            } else {
                Array.prototype.forEach.call(toc.querySelectorAll('.post-toc-item.active'), function(item) {
                    item.classList.remove('active');
                });
            }
            activeLinkRef = link || null;
            if (link && link.parentNode) {
                link.parentNode.classList.add('active');
                if (shouldReveal && typeof link.scrollIntoView === 'function') {
                    link.scrollIntoView({
                        block: 'nearest',
                        inline: 'nearest'
                    });
                }
            }
        }

        function syncNavigator() {
            syncScheduled = false;
            var scrollTop = getScrollTop();
            var activeLink = links[0];
            Array.prototype.forEach.call(headings, function(heading) {
                var top = heading.getBoundingClientRect().top + scrollTop;
                if (scrollTop + getHeaderOffset() >= top) {
                    var matched = getLinkById(heading.id);
                    if (matched) {
                        activeLink = matched;
                    }
                }
            });
            setActive(activeLink, false);
            if (gotop) {
                gotop.classList.toggle('in', scrollTop > 320);
            }
        }

        function requestSync() {
            if (syncScheduled) {
                return;
            }
            syncScheduled = true;
            window.requestAnimationFrame(syncNavigator);
        }

        Array.prototype.forEach.call(links, function(link) {
            link.addEventListener('click', function(event) {
                var target = getHeadingById(normalizeHash(link.getAttribute('href')));
                if (!target) {
                    return;
                }
                event.preventDefault();
                scrollToPosition(Math.max(target.getBoundingClientRect().top + getScrollTop() - getHeaderOffset(), 0));
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', '#' + encodeURIComponent(target.id));
                }
                setActive(link, true);
            });
        });

        if (gotop) {
            gotop.addEventListener('click', function(event) {
                event.preventDefault();
                scrollToPosition(0);
            });
        }

        window.addEventListener('scroll', requestSync, { passive: true });
        if (scrollTarget && scrollTarget !== window && scrollTarget !== document) {
            scrollTarget.addEventListener('scroll', requestSync, { passive: true });
        }
        window.addEventListener('resize', requestSync);
        window.setTimeout(requestSync, 120);
        requestSync();
    }

    function initNightMode() {
        var lightButton = document.querySelector('.nav-tool-item.light');
        var mask = document.getElementById('mask');

        function syncNightModeState(enabled) {
            if (mask) {
                mask.classList.toggle('night', enabled);
            }
            if (lightButton) {
                lightButton.classList.toggle('active', enabled);
            }
        }

        syncNightModeState(!!window.blogNightEnabled);
        window.switchNightMode = function() {
            var enabled = !(mask && mask.classList.contains('night'));
            syncNightModeState(enabled);
            sessionStorage.setItem('night', enabled ? '1' : '0');
            window.blogNightEnabled = enabled;
        };
    }

    function initTranslate() {
        var customQuotes = [
            ['“', '「'],
            ['”', '」'],
            ['‘', '『'],
            ['’', '』']
        ];
        var handler;
        window.translatePage = function() {
            if (!window.OpenCC) {
                return;
            }
            if (!handler) {
                var converter = window.OpenCC.ConverterFactory
                    ? window.OpenCC.ConverterFactory(window.OpenCC.Locale.from.cn, window.OpenCC.Locale.to.tw, [customQuotes])
                    : window.OpenCC.Converter({ from: 'cn', to: 'tw' });
                handler = window.OpenCC.HTMLConverter(converter, document.documentElement, 'zh-CN', 'zh-TW');
            }
            if (document.documentElement.getAttribute('lang') === 'zh-TW') {
                handler.restore();
                document.documentElement.setAttribute('lang', 'zh-CN');
                localStorage.setItem('blog-language-mode', 'cn');
            } else {
                handler.convert();
                document.documentElement.setAttribute('lang', 'zh-TW');
                localStorage.setItem('blog-language-mode', 'tw');
            }
        };
        if (localStorage.getItem('blog-language-mode') === 'tw') {
            window.setTimeout(function() {
                window.translatePage();
            }, 60);
        }
    }

    function init() {
        initNightMode();
        initTranslate();
        initMenuBar();
        initThemeTools();
        initModals();
        initQuickRail();
        initAssistant();
        initFlickeringGrid();
        initCoverCanvases();
        initLazyBubbleImages();
        initPostTitleTyping();
        initScrollReveal();
        initKaTeX();
        initPostNavigator();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}(window, document));
