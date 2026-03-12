(function(window, document) {
    function initTagGravity() {
        if (!window.Matter) {
            return;
        }

        var container = document.querySelector('.physics-container');
        if (!container || !document.querySelector('.tags-header')) {
            return;
        }

        var tagLinks = Array.prototype.slice.call(container.querySelectorAll('.tag-link'));
        if (!tagLinks.length) {
            return;
        }

        var Matter = window.Matter;
        var Engine = Matter.Engine;
        var Render = Matter.Render;
        var Runner = Matter.Runner;
        var Bodies = Matter.Bodies;
        var Mouse = Matter.Mouse;
        var MouseConstraint = Matter.MouseConstraint;
        var World = Matter.World;
        var Query = Matter.Query;
        var engine = Engine.create({
            gravity: { x: 0, y: 1 }
        });

        container.classList.add('physics-ready');

        var render = Render.create({
            element: container,
            engine: engine,
            options: {
                width: container.offsetWidth,
                height: container.offsetHeight,
                wireframes: false,
                background: 'transparent',
                pixelRatio: window.devicePixelRatio || 1
            }
        });
        var mouse = Mouse.create(render.canvas);
        mouse.pixelRatio = window.devicePixelRatio || 1;

        var mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.3,
                render: { visible: false }
            }
        });

        var boundaries = [
            Bodies.rectangle(container.offsetWidth / 2, container.offsetHeight + 50, container.offsetWidth, 100, {
                isStatic: true,
                render: { fillStyle: 'transparent' }
            }),
            Bodies.rectangle(-50, container.offsetHeight / 2, 100, container.offsetHeight, {
                isStatic: true,
                render: { fillStyle: 'transparent' }
            }),
            Bodies.rectangle(container.offsetWidth + 50, container.offsetHeight / 2, 100, container.offsetHeight, {
                isStatic: true,
                render: { fillStyle: 'transparent' }
            })
        ];

        World.add(engine.world, boundaries);
        World.add(engine.world, mouseConstraint);

        var items = [];
        tagLinks.forEach(function(link, index) {
            link.style.position = 'absolute';
            link.style.margin = '0';
            link.style.transform = 'none';
            link.style.pointerEvents = 'none';
            link.style.zIndex = '10';

            var card = link.querySelector('.card-card');
            if (card) {
                card.style.animation = 'none';
                card.style.margin = '0';
                card.style.display = 'block';
            }

            var width = link.offsetWidth || 180;
            var height = link.offsetHeight || 40;
            var startX = Math.random() * (container.offsetWidth - width) + width / 2;
            var startY = (Math.random() * 100) - 200 - (30 * index);
            var body = Bodies.rectangle(startX, startY, width, height, {
                restitution: 0.2,
                friction: 0.3,
                frictionAir: 0.02,
                chamfer: { radius: 15 },
                mass: 2,
                render: {
                    fillStyle: 'transparent',
                    strokeStyle: 'transparent',
                    lineWidth: 0
                }
            });

            items.push({ body: body, element: link });
            World.add(engine.world, body);
        });

        var isPointerDown = false;
        var isDragging = false;
        var startedAt = 0;
        var startPoint = { x: 0, y: 0 };

        function updateMousePosition(event) {
            var rect = render.canvas.getBoundingClientRect();
            mouse.position.x = event.clientX - rect.left;
            mouse.position.y = event.clientY - rect.top;
        }

        function getDynamicBodiesAtPointer() {
            return Query.point(engine.world.bodies, mouse.position).filter(function(body) {
                return !body.isStatic;
            });
        }

        function navigateFromPointer() {
            var hitBodies = getDynamicBodiesAtPointer();
            if (!hitBodies.length) {
                return;
            }
            var hit = items.find(function(item) {
                return item.body === hitBodies[0];
            });
            if (hit) {
                var href = hit.element.getAttribute('data-href');
                if (href) {
                    window.location.href = href;
                }
            }
        }

        render.canvas.addEventListener('mousedown', function(event) {
            updateMousePosition(event);
            isPointerDown = true;
            isDragging = false;
            startedAt = Date.now();
            startPoint = {
                x: mouse.position.x,
                y: mouse.position.y
            };
            event.preventDefault();
        });

        render.canvas.addEventListener('mousemove', function(event) {
            updateMousePosition(event);
            if (!isPointerDown) {
                container.style.cursor = Query.point(engine.world.bodies, mouse.position).length ? 'grab' : 'default';
                return;
            }
            var delta = Math.sqrt(Math.pow(mouse.position.x - startPoint.x, 2) + Math.pow(mouse.position.y - startPoint.y, 2));
            if (delta > 5) {
                isDragging = true;
            }
            event.preventDefault();
        });

        render.canvas.addEventListener('mouseup', function(event) {
            updateMousePosition(event);
            var delta = Math.sqrt(Math.pow(mouse.position.x - startPoint.x, 2) + Math.pow(mouse.position.y - startPoint.y, 2));
            var duration = Date.now() - startedAt;
            if (!isDragging && delta < 5 && duration < 300) {
                navigateFromPointer();
            }
            isPointerDown = false;
            isDragging = false;
            container.style.cursor = Query.point(engine.world.bodies, mouse.position).length ? 'grab' : 'default';
        });

        render.canvas.addEventListener('touchstart', function(event) {
            if (!event.touches.length) {
                return;
            }
            updateMousePosition(event.touches[0]);
            isPointerDown = true;
            isDragging = false;
            startedAt = Date.now();
            startPoint = {
                x: mouse.position.x,
                y: mouse.position.y
            };
            event.preventDefault();
        }, { passive: false });

        render.canvas.addEventListener('touchmove', function(event) {
            if (!event.touches.length) {
                return;
            }
            updateMousePosition(event.touches[0]);
            var delta = Math.sqrt(Math.pow(mouse.position.x - startPoint.x, 2) + Math.pow(mouse.position.y - startPoint.y, 2));
            if (delta > 10) {
                isDragging = true;
            }
            event.preventDefault();
        }, { passive: false });

        render.canvas.addEventListener('touchend', function(event) {
            var delta = Math.sqrt(Math.pow(mouse.position.x - startPoint.x, 2) + Math.pow(mouse.position.y - startPoint.y, 2));
            var duration = Date.now() - startedAt;
            if (!isDragging && delta < 15 && duration < 300) {
                navigateFromPointer();
            }
            isPointerDown = false;
            isDragging = false;
            event.preventDefault();
        }, { passive: false });

        Runner.run(engine);
        Render.run(render);

        function updatePositions() {
            items.forEach(function(item) {
                var body = item.body;
                item.element.style.transform = 'translate(' +
                    (body.position.x - item.element.offsetWidth / 2) + 'px, ' +
                    (body.position.y - item.element.offsetHeight / 2) + 'px) rotate(' +
                    (body.angle * (180 / Math.PI)) + 'deg)';
            });
            window.requestAnimationFrame(updatePositions);
        }

        function resize() {
            render.options.width = container.offsetWidth;
            render.options.height = container.offsetHeight;
            render.canvas.width = container.offsetWidth;
            render.canvas.height = container.offsetHeight;
            boundaries[0].position.x = container.offsetWidth / 2;
            boundaries[2].position.x = container.offsetWidth + 50;
            if (typeof Render.setPixelRatio === 'function') {
                Render.setPixelRatio(render, window.devicePixelRatio || 1);
            }
            mouse.pixelRatio = window.devicePixelRatio || 1;
        }

        var resizeTimer = null;
        window.addEventListener('resize', function() {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(resize, 250);
        });

        updatePositions();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTagGravity);
    } else {
        initTagGravity();
    }
}(window, document));
