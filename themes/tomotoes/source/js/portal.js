(function() {
    const body = document.body
    if (!body || !body.classList.contains('portal-page')) {
        return
    }

    const enterTriggers = document.querySelectorAll('[data-enter-portal]')
    const card = document.getElementById('card')
    const mainScreen = document.getElementById('portal-screen')
    const subtitle = document.querySelector('.content-subtitle[data-text]')
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let entered = false
    let touchStartX = 0
    let touchStartY = 0

    function revealIntro() {
        window.requestAnimationFrame(function() {
            body.classList.add('portal-ready')
        })
    }

    function initSubtitle() {
        if (!subtitle) {
            return
        }

        const text = (subtitle.getAttribute('data-text') || '').trim()
        if (!text) {
            subtitle.innerHTML = '&nbsp;'
            return
        }

        if (prefersReducedMotion) {
            subtitle.textContent = text
            return
        }

        function escapeCharacter(character) {
            if (character === '&') {
                return '&amp;'
            }
            if (character === '<') {
                return '&lt;'
            }
            if (character === '>') {
                return '&gt;'
            }
            if (character === '"') {
                return '&quot;'
            }
            return character
        }

        subtitle.innerHTML = text
            .split('')
            .map(function(character, index) {
                const content = character === ' ' ? '&nbsp;' : escapeCharacter(character)
                return '<span style="animation-delay:' + (index * 0.05) + 's">' + content + '</span>'
            })
            .join('')
    }

    function focusCard() {
        if (!card) {
            return
        }

        card.setAttribute('tabindex', '-1')
        try {
            card.focus({ preventScroll: true })
        } catch (error) {
            card.focus()
        }
    }

    function enterPortal() {
        if (entered) {
            return
        }

        entered = true
        body.classList.add('portal-entered')

        if (mainScreen) {
            mainScreen.scrollTop = 0
        }
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0

        window.setTimeout(focusCard, prefersReducedMotion ? 0 : 900)
    }

    function initEntryActions() {
        enterTriggers.forEach(function(trigger) {
            trigger.addEventListener('click', function(event) {
                event.preventDefault()
                enterPortal()
            })
        })

        document.addEventListener('wheel', function(event) {
            if (entered) {
                return
            }

            event.preventDefault()
            if (event.deltaY > 10) {
                enterPortal()
            }
        }, { passive: false })

        document.addEventListener('keydown', function(event) {
            if (entered) {
                return
            }

            const shouldEnter =
                event.key === 'ArrowDown' ||
                event.key === 'PageDown' ||
                event.key === 'Enter' ||
                event.code === 'Space'

            if (shouldEnter) {
                event.preventDefault()
                enterPortal()
            }
        })

        document.addEventListener('touchstart', function(event) {
            if (!event.changedTouches.length) {
                return
            }

            touchStartX = event.changedTouches[0].clientX
            touchStartY = event.changedTouches[0].clientY
        }, { passive: true })

        document.addEventListener('touchend', function(event) {
            if (entered || !event.changedTouches.length) {
                return
            }

            const touch = event.changedTouches[0]
            const deltaY = touchStartY - touch.clientY
            const deltaX = Math.abs(touch.clientX - touchStartX)
            if (deltaY > 40 && deltaX < 90) {
                enterPortal()
            }
        }, { passive: true })
    }

    function initFluidBackground() {
        if (!document.getElementById('fluid-canvas')) {
            return
        }

        if (!('WebGLRenderingContext' in window)) {
            body.classList.add('portal-no-fluid')
            return
        }

        if (document.querySelector('script[data-fluid-script="true"]')) {
            return
        }

        const script = document.createElement('script')
        script.src = '/fluid/fluid.js'
        script.async = false
        script.setAttribute('data-fluid-script', 'true')
        document.body.appendChild(script)
    }

    function initEntryGrid() {
        const canvas = document.getElementById('gridCanvas')
        if (!canvas) {
            return
        }

        const context = canvas.getContext('2d')
        let width = 0
        let height = 0
        let offset = 0
        let animationFrame = 0
        let dots = []

        function resize() {
            const ratio = Math.min(window.devicePixelRatio || 1, 2)
            width = canvas.clientWidth
            height = canvas.clientHeight
            canvas.width = Math.round(width * ratio)
            canvas.height = Math.round(height * ratio)
            context.setTransform(ratio, 0, 0, ratio, 0, 0)

            const dotCount = Math.max(Math.round(width / 95), 8)
            dots = Array.from({ length: dotCount }, function(_, index) {
                return {
                    x: (index + 1) * (width / (dotCount + 1)),
                    y: Math.random() * height,
                    radius: 1 + Math.random() * 1.4,
                    speed: 0.18 + Math.random() * 0.22
                }
            })
        }

        function draw() {
            const gap = window.innerWidth < 720 ? 50 : 62
            offset = (offset + 0.24) % gap
            context.clearRect(0, 0, width, height)

            context.strokeStyle = 'rgba(255, 255, 255, 0.08)'
            context.lineWidth = 1

            for (let x = -gap; x < width + gap; x += gap) {
                context.beginPath()
                context.moveTo(x + offset, 0)
                context.lineTo(x + offset, height)
                context.stroke()
            }

            for (let y = -gap; y < height + gap; y += gap) {
                context.beginPath()
                context.moveTo(0, y + offset * 0.48)
                context.lineTo(width, y + offset * 0.48)
                context.stroke()
            }

            dots.forEach(function(dot) {
                dot.y -= dot.speed
                if (dot.y < -12) {
                    dot.y = height + 12
                }

                context.beginPath()
                context.fillStyle = 'rgba(255, 255, 255, 0.52)'
                context.shadowBlur = 16
                context.shadowColor = 'rgba(255, 255, 255, 0.12)'
                context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2)
                context.fill()
            })

            context.shadowBlur = 0
        }

        function animate() {
            draw()
            animationFrame = window.requestAnimationFrame(animate)
        }

        resize()
        draw()

        if (!prefersReducedMotion) {
            animate()
        }

        window.addEventListener('resize', resize)
        window.addEventListener('beforeunload', function() {
            if (animationFrame) {
                window.cancelAnimationFrame(animationFrame)
            }
        })
    }

    if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual'
    }

    initSubtitle()
    initEntryActions()
    initFluidBackground()
    initEntryGrid()
    revealIntro()
}())
