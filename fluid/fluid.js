let canvas=document.getElementById("fluid-canvas"),gl=canvas.getContext("webgl",{antialias:!0,alpha:!1,preserveDrawingBuffer:!0}),isMobile=(gl||alert("你的手机不支持WebGL，无法显示流体背景"),window.innerWidth<768),SIM_RESOLUTION=isMobile?64:128,DYE_RESOLUTION=isMobile?512:1024,CAPTURE_RESOLUTION=512,DENSITY_DISSIPATION=.98,VELOCITY_DISSIPATION=.99,PRESSURE=.8,PRESSURE_ITERATIONS=isMobile?10:20,CURL=isMobile?20:30,SPLAT_RADIUS=.2,SPLAT_FORCE=isMobile?3e3:6e3,SHADING=!0,COLORFUL=!0,COLOR_UPDATE_SPEED=10,PAUSED=!1,BACK_COLOR={r:16,g:16,b:16};function wrapValue(e,r){let t=e%r;return t<0&&(t+=r),t}function random(e){return Math.random()*e}function randomColor(){return{r:Math.random(),g:Math.random(),b:Math.random()}}function createShader(e,r){e=gl.createShader(e);return gl.shaderSource(e,r),gl.compileShader(e),gl.getShaderParameter(e,gl.COMPILE_STATUS)||console.error(gl.getShaderInfoLog(e)),e}function createProgram(e,r){var t=gl.createProgram();return gl.attachShader(t,e),gl.attachShader(t,r),gl.linkProgram(t),gl.getProgramParameter(t,gl.LINK_STATUS)||console.error(gl.getProgramInfoLog(t)),t}function createTexture(e,r,t,o,i,e,a){var l=gl.createTexture();return gl.bindTexture(e,l),gl.texParameteri(e,gl.TEXTURE_MIN_FILTER,gl.LINEAR),gl.texParameteri(e,gl.TEXTURE_MAG_FILTER,gl.LINEAR),gl.texParameteri(e,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE),gl.texParameteri(e,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE),gl.texImage2D(e,0,r,t,o,0,i,e,a),l}function createFramebuffer(e){var r=gl.createFramebuffer();return gl.bindFramebuffer(gl.FRAMEBUFFER,r),gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,e,0),r}let vertexShaderSource=`
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`,clearShader=createShader(gl.VERTEX_SHADER,vertexShaderSource),copyShader=createShader(gl.FRAGMENT_SHADER,`
    precision mediump float;
    uniform sampler2D u_texture;
    varying vec2 v_uv;
    void main() {
        gl_FragColor = texture2D(u_texture, v_uv);
    }
`),copyProgram=createProgram(clearShader,copyShader),copyPositionLocation=gl.getAttribLocation(copyProgram,"a_position"),copyTextureLocation=gl.getUniformLocation(copyProgram,"u_texture"),displayShader=createShader(gl.FRAGMENT_SHADER,`
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
`),displayProgram=createProgram(clearShader,displayShader),displayPositionLocation=gl.getAttribLocation(displayProgram,"a_position"),displayTextureLocation=gl.getUniformLocation(displayProgram,"u_texture"),displayTexelSizeLocation=gl.getUniformLocation(displayProgram,"u_texelSize"),displayCurlLocation=gl.getUniformLocation(displayProgram,"u_curl"),displayTimeLocation=gl.getUniformLocation(displayProgram,"u_time"),splatShader=createShader(gl.FRAGMENT_SHADER,`
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
`),splatProgram=createProgram(clearShader,splatShader),splatPositionLocation=gl.getAttribLocation(splatProgram,"a_position"),splatTargetLocation=gl.getUniformLocation(splatProgram,"u_target"),splatPointLocation=gl.getUniformLocation(splatProgram,"u_point"),splatColorLocation=gl.getUniformLocation(splatProgram,"u_color"),splatRadiusLocation=gl.getUniformLocation(splatProgram,"u_radius"),splatAspectRatioLocation=gl.getUniformLocation(splatProgram,"u_aspectRatio"),advectionShader=createShader(gl.FRAGMENT_SHADER,`
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
`),advectionProgram=createProgram(clearShader,advectionShader),advectionPositionLocation=gl.getAttribLocation(advectionProgram,"a_position"),advectionVelocityLocation=gl.getUniformLocation(advectionProgram,"u_velocity"),advectionSourceLocation=gl.getUniformLocation(advectionProgram,"u_source"),advectionTexelSizeLocation=gl.getUniformLocation(advectionProgram,"u_texelSize"),advectionDtLocation=gl.getUniformLocation(advectionProgram,"u_dt"),advectionDissipationLocation=gl.getUniformLocation(advectionProgram,"u_dissipation"),divergenceShader=createShader(gl.FRAGMENT_SHADER,`
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
`),divergenceProgram=createProgram(clearShader,divergenceShader),divergencePositionLocation=gl.getAttribLocation(divergenceProgram,"a_position"),divergenceVelocityLocation=gl.getUniformLocation(divergenceProgram,"u_velocity"),divergenceTexelSizeLocation=gl.getUniformLocation(divergenceProgram,"u_texelSize"),pressureShader=createShader(gl.FRAGMENT_SHADER,`
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
`),pressureProgram=createProgram(clearShader,pressureShader),pressurePositionLocation=gl.getAttribLocation(pressureProgram,"a_position"),pressurePressureLocation=gl.getUniformLocation(pressureProgram,"u_pressure"),pressureDivergenceLocation=gl.getUniformLocation(pressureProgram,"u_divergence"),pressureTexelSizeLocation=gl.getUniformLocation(pressureProgram,"u_texelSize"),gradientSubtractShader=createShader(gl.FRAGMENT_SHADER,`
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
`),gradientSubtractProgram=createProgram(clearShader,gradientSubtractShader),gradientSubtractPositionLocation=gl.getAttribLocation(gradientSubtractProgram,"a_position"),gradientSubtractPressureLocation=gl.getUniformLocation(gradientSubtractProgram,"u_pressure"),gradientSubtractVelocityLocation=gl.getUniformLocation(gradientSubtractProgram,"u_velocity"),gradientSubtractTexelSizeLocation=gl.getUniformLocation(gradientSubtractProgram,"u_texelSize"),curlShader=createShader(gl.FRAGMENT_SHADER,`
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
`),curlProgram=createProgram(clearShader,curlShader),curlPositionLocation=gl.getAttribLocation(curlProgram,"a_position"),curlVelocityLocation=gl.getUniformLocation(curlProgram,"u_velocity"),curlTexelSizeLocation=gl.getUniformLocation(curlProgram,"u_texelSize"),vorticityShader=createShader(gl.FRAGMENT_SHADER,`
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
`),vorticityProgram=createProgram(clearShader,vorticityShader),vorticityPositionLocation=gl.getAttribLocation(vorticityProgram,"a_position"),vorticityVelocityLocation=gl.getUniformLocation(vorticityProgram,"u_velocity"),vorticityCurlLocation=gl.getUniformLocation(vorticityProgram,"u_curl"),vorticityTexelSizeLocation=gl.getUniformLocation(vorticityProgram,"u_texelSize"),vorticityCurlStrengthLocation=gl.getUniformLocation(vorticityProgram,"u_curlStrength"),quadVertices=new Float32Array([-1,-1,1,-1,-1,1,1,1]),velocityTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),velocityFramebuffer=createFramebuffer(velocityTexture),velocityDyeTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),velocityDyeFramebuffer=createFramebuffer(velocityDyeTexture),divergenceTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),divergenceFramebuffer=createFramebuffer(divergenceTexture),curlTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),curlFramebuffer=createFramebuffer(curlTexture),pressureTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),pressureFramebuffer=createFramebuffer(pressureTexture),pressureDyeTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),pressureDyeFramebuffer=createFramebuffer(pressureDyeTexture),dyeTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,DYE_RESOLUTION,DYE_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),dyeFramebuffer=createFramebuffer(dyeTexture),dyeDyeTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,DYE_RESOLUTION,DYE_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),dyeDyeFramebuffer=createFramebuffer(dyeDyeTexture);function render(e,r){gl.bindFramebuffer(gl.FRAMEBUFFER,r),gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}function copy(e,r){gl.useProgram(copyProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(copyPositionLocation),gl.vertexAttribPointer(copyPositionLocation,2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,r),gl.uniform1i(copyTextureLocation,0),render(copyProgram,e)}function clear(e,r){gl.bindFramebuffer(gl.FRAMEBUFFER,e),gl.clearColor(r.r,r.g,r.b,1),gl.clear(gl.COLOR_BUFFER_BIT)}function splat(e,r,t,o){gl.useProgram(splatProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(splatPositionLocation),gl.vertexAttribPointer(splatPositionLocation,2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,e),gl.uniform1i(splatTargetLocation,0),gl.uniform2f(splatPointLocation,r.x,r.y),gl.uniform3f(splatColorLocation,t.r,t.g,t.b),gl.uniform1f(splatRadiusLocation,o),gl.uniform1f(splatAspectRatioLocation,canvas.width/canvas.height),render(splatProgram,e===velocityFramebuffer?velocityDyeFramebuffer:dyeDyeFramebuffer),copy(e,e===velocityFramebuffer?velocityDyeTexture:dyeDyeTexture)}function advect(e,r,t,o){gl.useProgram(advectionProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(advectionPositionLocation),gl.vertexAttribPointer(advectionPositionLocation,2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,velocityTexture),gl.uniform1i(advectionVelocityLocation,0),gl.activeTexture(gl.TEXTURE1),gl.bindTexture(gl.TEXTURE_2D,r),gl.uniform1i(advectionSourceLocation,1),gl.uniform2f(advectionTexelSizeLocation,1/SIM_RESOLUTION,1/SIM_RESOLUTION),gl.uniform1f(advectionDtLocation,o),gl.uniform1f(advectionDissipationLocation,t),render(advectionProgram,e===velocityFramebuffer?velocityDyeFramebuffer:dyeDyeFramebuffer),copy(e,e===velocityFramebuffer?velocityDyeTexture:dyeDyeTexture)}function computeDivergence(){gl.useProgram(divergenceProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(divergencePositionLocation),gl.vertexAttribPointer(divergencePositionLocation,2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,velocityTexture),gl.uniform1i(divergenceVelocityLocation,0),gl.uniform2f(divergenceTexelSizeLocation,1/SIM_RESOLUTION,1/SIM_RESOLUTION),render(divergenceProgram,divergenceFramebuffer)}function computeCurl(){gl.useProgram(curlProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(curlPositionLocation),gl.vertexAttribPointer(curlPositionLocation,2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,velocityTexture),gl.uniform1i(curlVelocityLocation,0),gl.uniform2f(curlTexelSizeLocation,1/SIM_RESOLUTION,1/SIM_RESOLUTION),render(curlProgram,curlFramebuffer)}function computeVorticity(){gl.useProgram(vorticityProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(vorticityPositionLocation),gl.vertexAttribPointer(vorticityPositionLocation,2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,velocityTexture),gl.uniform1i(vorticityVelocityLocation,0),gl.activeTexture(gl.TEXTURE1),gl.bindTexture(gl.TEXTURE_2D,curlTexture),gl.uniform1i(vorticityCurlLocation,1),gl.uniform2f(vorticityTexelSizeLocation,1/SIM_RESOLUTION,1/SIM_RESOLUTION),gl.uniform1f(vorticityCurlStrengthLocation,CURL),render(vorticityProgram,velocityDyeFramebuffer),copy(velocityFramebuffer,velocityDyeTexture)}function computePressure(){gl.useProgram(pressureProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(pressurePositionLocation),gl.vertexAttribPointer(pressurePositionLocation,2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,pressureTexture),gl.uniform1i(pressurePressureLocation,0),gl.activeTexture(gl.TEXTURE1),gl.bindTexture(gl.TEXTURE_2D,divergenceTexture),gl.uniform1i(pressureDivergenceLocation,1),gl.uniform2f(pressureTexelSizeLocation,1/SIM_RESOLUTION,1/SIM_RESOLUTION);for(let e=0;e<PRESSURE_ITERATIONS;e++)render(pressureProgram,pressureDyeFramebuffer),copy(pressureFramebuffer,pressureDyeTexture)}function subtractGradient(){gl.useProgram(gradientSubtractProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(gradientSubtractPositionLocation),gl.vertexAttribPointer(gradientSubtractPositionLocation,2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,pressureTexture),gl.uniform1i(gradientSubtractPressureLocation,0),gl.activeTexture(gl.TEXTURE1),gl.bindTexture(gl.TEXTURE_2D,velocityTexture),gl.uniform1i(gradientSubtractVelocityLocation,1),gl.uniform2f(gradientSubtractTexelSizeLocation,1/SIM_RESOLUTION,1/SIM_RESOLUTION),render(gradientSubtractProgram,velocityDyeFramebuffer),copy(velocityFramebuffer,velocityDyeTexture)}function display(){gl.useProgram(displayProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(displayPositionLocation),gl.vertexAttribPointer(displayPositionLocation,2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,dyeTexture),gl.uniform1i(displayTextureLocation,0),gl.uniform2f(displayTexelSizeLocation,1/DYE_RESOLUTION,1/DYE_RESOLUTION),gl.uniform1f(displayCurlLocation,CURL),gl.uniform1f(displayTimeLocation,Date.now()/1e3),render(displayProgram,null)}function step(e){PAUSED||(computeCurl(),computeVorticity(),computeDivergence(),computePressure(),subtractGradient(),advect(velocityFramebuffer,velocityTexture,VELOCITY_DISSIPATION,e),advect(dyeFramebuffer,dyeTexture,DENSITY_DISSIPATION,e))}function resize(){var{innerWidth:e,innerHeight:r}=window;canvas.width=e,canvas.height=r,gl.viewport(0,0,e,r)}window.addEventListener("resize",resize),window.addEventListener("orientationchange",resize),resize();let lastTime=Date.now(),colorUpdateTimer=0,color=randomColor();function animate(){var e=Date.now(),r=Math.min(.016,(e-lastTime)/1e3);lastTime=e,COLORFUL&&1<(colorUpdateTimer+=r*COLOR_UPDATE_SPEED)&&(colorUpdateTimer=0,color=randomColor()),Math.random()<(isMobile?.02:.05)&&(e={x:random(1),y:random(1)},splat(velocityFramebuffer,e,{r:random(SPLAT_FORCE),g:random(SPLAT_FORCE),b:random(SPLAT_FORCE)},SPLAT_RADIUS),splat(dyeFramebuffer,e,color,SPLAT_RADIUS)),step(r),display(),requestAnimationFrame(animate)}animate(),canvas.addEventListener("mousemove",e=>{var r=canvas.getBoundingClientRect(),e={x:(e.clientX-r.left)/r.width,y:1-(e.clientY-r.top)/r.height};splat(velocityFramebuffer,e,{r:random(SPLAT_FORCE),g:random(SPLAT_FORCE),b:random(SPLAT_FORCE)},SPLAT_RADIUS),splat(dyeFramebuffer,e,color,SPLAT_RADIUS)});let isTouching=!1;canvas.addEventListener("touchstart",e=>{isTouching=!0,e.preventDefault()},{passive:!1}),canvas.addEventListener("touchend",()=>{isTouching=!1}),canvas.addEventListener("touchmove",e=>{var r;isTouching&&(e.preventDefault(),r=canvas.getBoundingClientRect(),e={x:((e=e.touches[0]).clientX-r.left)/r.width,y:1-(e.clientY-r.top)/r.height},Math.random()<.5)&&(splat(velocityFramebuffer,e,{r:random(SPLAT_FORCE),g:random(SPLAT_FORCE),b:random(SPLAT_FORCE)},SPLAT_RADIUS),splat(dyeFramebuffer,e,color,SPLAT_RADIUS))},{passive:!1});