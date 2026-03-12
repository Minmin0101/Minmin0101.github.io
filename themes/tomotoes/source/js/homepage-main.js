(function () {
    var hiddenProperty = "hidden" in document
        ? "hidden"
        : "webkitHidden" in document
            ? "webkitHidden"
            : "mozHidden" in document
                ? "mozHidden"
                : null;
    var visibilityChangeEvent = hiddenProperty
        ? hiddenProperty.replace(/hidden/i, "visibilitychange")
        : "visibilitychange";
    var isPhone = /Mobile|Android|iOS|iPhone|iPad|iPod|Windows Phone|KFAPWI/i.test(navigator.userAgent);
    var portalState = {
        particleField: null,
        introBound: false,
        touchStartX: 0,
        touchStartY: 0
    };

    function $(selector) {
        return window.$ ? window.$(selector) : document.querySelector(selector);
    }

    function renderTextSpans(element, text) {
        var fragment;

        if (!element || element.dataset.rendered === "true") {
            return;
        }

        fragment = document.createDocumentFragment();
        Array.from(text || "").forEach(function (character, index) {
            var span = document.createElement("span");

            if (character === " ") {
                span.innerHTML = "&nbsp;";
            } else {
                span.textContent = character;
            }

            span.style.animationDelay = (index * 0.04).toFixed(2) + "s";
            fragment.appendChild(span);
        });

        element.textContent = "";
        element.appendChild(fragment);
        element.dataset.rendered = "true";
    }

    function initIntroEvents() {
        var enterEl = $(".enter");
        var arrowEls = Array.prototype.slice.call(document.querySelectorAll(".arrow"));

        if (portalState.introBound) {
            return;
        }

        function handleWheel(event) {
            if ((event.deltaY || -1 * event.wheelDelta || event.detail) > 0) {
                loadAll();
            }
        }

        function handleKeydown(event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                loadAll();
            }
        }

        function handleTouchStart(event) {
            var touch = event.touches[0];
            portalState.touchStartX = touch.pageX;
            portalState.touchStartY = touch.pageY;
        }

        function handleTouchEnd(event) {
            var touch = event.changedTouches[0];
            var deltaX = touch.pageX - portalState.touchStartX;
            var deltaY = touch.pageY - portalState.touchStartY;

            if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -36) {
                loadAll();
            }
        }

        if (enterEl) {
            enterEl.addEventListener("click", loadAll);
            enterEl.addEventListener("keydown", handleKeydown);
        }

        arrowEls.forEach(function (arrowEl) {
            arrowEl.addEventListener("click", loadAll);
            arrowEl.addEventListener("mouseenter", loadAll);
            arrowEl.addEventListener("touchstart", loadAll, { passive: true });
        });

        window.addEventListener("wheel", handleWheel, { passive: true });
        window.addEventListener("mousewheel", handleWheel, { passive: true });
        window.addEventListener("DOMMouseScroll", handleWheel, { passive: true });

        if (isPhone) {
            document.addEventListener("touchstart", handleTouchStart, { passive: true });
            document.addEventListener("touchend", handleTouchEnd, { passive: true });
        }

        portalState.introBound = true;
    }

    function ParticleField(canvas) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext("2d") : null;
        this.width = 0;
        this.height = 0;
        this.dpr = 1;
        this.animationFrame = null;
        this.particles = [];
        this.pointer = {
            active: false,
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0
        };
        this.handleResize = this.resize.bind(this);
        this.handlePointerMove = this.onPointerMove.bind(this);
        this.handlePointerLeave = this.onPointerLeave.bind(this);
        this.handleTouchMove = this.onTouchMove.bind(this);
        this.handleTouchLeave = this.onTouchLeave.bind(this);
        this.handleVisibilityChange = this.onVisibilityChange.bind(this);
    }

    ParticleField.prototype.init = function () {
        if (!this.canvas || !this.ctx) {
            return;
        }

        this.resize();
        this.bindEvents();
        this.start();
    };

    ParticleField.prototype.bindEvents = function () {
        window.addEventListener("resize", this.handleResize);
        window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
        window.addEventListener("pointerdown", this.handlePointerMove, { passive: true });
        window.addEventListener("mouseout", this.handlePointerLeave, { passive: true });
        window.addEventListener("blur", this.handlePointerLeave);
        window.addEventListener("touchstart", this.handleTouchMove, { passive: true });
        window.addEventListener("touchmove", this.handleTouchMove, { passive: true });
        window.addEventListener("touchend", this.handleTouchLeave, { passive: true });
        document.addEventListener(visibilityChangeEvent, this.handleVisibilityChange);
    };

    ParticleField.prototype.resize = function () {
        var rect = this.canvas.getBoundingClientRect();
        var count;

        this.width = rect.width || window.innerWidth;
        this.height = rect.height || window.innerHeight;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        this.canvas.width = Math.round(this.width * this.dpr);
        this.canvas.height = Math.round(this.height * this.dpr);
        this.canvas.style.width = this.width + "px";
        this.canvas.style.height = this.height + "px";
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        this.pointer.x = this.width / 2;
        this.pointer.y = this.height / 2;
        this.pointer.targetX = this.width / 2;
        this.pointer.targetY = this.height / 2;

        count = this.getParticleCount();
        this.particles = this.createParticles(count);
    };

    ParticleField.prototype.getParticleCount = function () {
        var area = this.width * this.height;
        var count = Math.round(area / (isPhone ? 21000 : 15000));

        if (isPhone) {
            return Math.max(28, Math.min(count, 52));
        }

        return Math.max(60, Math.min(count, 104));
    };

    ParticleField.prototype.createParticles = function (count) {
        var particles = [];
        var index;

        for (index = 0; index < count; index += 1) {
            particles.push(this.createParticle());
        }

        return particles;
    };

    ParticleField.prototype.createParticle = function () {
        var angle = Math.random() * Math.PI * 2;
        var speed = isPhone ? 0.16 + Math.random() * 0.28 : 0.18 + Math.random() * 0.38;

        return {
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            offsetX: 0,
            offsetY: 0,
            size: isPhone ? 1.15 + Math.random() * 1.35 : 1.25 + Math.random() * 1.75,
            alpha: 0.22 + Math.random() * 0.48,
            depth: 0.55 + Math.random() * 1.15,
            pull: 0.8 + Math.random() * 1.3
        };
    };

    ParticleField.prototype.getLocalPoint = function (clientX, clientY) {
        var rect = this.canvas.getBoundingClientRect();

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    ParticleField.prototype.onPointerMove = function (event) {
        var point = this.getLocalPoint(event.clientX, event.clientY);

        if (!this.pointer.active) {
            this.pointer.x = point.x;
            this.pointer.y = point.y;
        }

        this.pointer.active = true;
        this.pointer.targetX = point.x;
        this.pointer.targetY = point.y;
    };

    ParticleField.prototype.onPointerLeave = function (event) {
        if (event && (event.relatedTarget || event.toElement)) {
            return;
        }

        this.pointer.active = false;
    };

    ParticleField.prototype.onTouchMove = function (event) {
        var touch = event.touches[0];
        var point;

        if (!touch) {
            return;
        }

        point = this.getLocalPoint(touch.clientX, touch.clientY);
        if (!this.pointer.active) {
            this.pointer.x = point.x;
            this.pointer.y = point.y;
        }
        this.pointer.active = true;
        this.pointer.targetX = point.x;
        this.pointer.targetY = point.y;
    };

    ParticleField.prototype.onTouchLeave = function () {
        this.pointer.active = false;
    };

    ParticleField.prototype.onVisibilityChange = function () {
        if (hiddenProperty && document[hiddenProperty]) {
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
            return;
        }

        this.start();
    };

    ParticleField.prototype.start = function () {
        var self = this;

        if (!this.ctx || this.animationFrame) {
            return;
        }

        function frame() {
            self.render();
            self.animationFrame = requestAnimationFrame(frame);
        }

        this.animationFrame = requestAnimationFrame(frame);
    };

    ParticleField.prototype.drawPointerGlow = function () {
        var radius = isPhone ? 120 : 180;
        var gradient = this.ctx.createRadialGradient(
            this.pointer.x,
            this.pointer.y,
            0,
            this.pointer.x,
            this.pointer.y,
            radius
        );

        gradient.addColorStop(0, "rgba(154, 214, 255, 0.12)");
        gradient.addColorStop(0.34, "rgba(98, 170, 255, 0.05)");
        gradient.addColorStop(1, "rgba(98, 170, 255, 0)");
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    };

    ParticleField.prototype.render = function () {
        var centerX = this.width / 2;
        var centerY = this.height / 2;
        var pointerX = this.pointer.active ? this.pointer.targetX : centerX;
        var pointerY = this.pointer.active ? this.pointer.targetY : centerY;
        var lineDistance = isPhone ? 114 : 140;
        var lineDistanceSq = lineDistance * lineDistance;
        var influenceRadius = isPhone ? 150 : 228;
        var influenceRadiusSq = influenceRadius * influenceRadius;
        var pointerLink = isPhone ? 118 : 150;
        var pointerLinkSq = pointerLink * pointerLink;
        var parallaxX;
        var parallaxY;
        var positions = [];
        var i;
        var j;
        var pointerEase = this.pointer.active ? (isPhone ? 0.28 : 0.4) : 0.12;

        this.pointer.x += (pointerX - this.pointer.x) * pointerEase;
        this.pointer.y += (pointerY - this.pointer.y) * pointerEase;

        parallaxX = ((this.pointer.x - centerX) / Math.max(this.width, 1)) * 44;
        parallaxY = ((this.pointer.y - centerY) / Math.max(this.height, 1)) * 44;

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawPointerGlow();

        for (i = 0; i < this.particles.length; i += 1) {
            var particle = this.particles[i];
            var dx = this.pointer.x - particle.x;
            var dy = this.pointer.y - particle.y;
            var distanceSq = dx * dx + dy * dy;
            var distance = Math.sqrt(distanceSq) || 1;
            var targetOffsetX = 0;
            var targetOffsetY = 0;
            var drawX;
            var drawY;

            if (distanceSq < influenceRadiusSq) {
                var influence = (1 - distance / influenceRadius) * (isPhone ? 22 : 32) * particle.pull;
                targetOffsetX = (dx / distance) * influence;
                targetOffsetY = (dy / distance) * influence;
            }

            particle.offsetX += (targetOffsetX - particle.offsetX) * (isPhone ? 0.22 : 0.34);
            particle.offsetY += (targetOffsetY - particle.offsetY) * (isPhone ? 0.22 : 0.34);
            particle.x += particle.vx;
            particle.y += particle.vy;

            if (particle.x < -24) {
                particle.x = this.width + 24;
            } else if (particle.x > this.width + 24) {
                particle.x = -24;
            }

            if (particle.y < -24) {
                particle.y = this.height + 24;
            } else if (particle.y > this.height + 24) {
                particle.y = -24;
            }

            drawX = particle.x + particle.offsetX + parallaxX * particle.depth;
            drawY = particle.y + particle.offsetY + parallaxY * particle.depth;

            positions.push({
                x: drawX,
                y: drawY,
                alpha: particle.alpha,
                size: particle.size
            });

            this.ctx.beginPath();
            this.ctx.fillStyle = "rgba(226, 241, 255, " + particle.alpha.toFixed(2) + ")";
            this.ctx.shadowBlur = 14;
            this.ctx.shadowColor = "rgba(144, 210, 255, 0.22)";
            this.ctx.arc(drawX, drawY, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.shadowBlur = 0;

        for (i = 0; i < positions.length; i += 1) {
            for (j = i + 1; j < positions.length; j += 1) {
                var first = positions[i];
                var second = positions[j];
                var lineDx = first.x - second.x;
                var lineDy = first.y - second.y;
                var lineSq = lineDx * lineDx + lineDy * lineDy;

                if (lineSq >= lineDistanceSq) {
                    continue;
                }

                this.ctx.beginPath();
                this.ctx.strokeStyle = "rgba(136, 198, 255, " + ((1 - lineSq / lineDistanceSq) * 0.24).toFixed(3) + ")";
                this.ctx.lineWidth = 1;
                this.ctx.moveTo(first.x, first.y);
                this.ctx.lineTo(second.x, second.y);
                this.ctx.stroke();
            }

            if (this.pointer.active) {
                var pointerDx = positions[i].x - this.pointer.x;
                var pointerDy = positions[i].y - this.pointer.y;
                var pointerSq = pointerDx * pointerDx + pointerDy * pointerDy;

                if (pointerSq < pointerLinkSq) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = "rgba(255, 255, 255, " + ((1 - pointerSq / pointerLinkSq) * 0.18).toFixed(3) + ")";
                    this.ctx.lineWidth = 1;
                    this.ctx.moveTo(positions[i].x, positions[i].y);
                    this.ctx.lineTo(this.pointer.x, this.pointer.y);
                    this.ctx.stroke();
                }
            }
        }
    };

    function animatePortalLinks() {
        var items = Array.prototype.slice.call(document.querySelectorAll("#card .nav-item"));

        if (!items.length) {
            return;
        }

        items.forEach(function (item) {
            item.style.opacity = "0";
            item.style.transform = "translateY(20px)";
        });

        if (!window.anime) {
            items.forEach(function (item) {
                item.style.opacity = "1";
                item.style.transform = "translateY(0)";
            });
            return;
        }

        window.anime({
            targets: items,
            opacity: [0, 1],
            translateY: [20, 0],
            delay: window.anime.stagger(70, { start: 180 }),
            duration: 700,
            easing: "easeOutExpo"
        });
    }

    function loadIntro() {
        if ((hiddenProperty && document[hiddenProperty]) || loadIntro.loaded) {
            return;
        }

        requestAnimationFrame(function () {
            var wrap = $(".wrap");
            var subtitleEl = $(".content-subtitle");

            if (wrap) {
                wrap.classList.add("in");
            }

            setTimeout(function () {
                renderTextSpans(subtitleEl, window.subtitle || "");
            }, 260);
        });

        loadIntro.loaded = true;
    }

    function removeIntroCanvas() {
        if (window.animationID) {
            cancelAnimationFrame(window.animationID);
            window.animationID = null;
        }

        if (window.canvas && window.canvas.parentElement) {
            window.canvas.parentElement.removeChild(window.canvas);
            window.canvas = null;
        }
    }

    function switchPage() {
        var intro = $(".content-intro");
        var shape = $("svg.shape");
        var path = $(".shape-wrap path");

        if (switchPage.switched) {
            return;
        }

        document.body.classList.add("portal-entered");

        if (!intro || !shape || !path || !window.anime) {
            if (intro) {
                intro.style.transform = "translateY(-200vh)";
            }
            removeIntroCanvas();
            switchPage.switched = true;
            return;
        }

        intro.style.pointerEvents = "none";
        shape.style.transformOrigin = "50% 0%";

        window.anime({
            targets: intro,
            duration: 1100,
            easing: "easeInOutSine",
            translateY: "-200vh"
        });

        window.anime({
            targets: shape,
            scaleY: [
                { value: [0.82, 1.8], duration: 550, easing: "easeInQuad" },
                { value: 1, duration: 550, easing: "easeOutQuad" }
            ]
        });

        window.anime({
            targets: path,
            duration: 1100,
            easing: "easeOutQuad",
            d: path.getAttribute("pathdata:id"),
            complete: removeIntroCanvas
        });

        switchPage.switched = true;
    }

    function loadMain() {
        var cardInner = $(".card-inner");
        var particleCanvas = document.getElementById("particleCanvas");

        if (loadMain.loaded) {
            return;
        }

        setTimeout(function () {
            if (cardInner) {
                cardInner.classList.add("in");
            }

            animatePortalLinks();

            if (particleCanvas && !portalState.particleField) {
                portalState.particleField = new ParticleField(particleCanvas);
                portalState.particleField.init();
            }
        }, 360);

        loadMain.loaded = true;
    }

    function loadAll() {
        if (loadAll.loaded) {
            return;
        }

        switchPage();
        loadMain();
        loadAll.loaded = true;
    }

    function initPortal() {
        if (initPortal.loaded) {
            return;
        }

        initIntroEvents();
        loadIntro();
        initPortal.loaded = true;
    }

    window.hiddenProperty = hiddenProperty;
    window.visibilityChangeEvent = visibilityChangeEvent;
    window.isPhone = isPhone;
    window.loadIntro = loadIntro;
    window.switchPage = switchPage;
    window.loadMain = loadMain;
    window.loadAll = loadAll;

    document.addEventListener(visibilityChangeEvent, loadIntro);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPortal);
    } else {
        initPortal();
    }
}());
