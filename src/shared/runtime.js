import * as THREE from "three";

export function createRuntime(canvas, options = {}) {
  const {
    antialias = true,
    alpha = false,
    clearColor = 0x050506,
    maxPixelRatio = 1.75
  } = options;

  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias,
      alpha,
      powerPreference: "high-performance"
    });
  } catch {
    document.documentElement.classList.add("webgl-unavailable");
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(clearColor, alpha ? 0 : 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const timer = new THREE.Timer();

  const updatePointer = (clientX, clientY) => {
    pointerTarget.set(
      (clientX / window.innerWidth) * 2 - 1,
      1 - (clientY / window.innerHeight) * 2
    );
  };

  const onPointerMove = (event) => updatePointer(event.clientX, event.clientY);
  const onPointerLeave = () => pointerTarget.set(0, 0);
  const onResize = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("resize", onResize, { passive: true });

  return {
    renderer,
    pointer,
    pointerTarget,
    timer,
    prefersReducedMotion,
    tick() {
      pointer.lerp(pointerTarget, prefersReducedMotion.matches ? 0.03 : 0.055);
      timer.update();
      return {
        delta: Math.min(timer.getDelta(), 0.05),
        elapsed: timer.getElapsed()
      };
    },
    dispose() {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    }
  };
}

export function fitPerspectiveCamera(camera) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

export const fullscreenVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;
