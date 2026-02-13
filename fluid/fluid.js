let canvas=document.getElementById("fluid-canvas"),gl=canvas.getContext("webgl",{antialias:!0,alpha:!1,preserveDrawingBuffer:!0,powerPreference:"high-performance"});if(!gl)throw alert("浏览器不支持WebGL，无法显示流体背景，建议更换Chrome/Edge浏览器（移动端请更新浏览器版本）"),canvas.style.background="#0a0a0a",new Error("WebGL not supported");let SIM_RESOLUTION=100,DYE_RESOLUTION=768,DENSITY_DISSIPATION=.98,VELOCITY_DISSIPATION=.99,PRESSURE=.8,PRESSURE_ITERATIONS=15,CURL=25,SPLAT_RADIUS=.15,SPLAT_FORCE=4e3,COLORFUL=!0,COLOR_UPDATE_SPEED=8,PAUSED=!1,BACK_COLOR={r:16,g:16,b:16};function wrapValue(e,r){e%=r;return e<0?e+r:e}function random(e){return Math.random()*e}function randomColor(){return{r:.8*Math.random(),g:.8*Math.random(),b:.8*Math.random()}}function createShader(e,r){e=gl.createShader(e);return gl.shaderSource(e,r),gl.compileShader(e),gl.getShaderParameter(e,gl.COMPILE_STATUS)||console.error("Shader编译错误：",gl.getShaderInfoLog(e)),e}function createProgram(e,r){var t=gl.createProgram();return gl.attachShader(t,e),gl.attachShader(t,r),gl.linkProgram(t),gl.getProgramParameter(t,gl.LINK_STATUS)||console.error("Program链接错误：",gl.getProgramInfoLog(t)),t}function createTexture(e,r,t,a,o,i,l){var u=gl.createTexture();return gl.bindTexture(e,u),gl.texParameteri(e,gl.TEXTURE_MIN_FILTER,gl.LINEAR),gl.texParameteri(e,gl.TEXTURE_MAG_FILTER,gl.LINEAR),gl.texParameteri(e,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE),gl.texParameteri(e,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE),gl.texImage2D(e,0,r,t,a,0,o,i,l),u}function createFramebuffer(e){var r=gl.createFramebuffer();return gl.bindFramebuffer(gl.FRAMEBUFFER,r),gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,e,0),r}let vertexShaderSource=`
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
`),copyProgram=createProgram(clearShader,copyShader),displayShader=createShader(gl.FRAGMENT_SHADER,`
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
`),displayProgram=createProgram(clearShader,displayShader),splatShader=createShader(gl.FRAGMENT_SHADER,`
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
`),splatProgram=createProgram(clearShader,splatShader),advectionShader=createShader(gl.FRAGMENT_SHADER,`
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
`),advectionProgram=createProgram(clearShader,advectionShader),divergenceShader=createShader(gl.FRAGMENT_SHADER,`
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
`),divergenceProgram=createProgram(clearShader,divergenceShader),pressureShader=createShader(gl.FRAGMENT_SHADER,`
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
`),pressureProgram=createProgram(clearShader,pressureShader),gradientSubtractShader=createShader(gl.FRAGMENT_SHADER,`
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
`),gradientSubtractProgram=createProgram(clearShader,gradientSubtractShader),curlShader=createShader(gl.FRAGMENT_SHADER,`
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
`),curlProgram=createProgram(clearShader,curlShader),vorticityShader=createShader(gl.FRAGMENT_SHADER,`
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
`),vorticityProgram=createProgram(clearShader,vorticityShader),quadVertices=new Float32Array([-1,-1,1,-1,-1,1,1,1]),velocityTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),velocityFramebuffer=createFramebuffer(velocityTexture),velocityDyeTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),velocityDyeFramebuffer=createFramebuffer(velocityDyeTexture),divergenceTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),divergenceFramebuffer=createFramebuffer(divergenceTexture),curlTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),curlFramebuffer=createFramebuffer(curlTexture),pressureTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),pressureFramebuffer=createFramebuffer(pressureTexture),pressureDyeTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,SIM_RESOLUTION,SIM_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),pressureDyeFramebuffer=createFramebuffer(pressureDyeTexture),dyeTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,DYE_RESOLUTION,DYE_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),dyeFramebuffer=createFramebuffer(dyeTexture),dyeDyeTexture=createTexture(gl.TEXTURE_2D,gl.RGBA,DYE_RESOLUTION,DYE_RESOLUTION,gl.RGBA,gl.HALF_FLOAT,null),dyeDyeFramebuffer=createFramebuffer(dyeDyeTexture);function render(e,r){gl.bindFramebuffer(gl.FRAMEBUFFER,r),gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}function copy(e,r){gl.useProgram(copyProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(gl.getAttribLocation(copyProgram,"a_position")),gl.vertexAttribPointer(gl.getAttribLocation(copyProgram,"a_position"),2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,r),gl.uniform1i(gl.getUniformLocation(copyProgram,"u_texture"),0),render(copyProgram,e)}function clear(e,r){gl.bindFramebuffer(gl.FRAMEBUFFER,e),gl.clearColor(r.r/255,r.g/255,r.b/255,1),gl.clear(gl.COLOR_BUFFER_BIT)}function splat(e,r,t,a){gl.useProgram(splatProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(gl.getAttribLocation(splatProgram,"a_position")),gl.vertexAttribPointer(gl.getAttribLocation(splatProgram,"a_position"),2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,e),gl.uniform1i(gl.getUniformLocation(splatProgram,"u_target"),0),gl.uniform2f(gl.getUniformLocation(splatProgram,"u_point"),r.x,r.y),gl.uniform3f(gl.getUniformLocation(splatProgram,"u_color"),t.r,t.g,t.b),gl.uniform1f(gl.getUniformLocation(splatProgram,"u_radius"),a),gl.uniform1f(gl.getUniformLocation(splatProgram,"u_aspectRatio"),canvas.width/canvas.height),render(splatProgram,e===velocityFramebuffer?velocityDyeFramebuffer:dyeDyeFramebuffer),copy(e,e===velocityFramebuffer?velocityDyeTexture:dyeDyeTexture)}function advect(e,r,t,a){gl.useProgram(advectionProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(gl.getAttribLocation(advectionProgram,"a_position")),gl.vertexAttribPointer(gl.getAttribLocation(advectionProgram,"a_position"),2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,velocityTexture),gl.uniform1i(gl.getUniformLocation(advectionProgram,"u_velocity"),0),gl.activeTexture(gl.TEXTURE1),gl.bindTexture(gl.TEXTURE_2D,r),gl.uniform1i(gl.getUniformLocation(advectionProgram,"u_source"),1),gl.uniform2f(gl.getUniformLocation(advectionProgram,"u_texelSize"),1/SIM_RESOLUTION,1/SIM_RESOLUTION),gl.uniform1f(gl.getUniformLocation(advectionProgram,"u_dt"),a),gl.uniform1f(gl.getUniformLocation(advectionProgram,"u_dissipation"),t),render(advectionProgram,e===velocityFramebuffer?velocityDyeFramebuffer:dyeDyeFramebuffer),copy(e,e===velocityFramebuffer?velocityDyeTexture:dyeDyeTexture)}function computeDivergence(){gl.useProgram(divergenceProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(gl.getAttribLocation(divergenceProgram,"a_position")),gl.vertexAttribPointer(gl.getAttribLocation(divergenceProgram,"a_position"),2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,velocityTexture),gl.uniform1i(gl.getUniformLocation(divergenceProgram,"u_velocity"),0),gl.uniform2f(gl.getUniformLocation(divergenceProgram,"u_texelSize"),1/SIM_RESOLUTION,1/SIM_RESOLUTION),render(divergenceProgram,divergenceFramebuffer)}function computeCurl(){gl.useProgram(curlProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(gl.getAttribLocation(curlProgram,"a_position")),gl.vertexAttribPointer(gl.getAttribLocation(curlProgram,"a_position"),2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,velocityTexture),gl.uniform1i(gl.getUniformLocation(curlProgram,"u_velocity"),0),gl.uniform2f(gl.getUniformLocation(curlProgram,"u_texelSize"),1/SIM_RESOLUTION,1/SIM_RESOLUTION),render(curlProgram,curlFramebuffer)}function computeVorticity(){gl.useProgram(vorticityProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(gl.getAttribLocation(vorticityProgram,"a_position")),gl.vertexAttribPointer(gl.getAttribLocation(vorticityProgram,"a_position"),2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,velocityTexture),gl.uniform1i(gl.getUniformLocation(vorticityProgram,"u_velocity"),0),gl.activeTexture(gl.TEXTURE1),gl.bindTexture(gl.TEXTURE_2D,curlTexture),gl.uniform1i(gl.getUniformLocation(vorticityProgram,"u_curl"),1),gl.uniform2f(gl.getUniformLocation(vorticityProgram,"u_texelSize"),1/SIM_RESOLUTION,1/SIM_RESOLUTION),gl.uniform1f(gl.getUniformLocation(vorticityProgram,"u_curlStrength"),CURL),render(vorticityProgram,velocityDyeFramebuffer),copy(velocityFramebuffer,velocityDyeTexture)}function computePressure(){gl.useProgram(pressureProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(gl.getAttribLocation(pressureProgram,"a_position")),gl.vertexAttribPointer(gl.getAttribLocation(pressureProgram,"a_position"),2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,pressureTexture),gl.uniform1i(gl.getUniformLocation(pressureProgram,"u_pressure"),0),gl.activeTexture(gl.TEXTURE1),gl.bindTexture(gl.TEXTURE_2D,divergenceTexture),gl.uniform1i(gl.getUniformLocation(pressureProgram,"u_divergence"),1),gl.uniform2f(gl.getUniformLocation(pressureProgram,"u_texelSize"),1/SIM_RESOLUTION,1/SIM_RESOLUTION);for(let e=0;e<PRESSURE_ITERATIONS;e++)render(pressureProgram,pressureDyeFramebuffer),copy(pressureFramebuffer,pressureDyeTexture)}function subtractGradient(){gl.useProgram(gradientSubtractProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(gl.getAttribLocation(gradientSubtractProgram,"a_position")),gl.vertexAttribPointer(gl.getAttribLocation(gradientSubtractProgram,"a_position"),2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,pressureTexture),gl.uniform1i(gl.getUniformLocation(gradientSubtractProgram,"u_pressure"),0),gl.activeTexture(gl.TEXTURE1),gl.bindTexture(gl.TEXTURE_2D,velocityTexture),gl.uniform1i(gl.getUniformLocation(gradientSubtractProgram,"u_velocity"),1),gl.uniform2f(gl.getUniformLocation(gradientSubtractProgram,"u_texelSize"),1/SIM_RESOLUTION,1/SIM_RESOLUTION),render(gradientSubtractProgram,velocityDyeFramebuffer),copy(velocityFramebuffer,velocityDyeTexture)}function display(){gl.useProgram(displayProgram),gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()),gl.bufferData(gl.ARRAY_BUFFER,quadVertices,gl.STATIC_DRAW),gl.enableVertexAttribArray(gl.getAttribLocation(displayProgram,"a_position")),gl.vertexAttribPointer(gl.getAttribLocation(displayProgram,"a_position"),2,gl.FLOAT,!1,0,0),gl.activeTexture(gl.TEXTURE0),gl.bindTexture(gl.TEXTURE_2D,dyeTexture),gl.uniform1i(gl.getUniformLocation(displayProgram,"u_texture"),0),gl.uniform2f(gl.getUniformLocation(displayProgram,"u_texelSize"),1/DYE_RESOLUTION,1/DYE_RESOLUTION),gl.uniform1f(gl.getUniformLocation(displayProgram,"u_curl"),CURL),gl.uniform1f(gl.getUniformLocation(displayProgram,"u_time"),Date.now()/1e3),render(displayProgram,null)}function step(e){PAUSED||(computeCurl(),computeVorticity(),computeDivergence(),computePressure(),subtractGradient(),advect(velocityFramebuffer,velocityTexture,VELOCITY_DISSIPATION,e),advect(dyeFramebuffer,dyeTexture,DENSITY_DISSIPATION,e))}function resize(){var{innerWidth:e,innerHeight:r}=window,t=window.safeAreaInsets?.top||0,a=window.safeAreaInsets?.bottom||0;canvas.width=e,canvas.height=r-t-a,canvas.style.top=t+"px",gl.viewport(0,0,e,r)}let resizeTimer=null,lastTime=(window.addEventListener("resize",()=>{clearTimeout(resizeTimer),resizeTimer=setTimeout(resize,100)}),window.addEventListener("orientationchange",resize),resize(),clear(velocityFramebuffer,BACK_COLOR),clear(dyeFramebuffer,BACK_COLOR),Date.now()),colorUpdateTimer=0,color=randomColor();function animate(){var e=Date.now(),r=Math.min(.02,(e-lastTime)/1e3);lastTime=e,COLORFUL&&1<(colorUpdateTimer+=r*COLOR_UPDATE_SPEED)&&(colorUpdateTimer=0,color=randomColor()),Math.random()<.015&&(e={x:random(1),y:random(1)},splat(velocityFramebuffer,e,{r:random(SPLAT_FORCE/255),g:random(SPLAT_FORCE/255),b:random(SPLAT_FORCE/255)},SPLAT_RADIUS),splat(dyeFramebuffer,e,color,SPLAT_RADIUS)),step(r),display(),requestAnimationFrame(animate)}animate(),canvas.addEventListener("mousemove",e=>{var r=canvas.getBoundingClientRect(),e={x:(e.clientX-r.left)/r.width,y:1-(e.clientY-r.top)/r.height};splat(velocityFramebuffer,e,{r:random(SPLAT_FORCE/255),g:random(SPLAT_FORCE/255),b:random(SPLAT_FORCE/255)},SPLAT_RADIUS),splat(dyeFramebuffer,e,color,SPLAT_RADIUS)}),canvas.addEventListener("touchmove",e=>{e.preventDefault();var r=canvas.getBoundingClientRect(),e=e.touches[0],e={x:(e.clientX-r.left)/r.width,y:1-(e.clientY-r.top)/r.height};splat(velocityFramebuffer,e,{r:random(SPLAT_FORCE/300),g:random(SPLAT_FORCE/300),b:random(SPLAT_FORCE/300)},SPLAT_RADIUS),splat(dyeFramebuffer,e,color,SPLAT_RADIUS)},{passive:!1}),document.addEventListener("visibilitychange",()=>{document.hidden||(lastTime=Date.now(),resize())});