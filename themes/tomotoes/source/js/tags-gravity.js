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

    function rotatedBounds(width, height, angle) {
        var sin = Math.abs(Math.sin(angle));
        var cos = Math.abs(Math.cos(angle));
        return {
            width: width * cos + height * sin,
            height: width * sin + height * cos
        };
    }

    function getProfile() {
        var width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
        var touch = !!(
            window.matchMedia &&
            window.matchMedia('(hover: none), (pointer: coarse)').matches
        );

        if (width <= 767 || touch) {
            return {
                baseHeight: 700,
                spawnBand: 180,
                spawnZones: 2,
                spawnRows: 3,
                sideInset: 12,
                topSafe: 18,
                bottomInset: 24,
                minGap: 10,
                maxGap: 18,
                rowGapMin: 8,
                rowGapMax: 18,
                rowWidthMin: 0.44,
                rowWidthMax: 0.82,
                rowShiftFactor: 0.46,
                tilt: 0.12,
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
                baseHeight: 760,
                spawnBand: 208,
                spawnZones: 3,
                spawnRows: 4,
                sideInset: 18,
                topSafe: 22,
                bottomInset: 28,
                minGap: 12,
                maxGap: 20,
                rowGapMin: 10,
                rowGapMax: 20,
                rowWidthMin: 0.42,
                rowWidthMax: 0.8,
                rowShiftFactor: 0.42,
                tilt: 0.14,
                spawnTilt: 0.38,
                delayMin: 100,
                delayMax: 1320,
                durationMin: 1860,
                durationMax: 3040,
                resizeDebounce: 190
            };
        }

        return {
            baseHeight: 820,
            spawnBand: 220,
            spawnZones: 4,
            spawnRows: 4,
            sideInset: 20,
            topSafe: 24,
            bottomInset: 30,
            minGap: 14,
            maxGap: 22,
            rowGapMin: 12,
            rowGapMax: 24,
            rowWidthMin: 0.4,
            rowWidthMax: 0.76,
            rowShiftFactor: 0.38,
            tilt: 0.16,
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
            var rowTarget = usableWidth * rand(profile.rowWidthMin, profile.rowWidthMax);

            function pushRow() {
                if (!row.length) {
                    return;
                }
                rows.push({
                    items: row.slice(),
                    width: width,
                    height: height,
                    stackGap: Math.round(rand(profile.rowGapMin, profile.rowGapMax))
                });
                row = [];
                width = 0;
                height = 0;
                rowTarget = usableWidth * rand(profile.rowWidthMin, profile.rowWidthMax);
            }

            shuffled.forEach(function(item) {
                var angle = rand(-profile.tilt, profile.tilt);
                var footprint = rotatedBounds(item.width, item.height, angle);
                var footprintWidth = Math.ceil(footprint.width);
                var footprintHeight = Math.ceil(footprint.height);
                var gap = row.length ? Math.round(rand(profile.minGap, profile.maxGap)) : 0;
                var next = row.length ? width + gap + footprintWidth : footprintWidth;
                var limit = Math.max(footprintWidth, rowTarget);

                if (row.length && next > limit) {
                    pushRow();
                    gap = 0;
                    next = footprintWidth;
                }

                row.push({
                    item: item,
                    gapBefore: row.length > 1 ? gap : 0,
                    angle: angle,
                    footprintWidth: footprintWidth,
                    footprintHeight: footprintHeight
                });
                width = row.length === 1
                    ? footprintWidth
                    : width + gap + footprintWidth;
                height = Math.max(height, footprintHeight);
            });

            pushRow();
            rows.sort(function(a, b) {
                return b.width - a.width;
            });
            return rows;
        }

        function estimateHeight(rows, padding, profile) {
            var pile = 0;
            rows.forEach(function(row, index) {
                pile += row.height;
                if (index !== rows.length - 1) {
                    pile += row.stackGap;
                }
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
                var maxBottom = 0;

                rows.forEach(function(row) {
                    var minLeft = padding.left + profile.sideInset;
                    var maxLeft = padding.left + innerWidth - profile.sideInset - row.width;
                    var centerLeft = minLeft + Math.max(0, maxLeft - minLeft) / 2;
                    var rowShift = Math.max(0, maxLeft - minLeft) * profile.rowShiftFactor;
                    var rowLeft = clamp(
                        centerLeft + rand(-rowShift, rowShift),
                        minLeft,
                        Math.max(minLeft, maxLeft)
                    );
                    var rowTop = currentBottom - row.height;
                    var cursorX = rowLeft;

                    row.items.forEach(function(entry, entryIndex) {
                        if (entryIndex) {
                            cursorX += entry.gapBefore;
                        }

                        var footprintOffsetX = (entry.footprintWidth - entry.item.width) / 2;
                        var footprintOffsetY = (entry.footprintHeight - entry.item.height) / 2;
                        var x = clamp(
                            cursorX + footprintOffsetX,
                            padding.left + profile.sideInset,
                            padding.left + innerWidth - profile.sideInset - entry.item.width
                        );
                        var y = clamp(
                            padding.top + rowTop + (row.height - entry.footprintHeight) + footprintOffsetY,
                            padding.top + profile.topSafe,
                            padding.top + innerHeight - profile.bottomInset - entry.item.height
                        );

                        minTop = Math.min(minTop, y);
                        maxBottom = Math.max(maxBottom, y + entry.item.height);
                        placements.push({
                            link: entry.item.link,
                            width: entry.item.width,
                            height: entry.item.height,
                            x: x,
                            y: y,
                            angle: entry.angle,
                            zIndex: String(10 + Math.round(y))
                        });
                        cursorX += entry.footprintWidth;
                    });

                    currentBottom = rowTop - row.stackGap;
                });

                if (
                    (minTop >= padding.top + profile.topSafe &&
                        maxBottom <= padding.top + innerHeight - profile.bottomInset) ||
                    attempt === 3
                ) {
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
            var zoneOffset = Math.floor(rand(0, Math.max(1, profile.spawnZones || 1)));
            var zoneCount = Math.max(1, profile.spawnZones || 1);
            var spawnRows = Math.max(2, profile.spawnRows || 3);
            var spawnOrder = shuffle(layout.placements.map(function(_, index) {
                return index;
            }));
            var delayOrder = shuffle(layout.placements.map(function(_, index) {
                return index;
            }));

            layout.placements.forEach(function(entry, index) {
                var zoneWidth = Math.max(
                    entry.width + 12,
                    (layout.innerWidth - profile.sideInset * 2) / zoneCount
                );
                var slot = spawnOrder[index];
                var zoneIndex = (slot + zoneOffset) % zoneCount;
                var spawnRow = Math.floor(slot / zoneCount) % spawnRows;
                var zoneMin = layout.padding.left + profile.sideInset + zoneIndex * zoneWidth;
                var zoneMax = zoneMin + zoneWidth - entry.width;
                var globalMin = layout.padding.left + profile.sideInset;
                var globalMax = layout.padding.left + layout.innerWidth - profile.sideInset - entry.width;
                var rowBand = Math.max(entry.height + 8, profile.spawnBand / spawnRows);
                var spawnX = clamp(
                    rand(zoneMin, Math.max(zoneMin, zoneMax)),
                    globalMin,
                    globalMax
                );
                var spawnY = layout.padding.top +
                    spawnRow * rowBand +
                    rand(0, Math.max(6, rowBand - entry.height - 4));
                var spawnAngle = rand(-profile.spawnTilt, profile.spawnTilt);
                var duration = Math.round(rand(profile.durationMin, profile.durationMax));
                var delayRank = delayOrder[index];
                var delay = Math.round(
                    rand(profile.delayMin, Math.min(profile.delayMin + 120, profile.delayMax)) +
                    delayRank * rand(90, 150)
                );

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
