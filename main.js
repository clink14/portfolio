// 1. THEME TOGGLE & PERSISTENCE
const toggleBtn = document.getElementById('theme-toggle');
const body = document.body;

const savedTheme = localStorage.getItem('portfolio-theme');
if (savedTheme) {
  body.setAttribute('data-theme', savedTheme);
}
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    const current = body.getAttribute('data-theme');
    const nextTheme = current === 'light' ? 'dark' : 'light';
    
    body.setAttribute('data-theme', nextTheme);
    localStorage.setItem('portfolio-theme', nextTheme);
  });
}

// 2. BACKGROUND SHADER
(function() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const gl = canvas.getContext('webgl');
  if (!gl) return;

  // Vertex Shader
  const vertexSrc = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  // Fragment Shader
  const fragmentSrc = `
    precision highp float;
    uniform float u_time;
    uniform vec2  u_res;
    uniform vec2  u_mouse;
    uniform float u_theme; // 0.0 = light, 1.0 = dark

    float ripple(vec2 p, float t){
      float w1 = sin(p.x*6.0 + t*1.7);
      float w2 = cos(p.y*5.0 - t*1.3);
      float w3 = sin((p.x+p.y)*4.0 - t*1.1);
      return (w1 + w2 + 0.6*w3) / 3.0;
    }

    vec3 paletteLight(float t) {
      vec3 pink  = vec3(1.0, 0.32, 0.72);
      vec3 gold  = vec3(1.0, 0.83, 0.48);
      vec3 lime  = vec3(0.80, 1.0, 0.50);
      vec3 cyan  = vec3(0.60, 1.0, 0.98);
      vec3 a = mix(pink, gold, smoothstep(0.0, 0.4, t));
      vec3 b = mix(lime, cyan, smoothstep(0.4, 1.0, t));
      return mix(a, b, t);
    }

    vec3 paletteNight(float t) {
      vec3 hot   = vec3(1.0, 0.12, 0.62);
      vec3 cyan  = vec3(0.10, 0.95, 1.0);
      vec3 gold  = vec3(1.0, 0.82, 0.35);
      vec3 base  = mix(hot, cyan, 0.5 + 0.5*sin(t*1.4));
      return mix(base, gold, smoothstep(0.3, 1.0, t));
    }

    void main(){
      vec2 uv = (gl_FragCoord.xy / u_res)*2.0 - 1.0;
      uv.x *= u_res.x / u_res.y;

      // Mouse interaction
      vec2 m = (u_mouse / u_res)*2.0 - 1.0;
      float dist = length(uv - m);
      float t = u_time;

      float r = ripple(uv + 0.18*m, t);
      // The "Blob" shape logic
      float band = smoothstep(0.35, 0.95, 1.0 - dist + 0.25*r);

      float fresnel = pow(1.0 - abs(uv.y), 2.2);

      float tt = 0.5 + 0.5*sin(t + r);
      vec3 colLight = paletteLight(tt);
      vec3 colNight = paletteNight(tt);

      vec3 col = mix(colLight, colNight, u_theme);

      // Background colors matching your CSS variables roughly
      vec3 bgLight  = vec3(0.95, 0.95, 0.96); 
      vec3 bgNight  = vec3(0.00, 0.00, 0.00); 
      vec3 bg       = mix(bgLight, bgNight, u_theme);

      vec3 finalCol = mix(bg, col, band);
      
      // Add subtle shine
      finalCol += 0.18 * vec3(1.0,0.9,1.0) * pow(max(0.0, r*fresnel), 4.0);

      gl_FragColor = vec4(finalCol, 1.0);
    }
  `;

  function createShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("Shader Error:", gl.getShaderInfoLog(s));
    }
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, createShader(gl, gl.VERTEX_SHADER, vertexSrc));
  gl.attachShader(prog, createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  
  const posLoc = gl.getAttribLocation(prog, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Uniform Locations
  const timeLoc  = gl.getUniformLocation(prog, "u_time");
  const resLoc   = gl.getUniformLocation(prog, "u_res");
  const mouseLoc = gl.getUniformLocation(prog, "u_mouse");
  const themeLoc = gl.getUniformLocation(prog, "u_theme");

  // Mouse State
  let mouse = [0, 0];
  window.addEventListener("pointermove", (e)=>{
    // Get mouse relative to canvas (which is fixed full screen)
    const rect = canvas.getBoundingClientRect();
    mouse[0] = (e.clientX - rect.left) * window.devicePixelRatio;
    // Flip Y for WebGL
    mouse[1] = (rect.bottom - e.clientY) * window.devicePixelRatio;
  });

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener("resize", resize);
  resize();

  function render(now) {
    gl.uniform1f(timeLoc, now * 0.001);
    gl.uniform2f(resLoc, canvas.width, canvas.height);
    gl.uniform2f(mouseLoc, mouse[0], mouse[1]);
    
    // Convert data-theme to float (0.0 for light, 1.0 for dark)
    const isDark = body.getAttribute('data-theme') === 'dark';
    gl.uniform1f(themeLoc, isDark ? 1.0 : 0.0);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();