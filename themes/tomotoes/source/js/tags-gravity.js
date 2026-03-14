document.addEventListener('DOMContentLoaded', function() {
    if (!document.querySelector('.tags-header')) {
        return;
    }

    document.documentElement.classList.add('tags-page-scroll');
    document.body.classList.add('tags-page-scroll');
    document.documentElement.style.height = 'auto';
    document.documentElement.style.minHeight = '100%';
    document.documentElement.style.overflowY = 'auto';
    document.body.style.height = 'auto';
    document.body.style.minHeight = '100%';
    document.body.style.overflowY = 'auto';

    try {
        setTimeout(function() {
            var Engine = Matter.Engine;
            var Render = Matter.Render;
            var Runner = Matter.Runner;
            var Bodies = Matter.Bodies;
            var Mouse = Matter.Mouse;
            var MouseConstraint = Matter.MouseConstraint;
            var World = Matter.World;
            var Query = Matter.Query;
            var Body = Matter.Body;
            var container = document.querySelector('.physics-container');
            var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

            if (!container) {
                return;
            }

            var pixelRatio = isTouchDevice ? 1 : window.devicePixelRatio || 1;

            var engine = Engine.create({
                gravity: {
                    x: 0,
                    y: 1
                }
            });

            var render = Render.create({
                element: container,
                engine: engine,
                options: {
                    width: container.offsetWidth,
                    height: container.offsetHeight,
                    wireframes: false,
                    background: 'transparent',
                    pixelRatio: pixelRatio
                }
            });

            render.options.pixelRatio = pixelRatio;
            render.canvas.style.touchAction = isTouchDevice ? 'pan-y' : 'pan-y pinch-zoom';
            render.canvas.style.webkitTapHighlightColor = 'transparent';
            render.canvas.style.webkitBackfaceVisibility = 'hidden';
            render.canvas.style.backfaceVisibility = 'hidden';

            var mouse = null;
            var mouseConstraint = null;

            if (isTouchDevice) {
                container.classList.add('physics-container-touch');
                render.canvas.style.pointerEvents = 'none';
            } else {
                mouse = Mouse.create(render.canvas);
                mouse.pixelRatio = pixelRatio;

                mouseConstraint = MouseConstraint.create(engine, {
                    mouse: mouse,
                    constraint: {
                        stiffness: 0.3,
                        render: {
                            visible: false
                        }
                    }
                });
            }

            var walls = [
                Bodies.rectangle(
                    container.offsetWidth / 2,
                    container.offsetHeight + 50,
                    container.offsetWidth,
                    100,
                    {
                        isStatic: true,
                        render: {
                            fillStyle: 'transparent'
                        }
                    }
                ),
                Bodies.rectangle(
                    -50,
                    container.offsetHeight / 2,
                    100,
                    container.offsetHeight,
                    {
                        isStatic: true,
                        render: {
                            fillStyle: 'transparent'
                        }
                    }
                ),
                Bodies.rectangle(
                    container.offsetWidth + 50,
                    container.offsetHeight / 2,
                    100,
                    container.offsetHeight,
                    {
                        isStatic: true,
                        render: {
                            fillStyle: 'transparent'
                        }
                    }
                )
            ];

            World.add(engine.world, walls);
            if (mouseConstraint) {
                World.add(engine.world, mouseConstraint);
            }

            var tags = Array.from(container.querySelectorAll('.tag-link'));

            if (!tags.length) {
                console.error('No tag links found');
                return;
            }

            var tagBodies = [];
            var touchTagState = null;
            var suppressTouchClickUntil = 0;

            function openTag(tag) {
                var href = tag && tag.getAttribute('data-href');
                if (href) {
                    window.location.href = href;
                }
            }

            function getTagEntry(target) {
                var tag = target && target.closest ? target.closest('.tag-link') : null;
                if (!tag) {
                    return null;
                }

                return tagBodies.find(function(entry) {
                    return entry.element === tag;
                }) || null;
            }

            function clamp(value, min, max) {
                return Math.max(min, Math.min(max, value));
            }

            function clearTouchTagState() {
                if (!touchTagState) {
                    return;
                }

                if (touchTagState.entry && touchTagState.entry.element) {
                    touchTagState.entry.element.classList.remove('touch-dragging');
                }
                touchTagState = null;
            }

            function bindTouchTagInteractions(entry) {
                var tag = entry.element;
                var startThreshold = 8;

                tag.addEventListener('click', function(event) {
                    if (Date.now() < suppressTouchClickUntil) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    openTag(tag);
                });

                tag.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openTag(tag);
                    }
                });

                tag.addEventListener('touchstart', function(event) {
                    if (!event.touches.length) {
                        return;
                    }

                    var touch = event.touches[0];
                    var rect = container.getBoundingClientRect();

                    clearTouchTagState();
                    touchTagState = {
                        entry: entry,
                        startX: touch.clientX,
                        startY: touch.clientY,
                        lastX: touch.clientX,
                        lastY: touch.clientY,
                        lastTime: Date.now(),
                        dragging: false,
                        moved: false,
                        startTime: Date.now(),
                        offsetX: touch.clientX - rect.left - entry.body.position.x,
                        offsetY: touch.clientY - rect.top - entry.body.position.y
                    };
                }, {
                    passive: true
                });

                tag.addEventListener('touchmove', function(event) {
                    if (!touchTagState || touchTagState.entry !== entry || !event.touches.length) {
                        return;
                    }

                    var touch = event.touches[0];
                    var deltaX = touch.clientX - touchTagState.startX;
                    var deltaY = touch.clientY - touchTagState.startY;
                    var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                    if (!touchTagState.dragging && distance > startThreshold) {
                        touchTagState.dragging = true;
                        touchTagState.entry.element.classList.add('touch-dragging');
                    }

                    if (!touchTagState.dragging) {
                        return;
                    }

                    var rect = container.getBoundingClientRect();
                    var halfWidth = entry.element.offsetWidth / 2;
                    var halfHeight = entry.element.offsetHeight / 2;
                    var nextX = clamp(
                        touch.clientX - rect.left - touchTagState.offsetX,
                        halfWidth,
                        container.offsetWidth - halfWidth
                    );
                    var nextY = clamp(
                        touch.clientY - rect.top - touchTagState.offsetY,
                        halfHeight,
                        container.offsetHeight - halfHeight
                    );

                    touchTagState.moved = true;
                    touchTagState.lastX = touch.clientX;
                    touchTagState.lastY = touch.clientY;
                    touchTagState.lastTime = Date.now();

                    Body.setPosition(entry.body, {
                        x: nextX,
                        y: nextY
                    });
                    Body.setVelocity(entry.body, {
                        x: 0,
                        y: 0
                    });
                    Body.setAngularVelocity(entry.body, 0);
                    event.preventDefault();
                }, {
                    passive: false
                });

                tag.addEventListener('touchend', function(event) {
                    if (!touchTagState || touchTagState.entry !== entry) {
                        return;
                    }

                    var duration = Date.now() - touchTagState.startTime;
                    var tapDistance = Math.sqrt(
                        Math.pow(touchTagState.lastX - touchTagState.startX, 2) +
                        Math.pow(touchTagState.lastY - touchTagState.startY, 2)
                    );
                    var isTap = !touchTagState.dragging && !touchTagState.moved && tapDistance < startThreshold && duration < 320;

                    if (isTap) {
                        suppressTouchClickUntil = Date.now() + 400;
                        event.preventDefault();
                        openTag(tag);
                    } else if (touchTagState.dragging) {
                        suppressTouchClickUntil = Date.now() + 250;
                        event.preventDefault();
                    }

                    clearTouchTagState();
                }, {
                    passive: false
                });

                tag.addEventListener('touchcancel', function() {
                    clearTouchTagState();
                }, {
                    passive: true
                });
            }

            tags.forEach(function(tag, index) {
                try {
                    tag.style.position = 'absolute';
                    tag.style.margin = '0';
                    tag.style.transform = 'none';
                    tag.style.pointerEvents = isTouchDevice ? 'auto' : 'none';
                    tag.style.zIndex = '10';
                    tag.style.webkitTapHighlightColor = 'transparent';

                    var card = tag.querySelector('.card-card');
                    if (card) {
                        card.style.animation = 'none';
                        card.style.margin = '0';
                        card.style.display = 'block';
                    }

                    var width = tag.offsetWidth || 180;
                    var height = tag.offsetHeight || 40;
                    var x = Math.random() * (container.offsetWidth - width) + width / 2;
                    var y = Math.random() * 100 - 200 - 30 * index;
                    var body = Bodies.rectangle(x, y, width, height, {
                        restitution: 0.2,
                        friction: 0.3,
                        frictionAir: 0.02,
                        chamfer: {
                            radius: 15
                        },
                        mass: 2,
                        render: {
                            fillStyle: 'transparent',
                            strokeStyle: 'transparent',
                            lineWidth: 0
                        }
                    });

                    tagBodies.push({
                        body: body,
                        element: tag
                    });
                    World.add(engine.world, body);

                    if (isTouchDevice) {
                        bindTouchTagInteractions(tagBodies[tagBodies.length - 1]);
                    }
                } catch (error) {
                    console.error('Error creating tag body', error);
                }
            });

            var isDragging = false;
            var hasMoved = false;
            var dragStartTime;
            var startPos = {
                x: 0,
                y: 0
            };

            container.style.cursor = 'default';

            if (!isTouchDevice) {
                render.canvas.addEventListener('wheel', function(event) {
                    if (!event.deltaY) {
                        return;
                    }

                    window.scrollBy({
                        top: event.deltaY,
                        left: 0,
                        behavior: 'auto'
                    });
                    event.preventDefault();
                }, {
                    passive: false
                });

                render.canvas.addEventListener('mousedown', function(event) {
                    var rect = render.canvas.getBoundingClientRect();
                    mouse.position.x = event.clientX - rect.left;
                    mouse.position.y = event.clientY - rect.top;
                    isDragging = true;
                    dragStartTime = Date.now();
                    startPos = {
                        x: mouse.position.x,
                        y: mouse.position.y
                    };

                    var hasBody = Query.point(engine.world.bodies, mouse.position).length > 0;
                    container.style.cursor = hasBody ? 'grabbing' : 'default';
                    event.preventDefault();
                });

                render.canvas.addEventListener('mousemove', function(event) {
                    var rect = render.canvas.getBoundingClientRect();
                    mouse.position.x = event.clientX - rect.left;
                    mouse.position.y = event.clientY - rect.top;

                    if (isDragging) {
                        if (Math.sqrt(
                            Math.pow(mouse.position.x - startPos.x, 2) +
                            Math.pow(mouse.position.y - startPos.y, 2)
                        ) > 5) {
                            hasMoved = true;
                        }
                        event.preventDefault();
                    }

                    var hasBody = Query.point(engine.world.bodies, mouse.position).length > 0;
                    if (!isDragging) {
                        container.style.cursor = hasBody ? 'grab' : 'default';
                    }
                });

                render.canvas.addEventListener('mouseup', function(event) {
                    var rect = render.canvas.getBoundingClientRect();
                    mouse.position.x = event.clientX - rect.left;
                    mouse.position.y = event.clientY - rect.top;

                    var distance = Math.sqrt(
                        Math.pow(mouse.position.x - startPos.x, 2) +
                        Math.pow(mouse.position.y - startPos.y, 2)
                    );
                    var duration = Date.now() - dragStartTime;

                    if (!hasMoved && distance < 5 && duration < 300) {
                        var clickedBodies = Query.point(engine.world.bodies, mouse.position);
                        if (clickedBodies.length > 0) {
                            var nonStatic = clickedBodies.filter(function(body) {
                                return !body.isStatic;
                            });

                            if (nonStatic.length > 0) {
                                var tagData = tagBodies.find(function(entry) {
                                    return entry.body === nonStatic[0];
                                });
                                if (tagData) {
                                    openTag(tagData.element);
                                }
                            }
                        }
                    }

                    hasMoved = false;
                    isDragging = false;
                    var hasBody = Query.point(engine.world.bodies, mouse.position).length > 0;
                    container.style.cursor = hasBody ? 'grab' : 'default';
                });
            }

            Runner.run(engine);
            Render.run(render);

            (function updateElements() {
                tagBodies.forEach(function(entry) {
                    var body = entry.body;
                    var element = entry.element;
                    try {
                        var position = body.position;
                        var angle = body.angle * (180 / Math.PI);
                        element.style.transform =
                            'translate(' +
                            (position.x - element.offsetWidth / 2) +
                            'px, ' +
                            (position.y - element.offsetHeight / 2) +
                            'px) rotate(' +
                            angle +
                            'deg)';
                    } catch (error) {
                        console.error('Error updating element position', error);
                    }
                });

                requestAnimationFrame(updateElements);
            }());

            var resizeTimeout;
            window.addEventListener('resize', function() {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(function() {
                    try {
                        render.options.width = container.offsetWidth;
                        render.options.height = container.offsetHeight;
                        render.canvas.width = container.offsetWidth;
                        render.canvas.height = container.offsetHeight;
                        Body.setPosition(walls[0], {
                            x: container.offsetWidth / 2,
                            y: container.offsetHeight + 50
                        });
                        Body.setPosition(walls[1], {
                            x: -50,
                            y: container.offsetHeight / 2
                        });
                        Body.setPosition(walls[2], {
                            x: container.offsetWidth + 50,
                            y: container.offsetHeight / 2
                        });
                        Render.setPixelRatio(render, pixelRatio);
                        if (mouse) {
                            mouse.pixelRatio = pixelRatio;
                        }
                        container.style.cursor = isTouchDevice ? 'default' : container.style.cursor;
                    } catch (error) {
                        console.error('Error during resize', error);
                    }
                }, 250);
            });
        }, 100);
    } catch (error) {
        console.error('Error initializing physics', error);
    }
});
