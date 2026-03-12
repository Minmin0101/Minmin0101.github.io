// 美观版WebGL流体动态背景（恢复原版效果，修正加载问题，优化移动端适配）
const canvas = document.getElementById('fluid-canvas');
// 移动端WebGL适配，兼容不同设备，开启抗锯齿且优化性能
const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });

// 若不支持WebGL，给出提示（避免纯黑，适配移动端提示样式）
if (!gl) {
    alert('浏览器不支持WebGL，无法显示流体背景，建议更换Chrome/Edge浏览器（移动端请更新浏览器版本）');
    canvas.style.background = '#0a0a0a';
    throw new Error('WebGL not supported');
}

// 流体核心参数（调至柔和美观，不刺眼，适配移动端性能）
const SIM_RESOLUTION = 100; // 移动端降低分辨率，提升流畅度
const DYE_RESOLUTION = 768; // 适配移动端屏幕，避免过度渲染
const DENSITY_DISSIPATION = 0.98;
const VELOCITY_DISSIPATION = 0.99;
const PRESSURE = 0.8;
const PRESSURE_ITERATIONS = 15; // 移动端减少迭代次数，降低性能消耗
const CURL = 25;
const SPLAT_RADIUS = 0.15; // 移动端缩小粒子半径，贴合小屏幕
const SPLAT_FORCE = 4000; // 降低触摸力度，适配移动端触摸灵敏度
const COLORFUL = true;
const COLOR_UPDATE_SPEED = 8;
const PAUSED = false;
const BACK_COLOR = { r: 16, g: 16, b: 16 }; // 柔和黑色背景，贴合整体风格

// 工具函数
function wrapValue(n, max) {
    let r = n % max;
    return r < 0 ? r + max : r;
}
function random(n) { return Math.random() * n; }
function randomColor() { return { r: Math.random() * 0.8, g: Math.random() * 0.8, b: Math.random() * 0.8 }; } // 低饱和柔和色

// Shader创建工具
function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader编译错误：', gl.getShaderInfoLog(shader));
    }
    return shader;
}
function createProgram(vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program链接错误：', gl.getProgramInfoLog(program));
    }
    return program;
}

// 纹理和帧缓冲创建
function createTexture(type, internalFormat, width, height, format, dataType, data) {
    const texture = gl.createTexture();
    gl.bindTexture(type, texture);
    gl.texParameteri(type, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(type, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(type, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(type, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(type, 0, internalFormat, width, height, 0, format, dataType, data);
    return texture;
}
function createFramebuffer(texture) {
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return framebuffer;
}

// 顶点着色器（通用）
const vertexShaderSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;
const clearShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);

// 各个片段着色器（核心流体效果，适配移动端渲染）
const copyShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D u_texture;
    varying vec2 v_uv;
    void main() {
        gl_FragColor = texture2D(u_texture, v_uv);
    }
`);
const copyProgram = createProgram(clearShader, copyShader);

const displayShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform vec2 u_texelSize;
    uniform float u_curl;
    uniform float u_time;
    varying vec2 v_uv;

    void main() {
        vec2 texel = u_texelSize;
        vec3 c = texture2D(u_texture, v_uv).rgb;

        float x = u_texelSize.x;
        float y = u_texelSize.y;

        float n = texture2D(u_texture, v_uv + vec2(0.0, y)).r;
        float s = texture2D(u_texture, v_uv - vec2(0.0, y)).r;
        float e = texture2D(u_texture, v_uv + vec2(x, 0.0)).r;
        float w = texture2D(u_texture, v_uv - vec2(x, 0.0)).r;

        float curl = (e - w) * 0.5 - (n - s) * 0.5;
        curl = u_curl * curl;

        gl_FragColor = vec4(c.rgb, 1.0);
    }
`);
const displayProgram = createProgram(clearShader, displayShader);

const splatShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D u_target;
    uniform vec2 u_point;
    uniform vec3 u_color;
    uniform float u_radius;
    uniform float u_aspectRatio;
    varying vec2 v_uv;

    void main() {
        vec2 diff = v_uv - u_point;
        diff.x *= u_aspectRatio;
        float dist = length(diff);
        float factor = 1.0 - smoothstep(u_radius * 0.5, u_radius, dist);
        vec3 base = texture2D(u_target, v_uv).rgb;
        gl_FragColor = vec4(base + u_color * factor, 1.0);
    }
`);
const splatProgram = createProgram(clearShader, splatShader);

const advectionShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D u_velocity;
    uniform sampler2D u_source;
    uniform vec2 u_texelSize;
    uniform float u_dt;
    uniform float u_dissipation;
    varying vec2 v_uv;

    void main() {
        vec2 velocity = texture2D(u_velocity, v_uv).xy;
        vec2 st = v_uv - u_dt * u_texelSize * velocity;
        vec4 x = texture2D(u_source, st);
        gl_FragColor = x * u_dissipation;
    }
`);
const advectionProgram = createProgram(clearShader, advectionShader);

const divergenceShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D u_velocity;
    uniform vec2 u_texelSize;
    varying vec2 v_uv;

    void main() {
        float L = texture2D(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).x;
        float R = texture2D(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).x;
        float B = texture2D(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).y;
        float T = texture2D(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).y;
        float divergence = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
    }
`);
const divergenceProgram = createProgram(clearShader, divergenceShader);

const pressureShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D u_pressure;
    uniform sampler2D u_divergence;
    uniform vec2 u_texelSize;
    varying vec2 v_uv;

    void main() {
        float L = texture2D(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
        float R = texture2D(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
        float B = texture2D(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
        float T = texture2D(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;
        float C = texture2D(u_pressure, v_uv).x;
        float D = texture2D(u_divergence, v_uv).x;
        float pressure = (L + R + B + T + D) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
`);
const pressureProgram = createProgram(clearShader, pressureShader);

const gradientSubtractShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D u_pressure;
    uniform sampler2D u_velocity;
    uniform vec2 u_texelSize;
    varying vec2 v_uv;

    void main() {
        float L = texture2D(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
        float R = texture2D(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
        float B = texture2D(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
        float T = texture2D(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;
        vec2 velocity = texture2D(u_velocity, v_uv).xy;
        velocity -= 0.5 * vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`);
const gradientSubtractProgram = createProgram(clearShader, gradientSubtractShader);

const curlShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D u_velocity;
    uniform vec2 u_texelSize;
    varying vec2 v_uv;

    void main() {
        float L = texture2D(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).y;
        float R = texture2D(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).y;
        float B = texture2D(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).x;
        float T = texture2D(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).x;
        float curl = (R - L - T + B) * 0.5;
        gl_FragColor = vec4(curl, 0.0, 0.0, 1.0);
    }
`);
const curlProgram = createProgram(clearShader, curlShader);

const vorticityShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D u_velocity;
    uniform sampler2D u_curl;
    uniform vec2 u_texelSize;
    uniform float u_curlStrength;
    varying vec2 v_uv;

    void main() {
        float L = texture2D(u_curl, v_uv - vec2(u_texelSize.x, 0.0)).x;
        float R = texture2D(u_curl, v_uv + vec2(u_texelSize.x, 0.0)).x;
        float B = texture2D(u_curl, v_uv - vec2(0.0, u_texelSize.y)).x;
        float T = texture2D(u_curl, v_uv + vec2(0.0, u_texelSize.y)).x;
        float C = texture2D(u_curl, v_uv).x;

        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= u_curlStrength * C;

        vec2 velocity = texture2D(u_velocity, v_uv).xy;
        velocity += force;
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`);
const vorticityProgram = createProgram(clearShader, vorticityShader);

// 顶点数据
const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

// 创建纹理和帧缓冲
const velocityTexture = createTexture(gl.TEXTURE_2D, gl.RGBA, SIM_RESOLUTION, SIM_RESOLUTION, gl.RGBA, gl.HALF_FLOAT, null);
const velocityFramebuffer = createFramebuffer(velocityTexture);
const velocityDyeTexture = createTexture(gl.TEXTURE_2D, gl.RGBA, SIM_RESOLUTION, SIM_RESOLUTION, gl.RGBA, gl.HALF_FLOAT, null);
const velocityDyeFramebuffer = createFramebuffer(velocityDyeTexture);
const divergenceTexture = createTexture(gl.TEXTURE_2D, gl.RGBA, SIM_RESOLUTION, SIM_RESOLUTION, gl.RGBA, gl.HALF_FLOAT, null);
const divergenceFramebuffer = createFramebuffer(divergenceTexture);
const curlTexture = createTexture(gl.TEXTURE_2D, gl.RGBA, SIM_RESOLUTION, SIM_RESOLUTION, gl.RGBA, gl.HALF_FLOAT, null);
const curlFramebuffer = createFramebuffer(curlTexture);
const pressureTexture = createTexture(gl.TEXTURE_2D, gl.RGBA, SIM_RESOLUTION, SIM_RESOLUTION, gl.RGBA, gl.HALF_FLOAT, null);
const pressureFramebuffer = createFramebuffer(pressureTexture);
const pressureDyeTexture = createTexture(gl.TEXTURE_2D, gl.RGBA, SIM_RESOLUTION, SIM_RESOLUTION, gl.RGBA, gl.HALF_FLOAT, null);
const pressureDyeFramebuffer = createFramebuffer(pressureDyeTexture);
const dyeTexture = createTexture(gl.TEXTURE_2D, gl.RGBA, DYE_RESOLUTION, DYE_RESOLUTION, gl.RGBA, gl.HALF_FLOAT, null);
const dyeFramebuffer = createFramebuffer(dyeTexture);
const dyeDyeTexture = createTexture(gl.TEXTURE_2D, gl.RGBA, DYE_RESOLUTION, DYE_RESOLUTION, gl.RGBA, gl.HALF_FLOAT, null);
const dyeDyeFramebuffer = createFramebuffer(dyeDyeTexture);

// 渲染工具函数
function render(program, target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
function copy(target, texture) {
    gl.useProgram(copyProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(copyProgram, 'a_position'));
    gl.vertexAttribPointer(gl.getAttribLocation(copyProgram, 'a_position'), 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(copyProgram, 'u_texture'), 0);
    render(copyProgram, target);
}
function clear(target, color) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.clearColor(color.r / 255, color.g / 255, color.b / 255, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}
function splat(target, point, color, radius) {
    gl.useProgram(splatProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(splatProgram, 'a_position'));
    gl.vertexAttribPointer(gl.getAttribLocation(splatProgram, 'a_position'), 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.uniform1i(gl.getUniformLocation(splatProgram, 'u_target'), 0);
    gl.uniform2f(gl.getUniformLocation(splatProgram, 'u_point'), point.x, point.y);
    gl.uniform3f(gl.getUniformLocation(splatProgram, 'u_color'), color.r, color.g, color.b);
    gl.uniform1f(gl.getUniformLocation(splatProgram, 'u_radius'), radius);
    gl.uniform1f(gl.getUniformLocation(splatProgram, 'u_aspectRatio'), canvas.width / canvas.height);
    render(splatProgram, target === velocityFramebuffer ? velocityDyeFramebuffer : dyeDyeFramebuffer);
    copy(target, target === velocityFramebuffer ? velocityDyeTexture : dyeDyeTexture);
}
function advect(target, source, dissipation, dt) {
    gl.useProgram(advectionProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(advectionProgram, 'a_position'));
    gl.vertexAttribPointer(gl.getAttribLocation(advectionProgram, 'a_position'), 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocityTexture);
    gl.uniform1i(gl.getUniformLocation(advectionProgram, 'u_velocity'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(gl.getUniformLocation(advectionProgram, 'u_source'), 1);
    gl.uniform2f(gl.getUniformLocation(advectionProgram, 'u_texelSize'), 1.0 / SIM_RESOLUTION, 1.0 / SIM_RESOLUTION);
    gl.uniform1f(gl.getUniformLocation(advectionProgram, 'u_dt'), dt);
    gl.uniform1f(gl.getUniformLocation(advectionProgram, 'u_dissipation'), dissipation);
    render(advectionProgram, target === velocityFramebuffer ? velocityDyeFramebuffer : dyeDyeFramebuffer);
    copy(target, target === velocityFramebuffer ? velocityDyeTexture : dyeDyeTexture);
}
function computeDivergence() {
    gl.useProgram(divergenceProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(divergenceProgram, 'a_position'));
    gl.vertexAttribPointer(gl.getAttribLocation(divergenceProgram, 'a_position'), 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocityTexture);
    gl.uniform1i(gl.getUniformLocation(divergenceProgram, 'u_velocity'), 0);
    gl.uniform2f(gl.getUniformLocation(divergenceProgram, 'u_texelSize'), 1.0 / SIM_RESOLUTION, 1.0 / SIM_RESOLUTION);
    render(divergenceProgram, divergenceFramebuffer);
}
function computeCurl() {
    gl.useProgram(curlProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(curlProgram, 'a_position'));
    gl.vertexAttribPointer(gl.getAttribLocation(curlProgram, 'a_position'), 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocityTexture);
    gl.uniform1i(gl.getUniformLocation(curlProgram, 'u_velocity'), 0);
    gl.uniform2f(gl.getUniformLocation(curlProgram, 'u_texelSize'), 1.0 / SIM_RESOLUTION, 1.0 / SIM_RESOLUTION);
    render(curlProgram, curlFramebuffer);
}
function computeVorticity() {
    gl.useProgram(vorticityProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(vorticityProgram, 'a_position'));
    gl.vertexAttribPointer(gl.getAttribLocation(vorticityProgram, 'a_position'), 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocityTexture);
    gl.uniform1i(gl.getUniformLocation(vorticityProgram, 'u_velocity'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, curlTexture);
    gl.uniform1i(gl.getUniformLocation(vorticityProgram, 'u_curl'), 1);
    gl.uniform2f(gl.getUniformLocation(vorticityProgram, 'u_texelSize'), 1.0 / SIM_RESOLUTION, 1.0 / SIM_RESOLUTION);
    gl.uniform1f(gl.getUniformLocation(vorticityProgram, 'u_curlStrength'), CURL);
    render(vorticityProgram, velocityDyeFramebuffer);
    copy(velocityFramebuffer, velocityDyeTexture);
}
function computePressure() {
    gl.useProgram(pressureProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(pressureProgram, 'a_position'));
    gl.vertexAttribPointer(gl.getAttribLocation(pressureProgram, 'a_position'), 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pressureTexture);
    gl.uniform1i(gl.getUniformLocation(pressureProgram, 'u_pressure'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, divergenceTexture);
    gl.uniform1i(gl.getUniformLocation(pressureProgram, 'u_divergence'), 1);
    gl.uniform2f(gl.getUniformLocation(pressureProgram, 'u_texelSize'), 1.0 / SIM_RESOLUTION, 1.0 / SIM_RESOLUTION);
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
        render(pressureProgram, pressureDyeFramebuffer);
        copy(pressureFramebuffer, pressureDyeTexture);
    }
}
function subtractGradient() {
    gl.useProgram(gradientSubtractProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(gradientSubtractProgram, 'a_position'));
    gl.vertexAttribPointer(gl.getAttribLocation(gradientSubtractProgram, 'a_position'), 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pressureTexture);
    gl.uniform1i(gl.getUniformLocation(gradientSubtractProgram, 'u_pressure'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, velocityTexture);
    gl.uniform1i(gl.getUniformLocation(gradientSubtractProgram, 'u_velocity'), 1);
    gl.uniform2f(gl.getUniformLocation(gradientSubtractProgram, 'u_texelSize'), 1.0 / SIM_RESOLUTION, 1.0 / SIM_RESOLUTION);
    render(gradientSubtractProgram, velocityDyeFramebuffer);
    copy(velocityFramebuffer, velocityDyeTexture);
}
function display() {
    gl.useProgram(displayProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(displayProgram, 'a_position'));
    gl.vertexAttribPointer(gl.getAttribLocation(displayProgram, 'a_position'), 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dyeTexture);
    gl.uniform1i(gl.getUniformLocation(displayProgram, 'u_texture'), 0);
    gl.uniform2f(gl.getUniformLocation(displayProgram, 'u_texelSize'), 1.0 / DYE_RESOLUTION, 1.0 / DYE_RESOLUTION);
    gl.uniform1f(gl.getUniformLocation(displayProgram, 'u_curl'), CURL);
    gl.uniform1f(gl.getUniformLocation(displayProgram, 'u_time'), Date.now() / 1000);
    render(displayProgram, null);
}

// 流体更新步骤
function step(dt) {
    if (!PAUSED) {
        computeCurl();
        computeVorticity();
        computeDivergence();
        computePressure();
        subtractGradient();
        advect(velocityFramebuffer, velocityTexture, VELOCITY_DISSIPATION, dt);
        advect(dyeFramebuffer, dyeTexture, DENSITY_DISSIPATION, dt);
    }
}

// 画布尺寸适配（重点优化移动端，适配横竖屏切换、刘海屏）
function resize() {
    const { innerWidth: width, innerHeight: height } = window;
    // 适配移动端刘海屏，避免画布被遮挡
    const safeAreaInsetTop = window.safeAreaInsets?.top || 0;
    const safeAreaInsetBottom = window.safeAreaInsets?.bottom || 0;
    canvas.width = width;
    canvas.height = height - safeAreaInsetTop - safeAreaInsetBottom;
    canvas.style.top = `${safeAreaInsetTop}px`;
    gl.viewport(0, 0, width, height);
}
// 移动端适配：监听窗口缩放、横竖屏切换，延迟执行避免频繁渲染
let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
});
window.addEventListener('orientationchange', resize);
// 初始化适配
resize();

// 初始化清除画布
clear(velocityFramebuffer, BACK_COLOR);
clear(dyeFramebuffer, BACK_COLOR);

// 动画循环（适配移动端性能，降低渲染频率，避免卡顿）
let lastTime = Date.now();
let colorUpdateTimer = 0;
let color = randomColor();

function animate() {
    const now = Date.now();
    const dt = Math.min(0.02, (now - lastTime) / 1000); // 移动端降低帧率，提升流畅度
    lastTime = now;

    if (COLORFUL) {
        colorUpdateTimer += dt * COLOR_UPDATE_SPEED;
        if (colorUpdateTimer > 1) {
            colorUpdateTimer = 0;
            color = randomColor();
        }
    }

    // 自动生成流体粒子（移动端降低频率，避免卡顿，柔和不杂乱）
    if (Math.random() < 0.015) {
        const point = { x: random(1), y: random(1) };
        splat(velocityFramebuffer, point, { r: random(SPLAT_FORCE/255), g: random(SPLAT_FORCE/255), b: random(SPLAT_FORCE/255) }, SPLAT_RADIUS);
        splat(dyeFramebuffer, point, color, SPLAT_RADIUS);
    }

    step(dt);
    display();
    requestAnimationFrame(animate);
}
animate();

// 鼠标/触摸互动（重点优化移动端触摸，避免卡顿、误触）
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    const point = { x, y };
    splat(velocityFramebuffer, point, { r: random(SPLAT_FORCE/255), g: random(SPLAT_FORCE/255), b: random(SPLAT_FORCE/255) }, SPLAT_RADIUS);
    splat(dyeFramebuffer, point, color, SPLAT_RADIUS);
});

// 移动端触摸优化：禁止默认滚动，提升触摸响应速度，避免误触
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // 阻止触摸滚动，避免流体互动与页面滚动冲突
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) / rect.width;
    const y = 1.0 - (touch.clientY - rect.top) / rect.height;
    const point = { x, y };
    // 移动端触摸力度适配，避免粒子过大
    splat(velocityFramebuffer, point, { r: random(SPLAT_FORCE/300), g: random(SPLAT_FORCE/300), b: random(SPLAT_FORCE/300) }, SPLAT_RADIUS);
    splat(dyeFramebuffer, point, color, SPLAT_RADIUS);
}, { passive: false });

// 移动端休眠唤醒适配：避免休眠后流体卡顿
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        lastTime = Date.now();
        resize(); // 唤醒后重新适配画布
    }
});