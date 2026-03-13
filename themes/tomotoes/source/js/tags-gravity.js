(function(window, document) {
    function initTagDrop() {
        var container = document.querySelector('.physics-container');
        if (!container || !document.querySelector('.tags-header')) {
            return;
        }

        var tagLinks = Array.prototype.slice.call(container.querySelectorAll('.tag-link'));
        if (!tagLinks.length) {
            return;
        }

        var state = container.__tagDropState || {};

        function readNumber(value) {
            var number = parseFloat(value || '0');
            return Number.isFinite(number) ? number : 0;
        }

        function randomBetween(min, max) {
            return min + Math.random() * (max - min);
        }

        function shuffle(list) {
            var result = list.slice();
            for (var index = result.length - 1; index > 0; index--) {
                var swapIndex = Math.floor(Math.random() * (index + 1));
                var current = result[index];
                result[index] = result[swapIndex];
                result[swapIndex] = current;
            }
            return result;
        }

        function getLayoutProfile() {
            var viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
            var coarsePointer = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;

            if (viewportWidth <= 767 || coarsePointer) {
                return {
                    baseHeight: 232,
                    gapX: 10,
                    gapY: 12,
                    startBand: 26,
                    maxTilt: 4,
                    flowLayout: false
                };
            }

            if (viewportWidth <= 1024) {
                return {
                    baseHeight: 248,
                    gapX: 14,
                    gapY: 14,
                    startBand: 34,
                    maxTilt: 5,
                    flowLayout: false
                };
            }

            return {
                baseHeight: 264,
                gapX: 18,
                gapY: 16,
                startBand: 42,
                maxTilt: 6,
                flowLayout: false
            };
        }

        function resetTags() {
            if (state.resizeTimer) {
                window.clearTimeout(state.resizeTimer);
            }

            tagLinks.forEach(function(link) {
                link.classList.remove('reveal-in');
                link.style.order = '';
                link.style.left = '';
                link.style.top = '';
                link.style.width = '';
                link.style.height = '';
                link.style.transitionDelay = '';
                link.style.opacity = '';
                link.style.filter = '';
                link.style.transform = '';
                link.style.setProperty('--tag-order', '');
                link.style.setProperty('--tag-drop-delay', '');
                link.style.setProperty('--tag-drop-start-y', '');
                link.style.setProperty('--tag-drop-tilt', '');
                link.style.setProperty('--tag-final-tilt', '');
                delete link.dataset.finalTransform;
            });

            container.classList.remove('physics-ready', 'physics-animating', 'physics-mobile');
            container.style.height = '';
            container.__tagDropState = null;
        }

        function measureTags() {
            tagLinks.forEach(function(link) {
                link.style.width = '';
                link.style.height = '';
                link.style.left = '0px';
                link.style.top = '0px';
            });

            return tagLinks.map(function(link) {
                var rect = link.getBoundingClientRect();
                return {
                    element: link,
                    width: Math.ceil(rect.width),
                    height: Math.ceil(rect.height)
                };
            });
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

        function revealFlowTags(reduceMotion) {
            var order = shuffle(tagLinks.map(function(_, index) {
                return index;
            }));

            container.classList.add('physics-ready', 'physics-mobile');
            container.style.height = '';

            tagLinks.forEach(function(link, index) {
                var finalTilt = randomBetween(-2.2, 2.2);
                var startTilt = randomBetween(-5, 5);
                var delay = Math.round(randomBetween(30, 120) + (order[index] * randomBetween(22, 42)));
                var startOffset = Math.round(-1 * randomBetween(18, 38));

                link.style.order = String(order[index]);
                link.style.setProperty('--tag-order', String(order[index]));
                link.style.transitionDelay = delay + 'ms';
                link.style.opacity = '0';
                link.style.filter = 'blur(1.5px)';
                link.style.transform = 'translate3d(0, ' + startOffset + 'px, 0) scale(0.96) rotate(' + startTilt.toFixed(2) + 'deg)';
                link.style.setProperty('--tag-drop-delay', delay + 'ms');
                link.style.setProperty('--tag-drop-tilt', startTilt.toFixed(2) + 'deg');
                link.style.setProperty('--tag-final-tilt', finalTilt.toFixed(2) + 'deg');
                link.dataset.finalTransform = 'translate3d(0, 0, 0) scale(1) rotate(' + finalTilt.toFixed(2) + 'deg)';
            });

            if (reduceMotion) {
                tagLinks.forEach(function(link) {
                    link.style.opacity = '1';
                    link.style.filter = 'none';
                    link.style.transform = link.dataset.finalTransform || 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
                    link.classList.add('reveal-in');
                });
                return;
            }

            window.setTimeout(function() {
                container.classList.add('physics-animating');
                tagLinks.forEach(function(link) {
                    link.classList.add('reveal-in');
                    link.style.opacity = '1';
                    link.style.filter = 'none';
                    link.style.transform = link.dataset.finalTransform || 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
                });
            }, 34);
        }

        function applyRowOffsets(rows, boundsWidth) {
            rows.forEach(function(row) {
                var remaining = Math.max(0, boundsWidth - row.width);
                var segments = [];
                var segmentCount = row.items.length + 1;
                var weightTotal = 0;

                for (var segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
                    var weight = Math.random();
                    segments.push(weight);
                    weightTotal += weight;
                }

                var normalizedSegments = segments.map(function(weight) {
                    return weightTotal > 0 ? (weight / weightTotal) * remaining : 0;
                });

                var cursor = normalizedSegments[0] || 0;

                row.items.forEach(function(item, itemIndex) {
                    item.left = cursor;
                    cursor += item.width;

                    if (itemIndex !== row.items.length - 1) {
                        cursor += state.profile.gapX + (normalizedSegments[itemIndex + 1] || 0);
                    }
                });
            });
        }

        function placeRows(rows, padding) {
            var totalRowsHeight = rows.reduce(function(sum, row) {
                return sum + row.height;
            }, 0);
            var totalGapHeight = Math.max(0, rows.length - 1) * state.profile.gapY;
            var requiredHeight = Math.ceil(padding.top + padding.bottom + totalRowsHeight + totalGapHeight);
            var containerHeight = Math.max(state.profile.baseHeight, requiredHeight);
            var cursorY = containerHeight - padding.bottom;

            rows.forEach(function(row) {
                cursorY -= row.height;
                row.top = cursorY;

                row.items.forEach(function(item) {
                    item.top = row.top + Math.max(0, row.height - item.height);
                });

                cursorY -= state.profile.gapY;
            });

            return containerHeight;
        }

        function revealRows(rows, padding, reduceMotion) {
            tagLinks.forEach(function(link) {
                link.classList.remove('reveal-in');
            });

            container.classList.add('physics-ready');
            container.style.height = state.containerHeight + 'px';

            rows.forEach(function(row, rowIndex) {
                row.items.forEach(function(item, itemIndex) {
                    var finalTilt = randomBetween(-state.profile.maxTilt * 0.35, state.profile.maxTilt * 0.35);
                    var startTilt = randomBetween(-state.profile.maxTilt, state.profile.maxTilt);
                    var startTop = Math.min(
                        item.top,
                        padding.top + randomBetween(0, state.profile.startBand)
                    );
                    var delay = Math.round(
                        randomBetween(40, 140) +
                        rowIndex * randomBetween(60, 100) +
                        itemIndex * randomBetween(16, 34)
                    );

                    item.element.style.left = Math.round(padding.left + item.left) + 'px';
                    item.element.style.top = Math.round(item.top) + 'px';
                    item.element.style.width = item.width + 'px';
                    item.element.style.height = item.height + 'px';
                    item.element.style.transitionDelay = delay + 'ms';
                    item.element.style.opacity = '0';
                    item.element.style.filter = 'blur(2px)';
                    item.element.style.transform = 'translate3d(0, ' + Math.round(startTop - item.top) + 'px, 0) scale(0.94) rotate(' + startTilt.toFixed(2) + 'deg)';
                    item.element.style.setProperty('--tag-drop-delay', delay + 'ms');
                    item.element.style.setProperty('--tag-drop-start-y', Math.round(startTop - item.top) + 'px');
                    item.element.style.setProperty('--tag-drop-tilt', startTilt.toFixed(2) + 'deg');
                    item.element.style.setProperty('--tag-final-tilt', finalTilt.toFixed(2) + 'deg');
                    item.element.dataset.finalTransform = 'translate3d(0, 0, 0) scale(1) rotate(' + finalTilt.toFixed(2) + 'deg)';
                });
            });

            if (reduceMotion) {
                tagLinks.forEach(function(link) {
                    link.style.opacity = '1';
                    link.style.filter = 'none';
                    link.style.transform = link.dataset.finalTransform || 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
                    link.classList.add('reveal-in');
                });
                return;
            }

            window.setTimeout(function() {
                container.classList.add('physics-animating');
                tagLinks.forEach(function(link) {
                    link.classList.add('reveal-in');
                    link.style.opacity = '1';
                    link.style.filter = 'none';
                    link.style.transform = link.dataset.finalTransform || 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
                });
            }, 34);
        }

        function layoutTags() {
            resetTags();

            state.profile = getLayoutProfile();

            var containerStyle = window.getComputedStyle(container);
            var padding = {
                top: readNumber(containerStyle.paddingTop),
                right: readNumber(containerStyle.paddingRight),
                bottom: readNumber(containerStyle.paddingBottom),
                left: readNumber(containerStyle.paddingLeft)
            };

            var boundsWidth = Math.max(
                0,
                Math.floor(container.clientWidth - padding.left - padding.right)
            );

            if (!boundsWidth) {
                return;
            }

            if (state.profile.flowLayout) {
                revealFlowTags(
                    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
                );
                return;
            }

            container.style.height = state.profile.baseHeight + 'px';

            var measured = shuffle(measureTags());
            var rows = buildRows(measured, boundsWidth, state.profile.gapX);

            if (!rows.length) {
                return;
            }

            applyRowOffsets(rows, boundsWidth);
            state.containerHeight = placeRows(rows, padding);
            revealRows(
                rows,
                padding,
                window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
            );
        }

        function scheduleLayout() {
            if (state.resizeTimer) {
                window.clearTimeout(state.resizeTimer);
            }

            state.resizeTimer = window.setTimeout(function() {
                layoutTags();
            }, 120);
        }

        resetTags();
        container.__tagDropState = state;
        scheduleLayout();

        if (!state.boundResize) {
            state.boundResize = true;
            window.addEventListener('resize', scheduleLayout, {
                passive: true
            });
            window.addEventListener('orientationchange', scheduleLayout, {
                passive: true
            });
            window.addEventListener('load', scheduleLayout, {
                passive: true,
                once: true
            });

            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(scheduleLayout).catch(function() {});
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTagDrop);
    } else {
        initTagDrop();
    }
}(window, document));
