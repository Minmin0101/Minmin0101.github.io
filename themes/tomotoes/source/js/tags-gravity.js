(function(window, document) {
    function initTagPhysics() {
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
        var Matter = window.Matter;
        var raf = window.requestAnimationFrame || function(callback) {
            return window.setTimeout(callback, 16);
        };
        var caf = window.cancelAnimationFrame || window.clearTimeout;

        function destroyPhysics() {
            var state = container.__tagPhysicsState;
            if (!state) {
                return;
            }

            if (state.frame) {
                caf(state.frame);
            }
            if (state.resizeTimer) {
                window.clearTimeout(state.resizeTimer);
            }
            if (state.onResize) {
                window.removeEventListener('resize', state.onResize);
            }
            if (state.engine && Matter) {
                Matter.Composite.clear(state.engine.world, false);
                Matter.Engine.clear(state.engine);
            }

            tagLinks.forEach(function(link) {
                link.style.transform = '';
                link.style.width = '';
                link.style.height = '';
                link.style.pointerEvents = '';
                link.style.zIndex = '';
            });

            container.classList.remove('physics-ready');
            container.style.height = '';
            container.__tagPhysicsState = null;
        }

        destroyPhysics();

        if (reduceMotion || !Matter) {
            return;
        }

        if (window.decomp && Matter.Common && Matter.Common.setDecomp) {
            Matter.Common.setDecomp(window.decomp);
        }

        var Engine = Matter.Engine;
        var Bodies = Matter.Bodies;
        var Body = Matter.Body;
        var Composite = Matter.Composite;

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
                    card.style.maxWidth = Math.min(container.clientWidth - 24, isTouchDevice ? 260 : 320) + 'px';
                }

                var linkRect = link.getBoundingClientRect();
                var cardRect = card ? card.getBoundingClientRect() : linkRect;
                var metric = {
                    link: link,
                    width: Math.ceil(Math.max(cardRect.width, 108)),
                    height: Math.ceil(Math.max(cardRect.height, 46))
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

        function computeSceneHeight(metrics, sceneWidth) {
            var totalArea = metrics.reduce(function(sum, metric) {
                return sum + (metric.width + 28) * (metric.height + 24);
            }, 0);
            var viewportHeight = getViewportHeight();
            var minHeight = isTouchDevice ? Math.max(520, viewportHeight * 0.88) : Math.max(620, viewportHeight * 0.92);
            var flowHeight = totalArea / Math.max(sceneWidth, 280);
            var topDropZone = isTouchDevice ? 240 : 320;
            return Math.ceil(Math.max(minHeight, flowHeight * (isTouchDevice ? 2.2 : 1.85) + topDropZone));
        }

        function buildPhysicsScene() {
            var metrics = measureTags();
            var padding = getContainerPadding();
            var sceneWidth = Math.max(container.clientWidth, 320);
            var usableWidth = Math.max(sceneWidth - padding.left - padding.right, 240);
            var sceneHeight = computeSceneHeight(metrics, usableWidth);
            var wallThickness = 120;

            container.style.height = sceneHeight + 'px';
            container.classList.add('physics-ready');

            var engine = Engine.create({
                gravity: {
                    x: 0,
                    y: isTouchDevice ? 1.02 : 0.96
                }
            });

            Composite.add(engine.world, [
                Bodies.rectangle(sceneWidth / 2, sceneHeight + wallThickness / 2, sceneWidth + wallThickness * 2, wallThickness, {
                    isStatic: true
                }),
                Bodies.rectangle(-wallThickness / 2, sceneHeight / 2, wallThickness, sceneHeight * 2, {
                    isStatic: true
                }),
                Bodies.rectangle(sceneWidth + wallThickness / 2, sceneHeight / 2, wallThickness, sceneHeight * 2, {
                    isStatic: true
                })
            ]);

            metrics.forEach(function(metric, index) {
                var minX = padding.left + metric.width / 2;
                var maxX = sceneWidth - padding.right - metric.width / 2;
                var startX = randomBetween(minX, Math.max(minX + 1, maxX));
                var startY = -randomBetween(metric.height + index * 18, sceneHeight * 0.42 + metric.height + index * 10);
                var body = Bodies.rectangle(startX, startY, metric.width, metric.height, {
                    restitution: randomBetween(0.08, 0.18),
                    friction: randomBetween(0.18, 0.32),
                    frictionAir: randomBetween(isTouchDevice ? 0.022 : 0.015, isTouchDevice ? 0.03 : 0.022),
                    chamfer: {
                        radius: Math.min(22, Math.round(metric.height / 2))
                    }
                });

                Body.setAngle(body, randomBetween(-0.18, 0.18));
                Body.setVelocity(body, {
                    x: randomBetween(-1.45, 1.45) * (isTouchDevice ? 0.8 : 1.15),
                    y: randomBetween(0.15, 1.3)
                });
                Body.setAngularVelocity(body, randomBetween(-0.04, 0.04));

                metric.body = body;
                metric.link.style.width = metric.width + 'px';
                metric.link.style.height = metric.height + 'px';
                metric.link.style.pointerEvents = 'auto';
                metric.link.style.zIndex = '2';

                Composite.add(engine.world, body);
            });

            return {
                engine: engine,
                metrics: metrics
            };
        }

        var scene = buildPhysicsScene();
        var settleFrames = 0;
        var lastTime = window.performance && typeof window.performance.now === 'function' ? window.performance.now() : Date.now();

        function tick(now) {
            var current = now || (window.performance && typeof window.performance.now === 'function' ? window.performance.now() : Date.now());
            var delta = Math.min(current - lastTime, 32);
            lastTime = current;

            Matter.Engine.update(scene.engine, delta);

            var allSettled = true;

            scene.metrics.forEach(function(metric) {
                var body = metric.body;
                var x = body.position.x - metric.width / 2;
                var y = body.position.y - metric.height / 2;
                metric.link.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) rotate(' + body.angle + 'rad)';

                if (allSettled && (Math.abs(body.velocity.x) > 0.04 || Math.abs(body.velocity.y) > 0.04 || Math.abs(body.angularVelocity) > 0.01)) {
                    allSettled = false;
                }
            });

            settleFrames = allSettled ? settleFrames + 1 : 0;

            if (settleFrames < 90) {
                container.__tagPhysicsState.frame = raf(tick);
            } else {
                container.__tagPhysicsState.frame = null;
            }
        }

        function onResize() {
            window.clearTimeout(container.__tagPhysicsState.resizeTimer);
            container.__tagPhysicsState.resizeTimer = window.setTimeout(function() {
                destroyPhysics();
                initTagPhysics();
            }, 220);
        }

        container.__tagPhysicsState = {
            engine: scene.engine,
            frame: raf(tick),
            onResize: onResize,
            resizeTimer: null
        };

        window.addEventListener('resize', onResize, {
            passive: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTagPhysics);
    } else {
        initTagPhysics();
    }
}(window, document));
