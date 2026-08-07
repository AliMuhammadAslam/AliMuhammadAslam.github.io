/**
 * Hero background: a single full-screen fragment shader.
 * Flowing fbm noise field, faintly reactive to the pointer.
 * Deliberately low-contrast, since it sits behind type and must never fight it.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uLight;   // 0 = dark theme, 1 = light theme

// -- value noise + fbm ------------------------------------------------
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime * 0.035;

  // domain warp, which gives the field its slow liquid drift
  vec2 q = vec2(fbm(uv * 1.6 + t), fbm(uv * 1.6 + vec2(3.2, 1.7) - t));
  vec2 r = vec2(
    fbm(uv * 2.1 + 3.0 * q + vec2(1.7, 9.2) + 0.15 * t),
    fbm(uv * 2.1 + 3.0 * q + vec2(8.3, 2.8) - 0.12 * t)
  );
  float f = fbm(uv * 1.9 + 3.4 * r);

  // pointer pulls a soft bloom toward itself
  vec2  m    = (uMouse - 0.5 * uRes) / min(uRes.x, uRes.y);
  float dist = length(uv - m);
  float halo = smoothstep(0.85, 0.0, dist) * 0.34;

  float field = smoothstep(0.16, 0.94, f) + halo;

  vec3 base   = mix(vec3(0.039, 0.031, 0.071), vec3(1.000, 0.992, 0.984), uLight);
  vec3 mid    = mix(vec3(0.118, 0.071, 0.180), vec3(0.988, 0.933, 0.898), uLight);
  vec3 warm   = mix(vec3(1.000, 0.361, 0.208), vec3(0.941, 0.290, 0.090), uLight);
  vec3 amber  = mix(vec3(1.000, 0.690, 0.125), vec3(0.851, 0.522, 0.000), uLight);

  vec3 col = mix(base, mid, field);
  // Two accent passes: violet-leaning mid tones lift into coral, then the
  // brightest crests tip toward amber. Keeps the field from reading flat.
  col = mix(col, warm,  pow(field, 2.8) * mix(0.42, 0.26, uLight));
  col = mix(col, amber, pow(field, 6.5) * mix(0.34, 0.20, uLight));

  // vignette so the edges fall away into the page background
  float vig = smoothstep(1.35, 0.25, length(uv * vec2(uRes.x / uRes.y, 1.0)));
  col = mix(base, col, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('shader:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function initGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
  });
  if (!gl) {
    canvas.style.display = 'none';
    return;
  }

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uMouse = gl.getUniformLocation(prog, 'uMouse');
  const uLight = gl.getUniformLocation(prog, 'uLight');

  // Cap at 1.5x DPR. The field is low-frequency, so full retina buys nothing
  // but costs a lot of fill rate on high-density laptop panels.
  const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);

  let w = 0;
  let h = 0;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width * dpr()));
    h = Math.max(1, Math.round(rect.height * dpr()));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl!.viewport(0, 0, w, h);
    }
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener(
    'pointermove',
    (e) => {
      mouse.tx = e.clientX * dpr();
      mouse.ty = (window.innerHeight - e.clientY) * dpr();
    },
    { passive: true }
  );

  // Pause when the hero scrolls out of view. No point burning GPU on
  // a canvas nobody can see.
  let visible = true;
  new IntersectionObserver(
    ([entry]) => { visible = entry.isIntersecting; },
    { threshold: 0 }
  ).observe(canvas);

  const start = performance.now();
  let raf = 0;

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;

    resize();
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;

    const light = document.documentElement.dataset.theme === 'light' ? 1 : 0;

    gl!.uniform2f(uRes, w, h);
    gl!.uniform1f(uTime, (now - start) / 1000);
    gl!.uniform2f(uMouse, mouse.x, mouse.y);
    gl!.uniform1f(uLight, light);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }
  raf = requestAnimationFrame(frame);

  return () => cancelAnimationFrame(raf);
}
