(function(window, document) {
    function initTagScroller() {
        var container = document.querySelector('.physics-container');
        if (!container || !document.querySelector('.tags-header')) {
            return;
        }

        var tagLinks = Array.prototype.slice.call(container.querySelectorAll('.tag-link'));
        if (!tagLinks.length) {
            return;
        }

        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        container.classList.add('tag-scroll-ready');
        var raf = window.requestAnimationFrame || function(callback) {
            return window.setTimeout(callback, 16);
        };

        function getColumns() {
            if (window.innerWidth <= 767) {
                return 1;
            }
            if (window.innerWidth <= 991) {
                return 2;
            }
            return 3;
        }

        function applyDropMetrics() {
            var columns = getColumns();
            tagLinks.forEach(function(link, index) {
                var row = Math.floor(index / columns);
                var col = index % columns;
                var delay = Math.min(row * 120 + col * 58, 820);
                var distance = 18 + row * 7 + col * 5;
                var tilt = (col === 1 ? 0 : col % 2 === 0 ? -1 : 1) * (2 + (row % 3));

                link.style.setProperty('--tag-drop-delay', delay + 'ms');
                link.style.setProperty('--tag-drop-distance', distance + 'px');
                link.style.setProperty('--tag-drop-tilt', tilt + 'deg');
            });
        }

        function openLink(link) {
            var href = link.getAttribute('data-href');
            if (href) {
                window.location.href = href;
            }
        }

        function isNearViewport(link) {
            var rect = link.getBoundingClientRect();
            var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            return rect.bottom >= 0 && rect.top <= viewportHeight * 0.92;
        }

        function reveal(link) {
            if (!link || link.dataset.tagRevealState === 'done' || link.dataset.tagRevealState === 'queued') {
                return;
            }
            link.dataset.tagRevealState = 'queued';
            raf(function() {
                link.getBoundingClientRect();
                link.classList.remove('reveal-ready');
                link.classList.add('reveal-in');
                link.dataset.tagRevealState = 'done';
            });
        }

        function armReveal(link) {
            link.dataset.tagRevealState = 'ready';
            link.classList.remove('reveal-ready');
            link.classList.remove('reveal-in');
            link.getBoundingClientRect();
            link.classList.add('reveal-ready');
        }

        tagLinks.forEach(function(link) {
            link.classList.add('tag-drop-item');
            link.addEventListener('click', function() {
                openLink(link);
            });
            link.addEventListener('keydown', function(event) {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }
                event.preventDefault();
                openLink(link);
            });
            if (!reduceMotion) {
                armReveal(link);
            } else {
                link.classList.add('reveal-in');
            }
        });

        if (!reduceMotion) {
            applyDropMetrics();
            window.addEventListener('resize', applyDropMetrics, {
                passive: true
            });
        }

        if (reduceMotion || !('IntersectionObserver' in window)) {
            tagLinks.forEach(reveal);
            return;
        }

        raf(function() {
            raf(function() {
                var observer = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (!entry.isIntersecting) {
                            return;
                        }
                        reveal(entry.target);
                        observer.unobserve(entry.target);
                    });
                }, {
                    root: null,
                    rootMargin: '0px 0px -8% 0px',
                    threshold: 0.08
                });

                tagLinks.forEach(function(link) {
                    if (isNearViewport(link)) {
                        reveal(link);
                    }
                    observer.observe(link);
                });
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTagScroller);
    } else {
        initTagScroller();
    }
}(window, document));
