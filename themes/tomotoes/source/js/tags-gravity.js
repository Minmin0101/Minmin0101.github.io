(function(window, document) {
    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function readNumber(value) {
        var parsed = parseFloat(value || '0');
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function shuffle(list) {
        var copy = list.slice();
        for (var index = copy.length - 1; index > 0; index--) {
            var swapIndex = Math.floor(Math.random() * (index + 1));
            var current = copy[index];
            copy[index] = copy[swapIndex];
            copy[swapIndex] = current;
        }
        return copy;
    }

    function getProfile() {
        var viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
        var coarsePointer = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;

        if (viewportWidth <= 767 || coarsePointer) {
            return {
                baseHeight: 296,
                gapX: 10,
                gapY: 12,
                spawnBand: 82,
                scatterX: 38,
                rowDelay: 95,
                itemDelay: 55,
                minDuration: 960,
                maxDuration: 1380,
                maxTilt: 10,
                safePadding: 8,
                resizeDebounce: 180
            };
        }

        if (viewportWidth <= 1180) {
            return {
                baseHeight: 284,
                gapX: 14,
                gapY: 14,
                spawnBand: 92,
                scatterX: 46,
                rowDelay: 105,
                itemDelay: 64,
                minDuration: 1000,
                maxDuration: 1440,
                maxTilt: 11,
                safePadding: 10,
                resizeDebounce: 180
            };
        }

        return {
            baseHeight: 272,
            gapX: 18,
            gapY: 16,
            spawnBand: 108,
            scatterX: 58,
            rowDelay: 115,
            itemDelay: 72,
            minDuration: 1080,
            maxDuration: 1520,
            maxTilt: 12,
            safePadding: 12,
            resizeDebounce: 200
        };
    }

    function buildRows(items, boundsWidth, gapX) {
        var rows = [];
        var currentRow = [];
        var currentWidth = 0;
        var rowHeight = 0;

        items.forEach(function(item) {
            var nextWidth = currentRow.length
                ? currentWidth + gapX + item.width
                : item.width;

            if (currentRow.length && nextWidth > boundsWidth) {
                rows.push({
                    items: currentRow,
                    width: currentWidth,
                    height: rowHeight
                });
                currentRow = [];
                currentWidth = 0;
                rowHeight = 0;
            }

            currentRow.push(item);
            currentWidth = currentRow.length === 1 ? item.width : currentWidth + gapX + item.width;
            rowHeight = Math.max(rowHeight, item.height);
        });

        if (currentRow.length) {
            rows.push({
                items: currentRow,
                width: currentWidth,
                height: rowHeight
            });
        }

        return rows;
    }

    function applyRowOffsets(rows, boundsWidth, gapX) {
        rows.forEach(function(row) {
            var remaining = Math.max(0, boundsWidth - row.width);
            var segments = [];
            var segmentCount = row.items.length + 1;
            var totalWeight = 0;

            for (var segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
                var weight = Math.random();
                segments.push(weight);
                totalWeight += weight;
            }

            var normalized = segments.map(function(weight) {
                return totalWeight > 0 ? (weight / totalWeight) * remaining : 0;
            });

            var cursor = normalized[0] || 0;

            row.items.forEach(function(item, itemIndex) {
                item.left = cursor;
                cursor += item.width;

                if (itemIndex !== row.items.length - 1) {
                    cursor += gapX + (normalized[itemIndex + 1] || 0);
                }
            });
        });
    }

    function placeRows(rows, padding, profile) {
        var totalRowsHeight = rows.reduce(function(sum, row) {
            return sum + row.height;
        }, 0);
        var totalGapHeight = Math.max(0, rows.length - 1) * profile.gapY;
        var requiredHeight = Math.ceil(
            padding.top +
            padding.bottom +
            totalRowsHeight +
            totalGapHeight +
            22
        );
        var containerHeight = Math.max(profile.baseHeight, requiredHeight);
        var cursorY = containerHeight - padding.bottom;

        rows.forEach(function(row) {
            cursorY -= row.height;
            row.top = cursorY;

            row.items.forEach(function(item) {
                item.top = row.top + Math.max(0, row.height - item.height);
            });

            cursorY -= profile.gapY;
        });

        return containerHeight;
    }

    function initTagDrop() {
        var container = document.querySelector('.physics-container');
        if (!container || !document.querySelector('.tags-header')) {
            return;
        }

        var tagLinks = Array.prototype.slice.call(container.querySelectorAll('.tag-link'));
        if (!tagLinks.length) {
            return;
        }

        var previousState = container.__tagDropState;
        if (previousState && typeof previousState.destroy === 'function') {
            previousState.destroy();
        }

        var state = {
            revealTimers: [],
            resizeTimer: 0
        };

        function resetStyles() {
            while (state.revealTimers.length) {
                window.clearTimeout(state.revealTimers.pop());
            }

            if (state.resizeTimer) {
                window.clearTimeout(state.resizeTimer);
                state.resizeTimer = 0;
            }

            container.classList.remove('physics-initialized');
            container.style.height = '';

            tagLinks.forEach(function(link) {
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
                link.style.transitionDelay = '';
                link.style.pointerEvents = '';
                link.style.margin = '';
                link.style.willChange = '';
            });
        }

        function measureTags() {
            return tagLinks.map(function(link) {
                link.style.position = 'absolute';
                link.style.left = '0px';
                link.style.top = '0px';
                link.style.margin = '0';
                link.style.opacity = '0';
                link.style.filter = 'none';
                link.style.transform = 'translate3d(0, 0, 0)';
                link.style.pointerEvents = 'none';
                link.style.willChange = 'transform, opacity';

                var rect = link.getBoundingClientRect();
                return {
                    link: link,
                    width: Math.ceil(rect.width || link.offsetWidth || 140),
                    height: Math.ceil(rect.height || link.offsetHeight || 46)
                };
            });
        }

        function layoutTags() {
            resetStyles();

            var profile = getProfile();
            var containerStyle = window.getComputedStyle(container);
            var padding = {
                top: readNumber(containerStyle.paddingTop),
                right: readNumber(containerStyle.paddingRight),
                bottom: readNumber(containerStyle.paddingBottom),
                left: readNumber(containerStyle.paddingLeft)
            };
            var boundsWidth = Math.max(0, container.clientWidth - padding.left - padding.right);

            if (!boundsWidth) {
                return;
            }

            var measured = shuffle(measureTags());
            var rows = buildRows(measured, boundsWidth, profile.gapX);

            if (!rows.length) {
                return;
            }

            applyRowOffsets(rows, boundsWidth, profile.gapX);
            var containerHeight = placeRows(rows, padding, profile);

            container.style.height = containerHeight + 'px';
            container.classList.add('physics-initialized');

            rows.forEach(function(row, rowIndex) {
                row.items.forEach(function(item, itemIndex) {
                    var finalTilt = randomBetween(-profile.maxTilt * 0.32, profile.maxTilt * 0.32);
                    var startTilt = randomBetween(-profile.maxTilt, profile.maxTilt);
                    var startX = Math.max(
                        0,
                        Math.min(
                            boundsWidth - item.width,
                            item.left + randomBetween(-profile.scatterX, profile.scatterX)
                        )
                    );
                    var startY = Math.max(
                        0,
                        randomBetween(0, Math.max(12, profile.spawnBand - item.height * 0.15))
                    );
                    var offsetX = Math.round(startX - item.left);
                    var offsetY = Math.round(startY - item.top);
                    var delay = Math.round(
                        randomBetween(50, 180) +
                        rowIndex * profile.rowDelay +
                        itemIndex * profile.itemDelay
                    );
                    var duration = Math.round(randomBetween(profile.minDuration, profile.maxDuration));

                    item.link.style.position = 'absolute';
                    item.link.style.left = Math.round(padding.left + item.left) + 'px';
                    item.link.style.top = Math.round(item.top) + 'px';
                    item.link.style.width = item.width + 'px';
                    item.link.style.height = item.height + 'px';
                    item.link.style.opacity = '0';
                    item.link.style.filter = 'blur(6px)';
                    item.link.style.pointerEvents = 'none';
                    item.link.style.transition =
                        'transform ' +
                        duration +
                        'ms cubic-bezier(.18,.88,.24,1), opacity 420ms ease, filter 620ms ease';
                    item.link.style.transitionDelay = delay + 'ms';
                    item.link.style.transform =
                        'translate3d(' +
                        offsetX +
                        'px, ' +
                        offsetY +
                        'px, 0) scale(0.92) rotate(' +
                        startTilt.toFixed(2) +
                        'deg)';

                    state.revealTimers.push(window.setTimeout(function(link, tilt) {
                        return function() {
                            link.classList.add('is-visible');
                            link.style.opacity = '1';
                            link.style.filter = 'none';
                            link.style.pointerEvents = 'auto';
                            link.style.transform =
                                'translate3d(0, 0, 0) scale(1) rotate(' +
                                tilt.toFixed(2) +
                                'deg)';
                        };
                    }(item.link, finalTilt), 34));
                });
            });
        }

        function scheduleLayout() {
            if (state.resizeTimer) {
                window.clearTimeout(state.resizeTimer);
            }

            state.resizeTimer = window.setTimeout(function() {
                layoutTags();
            }, getProfile().resizeDebounce);
        }

        state.onResize = scheduleLayout;
        state.onOrientationChange = scheduleLayout;
        state.destroy = function() {
            resetStyles();
            window.removeEventListener('resize', state.onResize);
            window.removeEventListener('orientationchange', state.onOrientationChange);
            if (container.__tagDropState === state) {
                container.__tagDropState = null;
            }
        };

        container.__tagDropState = state;

        window.addEventListener('resize', state.onResize, { passive: true });
        window.addEventListener('orientationchange', state.onOrientationChange, { passive: true });

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleLayout).catch(function() {});
        }

        layoutTags();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTagDrop);
    } else {
        initTagDrop();
    }
}(window, document));
