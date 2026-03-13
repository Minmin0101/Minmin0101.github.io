(function(window, document) {
    var raf = window.requestAnimationFrame || function(callback) {
        return window.setTimeout(callback, 16);
    };

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function num(value) {
        var parsed = parseFloat(value || '0');
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function shuffle(items) {
        var list = items.slice();
        for (var i = list.length - 1; i > 0; i -= 1) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = list[i];
            list[i] = list[j];
            list[j] = temp;
        }
        return list;
    }

    function prefersReducedMotion() {
        return !!(
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );
    }

    function getProfile() {
        var width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
        var touch = !!(
            window.matchMedia &&
            window.matchMedia('(hover: none), (pointer: coarse)').matches
        );

        if (width <= 767 || touch) {
            return {
                baseHeight: 660,
                spawnBand: 190,
                sideInset: 12,
                topSafe: 18,
                bottomInset: 24,
                minGap: -12,
                maxGap: 10,
                rowSlack: 14,
                rowStep: 0.56,
                minStep: 26,
                xJitter: 8,
                yJitter: 6,
                tilt: 0.18,
                spawnTilt: 0.32,
                delayMin: 120,
                delayMax: 1180,
                durationMin: 1800,
                durationMax: 2900,
                resizeDebounce: 180
            };
        }

        if (width <= 1180) {
            return {
                baseHeight: 700,
                spawnBand: 220,
                sideInset: 18,
                topSafe: 22,
                bottomInset: 28,
                minGap: -16,
                maxGap: 14,
                rowSlack: 20,
                rowStep: 0.58,
                minStep: 30,
                xJitter: 12,
                yJitter: 8,
                tilt: 0.22,
                spawnTilt: 0.38,
                delayMin: 100,
                delayMax: 1320,
                durationMin: 1860,
                durationMax: 3040,
                resizeDebounce: 190
            };
        }

        return {
            baseHeight: 760,
            spawnBand: 248,
            sideInset: 20,
            topSafe: 24,
            bottomInset: 30,
            minGap: -18,
            maxGap: 16,
            rowSlack: 24,
            rowStep: 0.62,
            minStep: 34,
            xJitter: 16,
            yJitter: 10,
            tilt: 0.26,
            spawnTilt: 0.42,
            delayMin: 90,
            delayMax: 1440,
            durationMin: 1920,
            durationMax: 3180,
            resizeDebounce: 200
        };
    }

    function initTagDrop() {
        var container = document.querySelector('.physics-container');
        if (!container || !document.querySelector('.tags-header')) {
            return;
        }

        var links = Array.prototype.slice.call(container.querySelectorAll('.tag-link'));
        if (!links.length) {
            return;
        }

        var previous = container.__tagDropState;
        if (previous && typeof previous.destroy === 'function') {
            previous.destroy();
        }

        var state = {
            resizeTimer: 0,
            unlockTimer: 0,
            revealFrame: 0
        };

        function clearTimers() {
            if (state.resizeTimer) {
                window.clearTimeout(state.resizeTimer);
                state.resizeTimer = 0;
            }
            if (state.unlockTimer) {
                window.clearTimeout(state.unlockTimer);
                state.unlockTimer = 0;
            }
            if (state.revealFrame) {
                window.cancelAnimationFrame(state.revealFrame);
                state.revealFrame = 0;
            }
        }

        function resetStyles() {
            container.classList.remove('physics-ready', 'physics-fallback');
            container.style.height = '';
            links.forEach(function(link) {
                link.classList.remove('is-visible');
                link.style.position = '';
                link.style.left = '';
                link.style.top = '';
                link.style.width = '';
                link.style.height = '';
                link.style.opacity = '';
                link.style.filter = '';
                link.style.transform = '';
                link.style.transition = '';
                link.style.pointerEvents = '';
                link.style.margin = '';
                link.style.zIndex = '';
                link.style.visibility = '';
                link.style.willChange = '';
            });
        }

        function measure() {
            return links.map(function(link) {
                link.style.position = 'static';
                link.style.visibility = 'hidden';
                link.style.opacity = '0';
                link.style.transform = 'none';
                link.style.filter = 'none';
                link.style.pointerEvents = 'none';
                link.style.transition = 'none';
                link.style.margin = '0';
                link.style.willChange = 'transform, opacity';
                var rect = link.getBoundingClientRect();
                return {
                    link: link,
                    width: Math.ceil(rect.width || link.offsetWidth || 140),
                    height: Math.ceil(rect.height || link.offsetHeight || 48)
                };
            });
        }

        function buildRows(items, usableWidth, profile) {
            var shuffled = shuffle(items);
            var rows = [];
            var row = [];
            var width = 0;
            var height = 0;

            function pushRow() {
                if (!row.length) {
                    return;
                }
                rows.push({ items: row.slice(), width: width, height: height });
                row = [];
                width = 0;
                height = 0;
            }

            shuffled.forEach(function(item) {
                var gap = row.length ? Math.round(rand(profile.minGap, profile.maxGap)) : 0;
                var next = row.length ? width + gap + item.width : item.width;
                var limit = Math.max(usableWidth * 0.68, usableWidth - rand(0, profile.rowSlack));

                if (row.length && next > limit) {
                    pushRow();
                    gap = 0;
                    next = item.width;
                }

                row.push({
                    item: item,
                    gapBefore: row.length > 1 ? gap : 0,
                    angle: rand(-profile.tilt, profile.tilt)
                });
                width = row.length === 1 ? item.width : width + gap + item.width;
                height = Math.max(height, item.height);
            });

            pushRow();
            return rows;
        }

        function estimateHeight(rows, padding, profile) {
            var pile = 0;
            rows.forEach(function(row, index) {
                pile += index === 0 ? row.height : Math.max(profile.minStep, row.height * profile.rowStep);
            });
            return Math.max(
                profile.baseHeight,
                Math.ceil(padding.top + padding.bottom + profile.spawnBand + pile + profile.bottomInset + profile.topSafe + 40)
            );
        }

        function buildLayout(items, padding, profile) {
            var innerWidth = Math.max(0, container.clientWidth - padding.left - padding.right);
            if (!innerWidth) {
                return null;
            }

            var rows = buildRows(items, Math.max(40, innerWidth - profile.sideInset * 2), profile);
            var containerHeight = estimateHeight(rows, padding, profile);
            var layout = null;

            for (var attempt = 0; attempt < 4; attempt += 1) {
                var innerHeight = containerHeight - padding.top - padding.bottom;
                var currentBottom = innerHeight - profile.bottomInset;
                var placements = [];
                var minTop = Infinity;

                rows.forEach(function(row) {
                    var rowLeft = padding.left + profile.sideInset + rand(0, Math.max(0, innerWidth - profile.sideInset * 2 - row.width));
                    var rowTop = currentBottom - row.height;
                    var cursorX = rowLeft;

                    row.items.forEach(function(entry, entryIndex) {
                        if (entryIndex) {
                            cursorX += entry.gapBefore;
                        }

                        var x = clamp(
                            cursorX + rand(-profile.xJitter, profile.xJitter),
                            padding.left + profile.sideInset,
                            padding.left + innerWidth - profile.sideInset - entry.item.width
                        );
                        var y = clamp(
                            padding.top + rowTop + (row.height - entry.item.height) + rand(-profile.yJitter, profile.yJitter),
                            padding.top + profile.topSafe,
                            padding.top + innerHeight - profile.bottomInset - entry.item.height
                        );

                        minTop = Math.min(minTop, y);
                        placements.push({
                            link: entry.item.link,
                            width: entry.item.width,
                            height: entry.item.height,
                            x: x,
                            y: y,
                            angle: entry.angle,
                            zIndex: String(10 + Math.round(y))
                        });
                        cursorX += entry.item.width;
                    });

                    currentBottom = rowTop + Math.max(profile.minStep, row.height * profile.rowStep);
                });

                if (minTop >= padding.top + profile.topSafe || attempt === 3) {
                    layout = {
                        padding: padding,
                        innerWidth: innerWidth,
                        containerHeight: containerHeight,
                        placements: placements
                    };
                    break;
                }

                containerHeight += Math.ceil(padding.top + profile.topSafe - minTop + 12);
            }

            return layout;
        }

        function render(layout, profile) {
            container.classList.add('physics-ready');
            if (prefersReducedMotion()) {
                container.classList.add('physics-fallback');
            }
            container.style.height = layout.containerHeight + 'px';

            var maxEnd = 0;

            layout.placements.forEach(function(entry, index) {
                var spawnX = clamp(
                    rand(layout.padding.left + profile.sideInset, layout.padding.left + layout.innerWidth - profile.sideInset - entry.width),
                    layout.padding.left + profile.sideInset,
                    layout.padding.left + layout.innerWidth - profile.sideInset - entry.width
                );
                var spawnY = layout.padding.top - entry.height - rand(20, profile.spawnBand);
                var spawnAngle = rand(-profile.spawnTilt, profile.spawnTilt);
                var duration = Math.round(rand(profile.durationMin, profile.durationMax));
                var delay = Math.round(rand(profile.delayMin, profile.delayMax) + index * rand(8, 24));

                maxEnd = Math.max(maxEnd, delay + duration);

                entry.link.style.position = 'absolute';
                entry.link.style.left = '0';
                entry.link.style.top = '0';
                entry.link.style.width = entry.width + 'px';
                entry.link.style.height = entry.height + 'px';
                entry.link.style.visibility = 'visible';
                entry.link.style.opacity = prefersReducedMotion() ? '1' : '0';
                entry.link.style.filter = prefersReducedMotion() ? 'none' : 'blur(8px)';
                entry.link.style.pointerEvents = 'none';
                entry.link.style.zIndex = entry.zIndex;
                entry.link.style.transform =
                    'translate3d(' + spawnX.toFixed(2) + 'px, ' + spawnY.toFixed(2) + 'px, 0) rotate(' + spawnAngle.toFixed(4) + 'rad)';

                if (prefersReducedMotion()) {
                    entry.link.classList.add('is-visible');
                    entry.link.style.pointerEvents = 'auto';
                    entry.link.style.transform =
                        'translate3d(' + entry.x.toFixed(2) + 'px, ' + entry.y.toFixed(2) + 'px, 0) rotate(' + entry.angle.toFixed(4) + 'rad)';
                    return;
                }

                entry.link.style.transition =
                    'transform ' + duration + 'ms cubic-bezier(.22,.96,.28,1) ' + delay + 'ms,' +
                    ' opacity 360ms ease ' + delay + 'ms,' +
                    ' filter 520ms ease ' + delay + 'ms';
            });

            if (prefersReducedMotion()) {
                return;
            }

            state.revealFrame = raf(function() {
                state.revealFrame = 0;
                layout.placements.forEach(function(entry) {
                    entry.link.classList.add('is-visible');
                    entry.link.style.opacity = '1';
                    entry.link.style.filter = 'none';
                    entry.link.style.transform =
                        'translate3d(' + entry.x.toFixed(2) + 'px, ' + entry.y.toFixed(2) + 'px, 0) rotate(' + entry.angle.toFixed(4) + 'rad)';
                });
            });

            state.unlockTimer = window.setTimeout(function() {
                layout.placements.forEach(function(entry) {
                    entry.link.style.pointerEvents = 'auto';
                });
            }, maxEnd + 80);
        }

        function layoutTags() {
            clearTimers();
            resetStyles();

            var profile = getProfile();
            var style = window.getComputedStyle(container);
            var padding = {
                top: num(style.paddingTop),
                right: num(style.paddingRight),
                bottom: num(style.paddingBottom),
                left: num(style.paddingLeft)
            };
            var layout = buildLayout(measure(), padding, profile);
            if (layout) {
                render(layout, profile);
            }
        }

        function scheduleLayout() {
            if (state.resizeTimer) {
                window.clearTimeout(state.resizeTimer);
            }
            state.resizeTimer = window.setTimeout(layoutTags, getProfile().resizeDebounce);
        }

        state.destroy = function() {
            clearTimers();
            window.removeEventListener('resize', state.onResize);
            window.removeEventListener('orientationchange', state.onOrientationChange);
            if (container.__tagDropState === state) {
                container.__tagDropState = null;
            }
            resetStyles();
        };

        state.onResize = scheduleLayout;
        state.onOrientationChange = scheduleLayout;
        container.__tagDropState = state;

        window.addEventListener('resize', state.onResize, { passive: true });
        window.addEventListener('orientationchange', state.onOrientationChange, { passive: true });

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleLayout).catch(layoutTags);
        }

        layoutTags();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTagDrop);
    } else {
        initTagDrop();
    }
}(window, document));
