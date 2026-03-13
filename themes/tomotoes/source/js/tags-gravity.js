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

        function reveal(link) {
            link.classList.remove('reveal-ready');
            link.classList.add('reveal-in');
        }

        tagLinks.forEach(function(link, index) {
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
                link.classList.add('reveal-ready');
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
            rootMargin: '0px 0px -10% 0px',
            threshold: 0.1
        });

        tagLinks.forEach(function(link) {
            observer.observe(link);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTagScroller);
    } else {
        initTagScroller();
    }
}(window, document));
