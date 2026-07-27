import * as THREE from "three";
import "./aether.css";
import { createRuntime, fullscreenVertexShader } from "./shared/runtime.js";

const canvas = document.querySelector(".webgl");
const runtime = createRuntime(canvas, {
  antialias: false,
  clearColor: 0x07070a,
  maxPixelRatio: 1.6
});

if (runtime) {
  const { renderer, pointer, prefersReducedMotion } = runtime;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const drawingBufferSize = new THREE.Vector2();
  const identity = document.querySelector(".identity");
  const pointerVelocity = new THREE.Vector2();
  const pointerDelta = new THREE.Vector2();
  const previousPointer = new THREE.Vector2();

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector2() },
    uMotion: { value: 0 }
  };

  const fragmentShader = `
    precision highp float;

    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec2 uPointer;
    uniform float uMotion;
    varying vec2 vUv;

    float hash31(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }

    float valueNoise(vec3 p) {
      vec3 cell = floor(p);
      vec3 local = fract(p);
      vec3 curve = local * local * (3.0 - 2.0 * local);

      float n000 = hash31(cell + vec3(0.0, 0.0, 0.0));
      float n100 = hash31(cell + vec3(1.0, 0.0, 0.0));
      float n010 = hash31(cell + vec3(0.0, 1.0, 0.0));
      float n110 = hash31(cell + vec3(1.0, 1.0, 0.0));
      float n001 = hash31(cell + vec3(0.0, 0.0, 1.0));
      float n101 = hash31(cell + vec3(1.0, 0.0, 1.0));
      float n011 = hash31(cell + vec3(0.0, 1.0, 1.0));
      float n111 = hash31(cell + vec3(1.0, 1.0, 1.0));

      float nx00 = mix(n000, n100, curve.x);
      float nx10 = mix(n010, n110, curve.x);
      float nx01 = mix(n001, n101, curve.x);
      float nx11 = mix(n011, n111, curve.x);
      float nxy0 = mix(nx00, nx10, curve.y);
      float nxy1 = mix(nx01, nx11, curve.y);

      return mix(nxy0, nxy1, curve.z);
    }

    mat3 rotation = mat3(
      0.00, 0.80, 0.60,
     -0.80, 0.36,-0.48,
     -0.60,-0.48, 0.64
    );

    float fbm(vec3 p) {
      float total = 0.0;
      float amplitude = 0.52;

      for (int i = 0; i < 6; i++) {
        total += amplitude * valueNoise(p);
        p = rotation * p * 2.03 + vec3(0.17, 0.09, 0.13);
        amplitude *= 0.49;
      }

      return total;
    }

    void main() {
      vec2 pixel = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
      vec2 pointerPosition = uPointer * uResolution.xy / min(uResolution.x, uResolution.y);
      vec2 pointerVector = pixel - pointerPosition;
      float pointerDistance = length(pointerVector);
      float lens = exp(-dot(pointerVector, pointerVector) * 1.8);
      vec2 drift = uPointer * vec2(0.12, 0.09);
      vec2 p = pixel * 0.76 + drift;
      p += pointerVector * lens * (0.012 + uMotion * 0.045);
      float time = uTime * 0.115;

      vec3 qSeed = vec3(p * 1.25, time);
      vec2 q = vec2(
        fbm(qSeed + vec3(0.0, 0.0, 0.0)),
        fbm(qSeed + vec3(5.2, 1.3, 2.7))
      );

      vec2 r = vec2(
        fbm(vec3(p + q * 1.55 + vec2(1.7, 8.2), time * 1.2)),
        fbm(vec3(p + q * 1.35 + vec2(8.3, 2.8), time * 0.9 + 3.0))
      );

      float field = fbm(vec3(p + r * 1.92, time + q.x * 0.4));
      float folds = abs(field * 2.0 - 1.0);
      float silk = pow(1.0 - folds, 3.3);
      float vapor = smoothstep(0.18, 0.88, field);

      vec3 ink = vec3(0.014, 0.015, 0.025);
      vec3 plum = vec3(0.19, 0.105, 0.23);
      vec3 mineral = vec3(0.52, 0.47, 0.54);
      vec3 ember = vec3(0.74, 0.29, 0.135);
      vec3 pearl = vec3(0.93, 0.88, 0.72);
      vec3 spectral = vec3(0.10, 0.34, 0.40);

      vec3 color = mix(ink, plum, vapor * 0.88);
      color = mix(color, mineral, smoothstep(0.48, 0.78, field) * 0.58);
      color += ember * silk * (0.22 + 0.18 * q.y);
      color += pearl * pow(silk, 4.0) * 0.28;

      float foldEdge = smoothstep(0.012, 0.09, fwidth(field));
      float chroma = foldEdge * silk * (0.018 + uMotion * 0.07);
      color.r += chroma * 0.72;
      color.b += chroma * 0.96;

      float wake = exp(-abs(pointerDistance - (0.30 + uMotion * 0.08)) * 30.0);
      color += mix(spectral, pearl, 0.28) * wake * uMotion * 0.085;
      color += spectral * lens * uMotion * 0.028;

      float paletteBreath = sin(uTime * 0.055 + q.x * 2.0) * 0.5 + 0.5;
      color += mix(vec3(0.018, 0.008, 0.026), vec3(0.006, 0.022, 0.026), paletteBreath) * vapor;

      float innerMist = exp(-dot(pixel * vec2(0.68, 1.0), pixel * vec2(0.68, 1.0)) * 0.7);
      color += vec3(0.045, 0.037, 0.052) * innerMist;

      float vignette = smoothstep(1.55, 0.22, length(pixel * vec2(0.74, 0.95)));
      color *= 0.42 + vignette * 0.72;

      float grain = hash31(vec3(gl_FragCoord.xy, fract(uTime))) - 0.5;
      color += grain * 0.018;
      color = pow(max(color, 0.0), vec3(0.88));

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: fullscreenVertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(plane);

  renderer.getDrawingBufferSize(drawingBufferSize);
  uniforms.uResolution.value.copy(drawingBufferSize);

  const animate = () => {
    const { elapsed } = runtime.tick();
    const reducedMotion = prefersReducedMotion.matches;
    renderer.getDrawingBufferSize(drawingBufferSize);
    uniforms.uResolution.value.copy(drawingBufferSize);
    if (reducedMotion) {
      pointerVelocity.set(0, 0);
      previousPointer.set(0, 0);
      uniforms.uPointer.value.set(0, 0);
      uniforms.uMotion.value = 0;
    } else {
      pointerVelocity
        .lerp(pointerDelta.copy(pointer).sub(previousPointer), 0.18);
      previousPointer.copy(pointer);
      uniforms.uPointer.value.copy(pointer);
      uniforms.uMotion.value = THREE.MathUtils.clamp(
        pointerVelocity.length() * 34,
        0,
        1
      );
    }
    uniforms.uTime.value = reducedMotion ? 18.0 : elapsed;

    if (identity) {
      identity.style.setProperty(
        "--aether-motion",
        uniforms.uMotion.value.toFixed(3)
      );
      identity.style.setProperty(
        "--aether-glow",
        `${(50 + uniforms.uMotion.value * 22).toFixed(2)}px`
      );
      identity.style.setProperty(
        "--aether-glow-alpha",
        (0.08 + uniforms.uMotion.value * 0.08).toFixed(3)
      );
    }

    renderer.render(scene, camera);

    if (reducedMotion) {
      renderer.setAnimationLoop(null);
    }
  };

  renderer.setAnimationLoop(animate);

  const onMotionPreferenceChange = () => renderer.setAnimationLoop(animate);
  const onResize = () => {
    if (prefersReducedMotion.matches) {
      animate();
    }
  };
  const onVisibilityChange = () => {
    renderer.setAnimationLoop(document.hidden ? null : animate);
  };

  prefersReducedMotion.addEventListener("change", onMotionPreferenceChange);
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.addEventListener(
    "pagehide",
    () => {
      renderer.setAnimationLoop(null);
      prefersReducedMotion.removeEventListener("change", onMotionPreferenceChange);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      plane.geometry.dispose();
      material.dispose();
      runtime.dispose();
    },
    { once: true }
  );
}
