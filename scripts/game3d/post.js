/* ============================================================================
   YOONKI WORLD 3D — post chain + quality tiers
   RenderPass -> UnrealBloom (half res) -> H/V tilt-shift (the miniature
   signature) -> grade+vignette -> SMAA/FXAA -> OutputPass.
   LOW tier: no composer at all — direct render + CSS vignette.
   ========================================================================== */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

const GradeVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    // 0.55 pre-tonemap ≈ 25% darker corners on FINAL pixels (ACES + sRGB
    // compress the multiply, so the linear value must overshoot; verified
    // by readPixels: corner luminance ~74% of an unvignetted corner)
    uVig: { value: 0.55 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uVig;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col = (col - 0.5) * 1.05 + 0.5 + 0.01;                 // contrast + lift
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.15);                          // saturation (vivid-but-soft Pokopia)
      col *= vec3(1.03, 1.0, 0.97);                           // warm tint
      float d = distance(vUv, vec2(0.5));
      col *= 1.0 - smoothstep(0.38, 0.78, d) * uVig;          // vignette (~25% corners)
      gl_FragColor = vec4(col, c.a);
    }`
};

export function createPost(renderer, scene, camera) {
  let composer = null;
  let bloom = null, hTilt = null, vTilt = null, grade = null;
  let tier = 'high';
  let w = 2, h = 2;
  const focus = { y: 0.5 };           // damped tilt-shift focus band (uv.y)

  function buildComposer() {
    if (composer) composer.dispose();
    // MSAA render target: geometric AA resolved before the post passes,
    // no SMAA/FXAA pass needed (SMAA artifacts on HDR input; FXAA blurs).
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: tier === 'high' ? 4 : 2
    });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));

    bloom = new UnrealBloomPass(
      new THREE.Vector2(Math.max(2, w >> 1), Math.max(2, h >> 1)),
      tier === 'high' ? 0.25 : 0.18, 0.65, 1.05);   // HDR threshold: only sparkles
    composer.addPass(bloom);

    hTilt = new ShaderPass(HorizontalTiltShiftShader);
    vTilt = new ShaderPass(VerticalTiltShiftShader);
    // both shaders key the blur off abs(r - vUv.y): a horizontal focus band
    hTilt.uniforms.r.value = focus.y;
    vTilt.uniforms.r.value = focus.y;
    composer.addPass(hTilt);
    composer.addPass(vTilt);

    grade = new ShaderPass(GradeVignetteShader);
    composer.addPass(grade);

    composer.addPass(new OutputPass());
    applySize();
  }

  function applySize() {
    if (!composer) return;
    composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    // playbook: ~2.5/dimension; 2.2 keeps 1440px from going to mush.
    // h steps horizontally (per-width), v steps vertically (per-height).
    if (hTilt) hTilt.uniforms.h.value = 2.2 / (w * pr);
    if (vTilt) vTilt.uniforms.v.value = 2.2 / (h * pr);
  }

  const api = {
    get tier() { return tier; },
    setTier(t) {
      tier = t;
      if (t === 'low') {
        if (composer) { composer.dispose(); composer = null; }
      } else {
        buildComposer();
      }
    },
    setSize(nw, nh) { w = nw; h = nh; applySize(); },
    /** Debug/verification hook: override vignette strength at runtime. */
    setVignette(v) { if (grade) grade.uniforms.uVig.value = v; },
    /** Keep the tilt-shift focus band ON the player (playbook): pass the
     *  player's NDC y each frame; damped at ~4Hz so look-ahead never jerks. */
    setFocus(ndcY, dt) {
      const target = 0.5 + ndcY * 0.5;                  // ndc -> uv space
      focus.y += (target - focus.y) * (1 - Math.exp(-4 * (dt || 0.016)));
      if (hTilt) hTilt.uniforms.r.value = focus.y;
      if (vTilt) vTilt.uniforms.r.value = focus.y;
    },
    render() {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
    get usesComposer() { return !!composer; }
  };
  return api;
}
