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
                link.style.setProperty('--tag-drop-delay', Math.min(index * 48, 288) + 'ms');
            } else {
                link.classList.add('reveal-in');
            }
        });

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
            root: container,
            rootMargin: '0px 0px -8% 0px',
            threshold: 0.12
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
