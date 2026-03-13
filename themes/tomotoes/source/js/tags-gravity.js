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

        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var coarsePointer = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;
        var isTouchDevice = coarsePointer || /Android|iPhone|iPad|iPod|iOS|Windows Phone/i.test(window.navigator.userAgent);
        var raf = window.requestAnimationFrame || function(callback) {
            return window.setTimeout(callback, 16);
        };
        var caf = window.cancelAnimationFrame || window.clearTimeout;

        function randomBetween(min, max) {
            return min + Math.random() * (max - min);
        }

        function getViewportHeight() {
            return window.innerHeight || document.documentElement.clientHeight || 0;
        }

        function getContainerPadding() {
            var computedStyle = window.getComputedStyle(container);
            return {
                left: parseFloat(computedStyle.paddingLeft) || 0,
                right: parseFloat(computedStyle.paddingRight) || 0
            };
        }

        function shuffleMetrics(metrics) {
            var clone = metrics.slice();
            for (var i = clone.length - 1; i > 0; i--) {
                var swapIndex = Math.floor(Math.random() * (i + 1));
                var current = clone[i];
                clone[i] = clone[swapIndex];
                clone[swapIndex] = current;
            }
            return clone;
        }

        function destroyDrop() {
            var state = container.__tagDropState;
            if (state) {
                if (state.frame) {
                    caf(state.frame);
                }
                if (state.resizeTimer) {
                    window.clearTimeout(state.resizeTimer);
                }
                if (state.onResize) {
                    window.removeEventListener('resize', state.onResize);
                }
            }

            tagLinks.forEach(function(link) {
                link.classList.remove('drop-entered');
                link.style.width = '';
                link.style.height = '';
                link.style.opacity = '';
                link.style.transform = '';
                link.style.transitionDelay = '';
            });

            container.classList.remove('physics-ready');
            container.style.height = '';
            container.__tagDropState = null;
        }

        function measureTags() {
            return tagLinks.map(function(link) {
                var card = link.querySelector('.card-card');
                var previous = {
                    linkWidth: link.style.width,
                    linkHeight: link.style.height,
                    linkTransform: link.style.transform,
                    cardDisplay: card ? card.style.display : '',
                    cardWidth: card ? card.style.width : '',
                    cardMaxWidth: card ? card.style.maxWidth : ''
                };

                link.style.width = 'auto';
                link.style.height = 'auto';
                link.style.transform = 'none';

                if (card) {
                    card.style.display = 'inline-flex';
                    card.style.width = 'auto';
                    card.style.maxWidth = Math.min(container.clientWidth - 24, isTouchDevice ? 268 : 320) + 'px';
                }

                var rect = (card || link).getBoundingClientRect();
                var metric = {
                    link: link,
                    width: Math.ceil(Math.max(rect.width, 108)),
                    height: Math.ceil(Math.max(rect.height, 46))
                };

                link.style.width = previous.linkWidth;
                link.style.height = previous.linkHeight;
                link.style.transform = previous.linkTransform;

                if (card) {
                    card.style.display = previous.cardDisplay;
                    card.style.width = previous.cardWidth;
                    card.style.maxWidth = previous.cardMaxWidth;
                }

                return metric;
            });
        }

        function buildLayout(metrics) {
            var padding = getContainerPadding();
            var containerWidth = Math.max(container.clientWidth, 320);
            var usableWidth = Math.max(containerWidth - padding.left - padding.right, 220);
            var baseGap = isTouchDevice ? 10 : 14;
            var rowGap = isTouchDevice ? 14 : 18;
            var baseHeight = isTouchDevice ? Math.max(420, getViewportHeight() * 0.62) : Math.max(520, getViewportHeight() * 0.72);
            var shuffled = shuffleMetrics(metrics);
            var rows = [];
            var currentRow = [];
            var currentWidth = 0;
            var currentHeight = 0;

            shuffled.forEach(function(metric) {
                metric.width = Math.min(metric.width, usableWidth);
                var nextWidth = currentRow.length ? currentWidth + baseGap + metric.width : metric.width;
                if (currentRow.length && nextWidth > usableWidth) {
                    rows.push({
                        items: currentRow.slice(),
                        height: currentHeight
                    });
                    currentRow = [];
                    currentWidth = 0;
                    currentHeight = 0;
                }

                currentWidth = currentRow.length ? currentWidth + baseGap + metric.width : metric.width;
                currentHeight = Math.max(currentHeight, metric.height);
                currentRow.push(metric);
            });

            if (currentRow.length) {
                rows.push({
                    items: currentRow.slice(),
                    height: currentHeight
                });
            }

            var cursorY = isTouchDevice ? 26 : 32;

            rows.forEach(function(row, rowIndex) {
                var contentWidth = row.items.reduce(function(sum, item) {
                    return sum + item.width;
                }, 0);
                var fixedGapWidth = baseGap * Math.max(row.items.length - 1, 0);
                var freeSpace = Math.max(0, usableWidth - contentWidth - fixedGapWidth);
                var slots = row.items.length + 1;
                var weights = [];
                var weightTotal = 0;

                for (var i = 0; i < slots; i++) {
                    var weight = 0.55 + Math.random();
                    weights.push(weight);
                    weightTotal += weight;
                }

                var extraSpacing = weights.map(function(weight) {
                    return freeSpace * (weight / weightTotal);
                });

                var cursorX = padding.left + extraSpacing[0];

                row.items.forEach(function(item, itemIndex) {
                    var verticalSlack = Math.max((row.height - item.height) / 2, 0);
                    var yJitter = Math.min(isTouchDevice ? 4 : 7, verticalSlack);
                    var finalX = Math.max(padding.left, Math.min(cursorX, containerWidth - padding.right - item.width));
                    var finalY = cursorY + verticalSlack + randomBetween(-yJitter, yJitter);

                    item.finalX = finalX;
                    item.finalY = finalY;
                    item.finalRotation = randomBetween(-4.5, 4.5);
                    item.startX = Math.max(padding.left, Math.min(randomBetween(padding.left - 16, containerWidth - padding.right - item.width + 16), containerWidth - padding.right - item.width));
                    item.startY = -randomBetween(item.height + 48, baseHeight * 0.58 + rowIndex * 24);
                    item.startRotation = randomBetween(-18, 18);
                    item.delay = Math.round(randomBetween(20, 280) + rowIndex * 95 + itemIndex * 30);

                    cursorX += item.width + baseGap + extraSpacing[itemIndex + 1];
                });

                cursorY += row.height + rowGap;
            });

            var contentHeight = cursorY + (isTouchDevice ? 22 : 30);

            return {
                height: Math.ceil(Math.max(baseHeight, contentHeight)),
                metrics: metrics
            };
        }

        function applyLayout(layout) {
            container.classList.add('physics-ready');
            container.style.height = layout.height + 'px';

            layout.metrics.forEach(function(metric) {
                var link = metric.link;
                link.classList.remove('drop-entered');
                link.style.width = metric.width + 'px';
                link.style.height = metric.height + 'px';
                link.style.opacity = reduceMotion ? '1' : '0';
                link.style.transitionDelay = reduceMotion ? '0ms' : metric.delay + 'ms';
                link.style.transform = reduceMotion ?
                    'translate3d(' + metric.finalX + 'px, ' + metric.finalY + 'px, 0) rotate(' + metric.finalRotation + 'deg)' :
                    'translate3d(' + metric.startX + 'px, ' + metric.startY + 'px, 0) rotate(' + metric.startRotation + 'deg)';
            });

            if (reduceMotion) {
                layout.metrics.forEach(function(metric) {
                    metric.link.classList.add('drop-entered');
                });
                return;
            }

            container.__tagDropState.frame = raf(function() {
                container.__tagDropState.frame = raf(function() {
                    layout.metrics.forEach(function(metric) {
                        var link = metric.link;
                        link.style.opacity = '1';
                        link.style.transform = 'translate3d(' + metric.finalX + 'px, ' + metric.finalY + 'px, 0) rotate(' + metric.finalRotation + 'deg)';
                        link.classList.add('drop-entered');
                    });
                });
            });
        }

        destroyDrop();

        var layout = buildLayout(measureTags());

        function onResize() {
            window.clearTimeout(container.__tagDropState.resizeTimer);
            container.__tagDropState.resizeTimer = window.setTimeout(function() {
                destroyDrop();
                initTagDrop();
            }, 220);
        }

        container.__tagDropState = {
            frame: null,
            resizeTimer: null,
            onResize: onResize
        };

        applyLayout(layout);

        window.addEventListener('resize', onResize, {
            passive: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTagDrop);
    } else {
        initTagDrop();
    }
}(window, document));
