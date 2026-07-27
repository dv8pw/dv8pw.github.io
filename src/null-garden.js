import * as THREE from "three";
import { createRuntime, fitPerspectiveCamera } from "./shared/runtime.js";
import "./shared/base.css";
import "./null-garden.css";

const canvas = document.querySelector(".webgl");
const runtime = canvas
  ? createRuntime(canvas, {
      antialias: true,
      clearColor: 0x080b08,
      maxPixelRatio: 1.65
    })
  : null;

if (runtime) {
  const { renderer, pointer, prefersReducedMotion } = runtime;
  const isCompact =
    window.matchMedia("(max-width: 720px), (pointer: coarse)").matches ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = !isCompact;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080b08);
  scene.fog = new THREE.FogExp2(0x0b100c, isCompact ? 0.043 : 0.036);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 70);
  camera.position.set(0, 4.5, 13.8);
  fitPerspectiveCamera(camera);

  const cameraTarget = new THREE.Vector3(0, 2.15, -2.3);
  const cameraLook = cameraTarget.clone();
  camera.lookAt(cameraLook);

  const disposables = [];
  const animatedMaterials = [];
  const garden = new THREE.Group();
  garden.position.z = -1;
  scene.add(garden);

  const fract = (value) => value - Math.floor(value);
  const hash = (x, y) =>
    fract(Math.sin(x * 127.1 + y * 311.7 + 19.19) * 43758.5453123);
  const fade = (value) => value * value * (3 - 2 * value);
  const mix = (a, b, amount) => a + (b - a) * amount;

  function noise2(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = fade(fract(x));
    const fy = fade(fract(y));
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return mix(mix(a, b, fx), mix(c, d, fx), fy);
  }

  function fbm(x, y) {
    let value = 0;
    let amplitude = 0.55;
    for (let octave = 0; octave < 4; octave += 1) {
      value += amplitude * noise2(x, y);
      x = x * 1.93 + 5.2;
      y = y * 1.87 - 3.7;
      amplitude *= 0.49;
    }
    return value;
  }

  function terrainHeight(x, z) {
    const distance = Math.hypot(x * 0.88, z + 2);
    const basin = -1.08 * Math.exp(-distance * distance * 0.055);
    const strata =
      Math.sin(distance * 1.48 + fbm(x * 0.08, z * 0.08) * 3.8) * 0.19;
    const broadNoise = (fbm(x * 0.115, z * 0.115) - 0.48) * 1.24;
    return -0.72 + basin + strata + broadNoise;
  }

  const skyGeometry = new THREE.SphereGeometry(48, 24, 12);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() }
    },
    vertexShader: `
      varying vec3 vDirection;

      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDirection;
      uniform float uTime;
      uniform vec2 uPointer;

      float random(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        float horizon = smoothstep(-0.22, 0.66, vDirection.y);
        float glow = pow(max(0.0, 1.0 - length(vDirection.xy - vec2(uPointer.x * 0.035, -0.05))), 4.0);
        float grain = random(floor((vDirection.xy + uTime * 0.0008) * 240.0));
        vec3 earth = vec3(0.046, 0.052, 0.036);
        vec3 voidColor = vec3(0.010, 0.016, 0.014);
        vec3 color = mix(earth, voidColor, horizon);
        color += vec3(0.070, 0.088, 0.050) * glow;
        color += (grain - 0.5) * 0.008;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  animatedMaterials.push(skyMaterial);
  disposables.push(skyGeometry, skyMaterial);
  scene.add(new THREE.Mesh(skyGeometry, skyMaterial));

  const terrainSegments = isCompact ? [58, 46] : [104, 82];
  const terrainGeometry = new THREE.PlaneGeometry(
    36,
    32,
    terrainSegments[0],
    terrainSegments[1]
  );
  terrainGeometry.rotateX(-Math.PI / 2);

  const terrainPositions = terrainGeometry.attributes.position;
  const terrainColors = new Float32Array(terrainPositions.count * 3);
  const lowColor = new THREE.Color(0x11150f);
  const highColor = new THREE.Color(0x39412a);
  const soilColor = new THREE.Color();

  for (let index = 0; index < terrainPositions.count; index += 1) {
    const x = terrainPositions.getX(index);
    const z = terrainPositions.getZ(index);
    const height = terrainHeight(x, z);
    terrainPositions.setY(index, height);

    const colorMix = THREE.MathUtils.clamp(
      0.18 + (height + 1.7) * 0.29 + noise2(x * 0.5, z * 0.5) * 0.14,
      0,
      1
    );
    soilColor.copy(lowColor).lerp(highColor, colorMix);
    terrainColors[index * 3] = soilColor.r;
    terrainColors[index * 3 + 1] = soilColor.g;
    terrainColors[index * 3 + 2] = soilColor.b;
  }

  terrainGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(terrainColors, 3)
  );
  terrainGeometry.computeVertexNormals();

  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x80906a,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.03,
    flatShading: true
  });
  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrain.receiveShadow = !isCompact;
  garden.add(terrain);
  disposables.push(terrainGeometry, terrainMaterial);

  const rootPositions = [];
  const rootColors = [];
  const rootDark = new THREE.Color(0x38452d);
  const rootLight = new THREE.Color(0x9ba969);
  const rootColor = new THREE.Color();

  for (let ribbon = 0; ribbon < 11; ribbon += 1) {
    const phase = ribbon * 1.91;
    const radiusBase = 3.1 + ribbon * 0.83;
    const steps = isCompact ? 34 : 55;
    for (let step = 0; step < steps - 1; step += 1) {
      const t0 = step / (steps - 1);
      const t1 = (step + 1) / (steps - 1);
      const angle0 = phase + t0 * (Math.PI * 1.35 + ribbon * 0.08);
      const angle1 = phase + t1 * (Math.PI * 1.35 + ribbon * 0.08);
      const radius0 = radiusBase + Math.sin(t0 * Math.PI * 3 + phase) * 0.35;
      const radius1 = radiusBase + Math.sin(t1 * Math.PI * 3 + phase) * 0.35;
      const x0 = Math.cos(angle0) * radius0;
      const z0 = Math.sin(angle0) * radius0 - 2;
      const x1 = Math.cos(angle1) * radius1;
      const z1 = Math.sin(angle1) * radius1 - 2;
      rootPositions.push(
        x0,
        terrainHeight(x0, z0) + 0.035,
        z0,
        x1,
        terrainHeight(x1, z1) + 0.035,
        z1
      );
      rootColor
        .copy(rootDark)
        .lerp(rootLight, 0.12 + (ribbon % 4) * 0.06);
      for (let vertex = 0; vertex < 2; vertex += 1) {
        rootColors.push(rootColor.r, rootColor.g, rootColor.b);
      }
    }
  }

  const rootsGeometry = new THREE.BufferGeometry();
  rootsGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(rootPositions, 3)
  );
  rootsGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(rootColors, 3)
  );
  const rootsMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const roots = new THREE.LineSegments(rootsGeometry, rootsMaterial);
  roots.renderOrder = 1;
  garden.add(roots);
  disposables.push(rootsGeometry, rootsMaterial);

  const monolithGeometry = new THREE.IcosahedronGeometry(1, isCompact ? 2 : 3);
  const monolithPositions = monolithGeometry.attributes.position;
  const monolithColors = new Float32Array(monolithPositions.count * 3);
  const stoneLow = new THREE.Color(0x070907);
  const stoneHigh = new THREE.Color(0x263026);
  const stoneColor = new THREE.Color();

  for (let index = 0; index < monolithPositions.count; index += 1) {
    const x = monolithPositions.getX(index);
    const y = monolithPositions.getY(index);
    const z = monolithPositions.getZ(index);
    const deformation =
      0.93 +
      (noise2(x * 4.6 + y, z * 4.4 - y) - 0.5) * 0.18 +
      Math.sin((x + z) * 8.0) * 0.018;
    monolithPositions.setXYZ(
      index,
      x * deformation,
      y * (deformation + Math.abs(x) * 0.035),
      z * deformation
    );
    stoneColor
      .copy(stoneLow)
      .lerp(stoneHigh, THREE.MathUtils.clamp(0.15 + y * 0.17, 0, 0.72));
    monolithColors[index * 3] = stoneColor.r;
    monolithColors[index * 3 + 1] = stoneColor.g;
    monolithColors[index * 3 + 2] = stoneColor.b;
  }

  monolithGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(monolithColors, 3)
  );
  monolithGeometry.computeVertexNormals();

  const monolithMaterial = new THREE.MeshStandardMaterial({
    color: 0x849080,
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.46,
    flatShading: true
  });
  const monolith = new THREE.Mesh(monolithGeometry, monolithMaterial);
  monolith.position.set(0, 2.35, -2.8);
  monolith.scale.set(2.1, 4.55, 1.18);
  monolith.rotation.set(-0.025, -0.12, 0.018);
  monolith.castShadow = !isCompact;
  monolith.receiveShadow = !isCompact;
  garden.add(monolith);
  disposables.push(monolithGeometry, monolithMaterial);

  const facetGeometry = new THREE.EdgesGeometry(monolithGeometry, 19);
  const facetMaterial = new THREE.LineBasicMaterial({
    color: 0x839273,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const facets = new THREE.LineSegments(facetGeometry, facetMaterial);
  facets.renderOrder = 2;
  monolith.add(facets);
  disposables.push(facetGeometry, facetMaterial);

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x313824,
    emissive: 0x11180d,
    emissiveIntensity: 0.58,
    roughness: 0.48,
    metalness: 0.6
  });
  disposables.push(ringMaterial);

  for (let ring = 0; ring < 5; ring += 1) {
    const radius = 2.8 + ring * 1.24;
    const geometry = new THREE.TorusGeometry(
      radius,
      0.025 + ring * 0.008,
      5,
      isCompact ? 64 : 96
    );
    const mesh = new THREE.Mesh(geometry, ringMaterial);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(
      0,
      terrainHeight(radius * 0.7, -2) + 0.12 - ring * 0.025,
      -2
    );
    mesh.scale.z = 0.78;
    garden.add(mesh);
    disposables.push(geometry);
  }

  const stalkCount = isCompact ? 110 : 260;
  const stalkGeometry = new THREE.ConeGeometry(
    0.115,
    1,
    5,
    isCompact ? 2 : 3,
    false
  );
  stalkGeometry.translate(0, 0.5, 0);
  const stalkMaterial = new THREE.MeshStandardMaterial({
    color: 0x566444,
    roughness: 0.72,
    metalness: 0.12,
    flatShading: true,
    vertexColors: false
  });

  stalkMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
        #include <begin_vertex>
        float sway = sin(uTime * 0.42 + position.y * 2.8) * position.y;
        transformed.x += sway * 0.022;
        transformed.z += cos(uTime * 0.31 + position.y * 2.1) * position.y * 0.015;
      `
    );
    stalkMaterial.userData.shader = shader;
  };

  const stalks = new THREE.InstancedMesh(
    stalkGeometry,
    stalkMaterial,
    stalkCount
  );
  const dummy = new THREE.Object3D();
  const stalkColor = new THREE.Color();
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < stalkCount; index += 1) {
    const randomA = hash(index, 8.1);
    const randomB = hash(index, 22.7);
    const angle = index * goldenAngle + randomA * 0.72;
    const radius = 2.7 + Math.sqrt((index + 2) / stalkCount) * 13.2;
    const x = Math.cos(angle) * radius * (0.78 + randomB * 0.28);
    const z = Math.sin(angle) * radius - 2;
    const height =
      (0.45 + Math.pow(randomB, 1.8) * 2.65) *
      THREE.MathUtils.clamp(1.22 - radius * 0.025, 0.7, 1.2);
    const width = 0.6 + randomA * 0.75;

    dummy.position.set(x, terrainHeight(x, z) - 0.02, z);
    dummy.rotation.set(
      (randomB - 0.5) * 0.14,
      angle + randomA,
      (randomA - 0.5) * 0.19
    );
    dummy.scale.set(width, height, width);
    dummy.updateMatrix();
    stalks.setMatrixAt(index, dummy.matrix);

    stalkColor.setHSL(
      0.19 + randomA * 0.055,
      0.24 + randomB * 0.14,
      0.13 + randomB * 0.12
    );
    stalks.setColorAt(index, stalkColor);
  }

  stalks.instanceMatrix.needsUpdate = true;
  if (stalks.instanceColor) stalks.instanceColor.needsUpdate = true;
  stalks.castShadow = !isCompact;
  stalks.receiveShadow = !isCompact;
  garden.add(stalks);
  disposables.push(stalkGeometry, stalkMaterial);

  const crownCount = isCompact ? 34 : 74;
  const crownGeometry = new THREE.OctahedronGeometry(0.14, 0);
  const crownMaterial = new THREE.MeshStandardMaterial({
    color: 0x9b9b67,
    roughness: 0.38,
    metalness: 0.48,
    flatShading: true
  });
  const crowns = new THREE.InstancedMesh(
    crownGeometry,
    crownMaterial,
    crownCount
  );

  for (let index = 0; index < crownCount; index += 1) {
    const randomA = hash(index, 71.2);
    const randomB = hash(index, 41.9);
    const angle = index * goldenAngle + 0.7;
    const radius = 4 + Math.sqrt((index + 1) / crownCount) * 10.5;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 2;
    const height = 0.7 + randomA * 2.15;
    const size = 0.55 + randomB * 0.92;

    dummy.position.set(x, terrainHeight(x, z) + height, z);
    dummy.rotation.set(randomA * Math.PI, angle, randomB * Math.PI);
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    crowns.setMatrixAt(index, dummy.matrix);
  }

  crowns.instanceMatrix.needsUpdate = true;
  garden.add(crowns);
  disposables.push(crownGeometry, crownMaterial);

  const sporeCount = isCompact ? 180 : 430;
  const sporePositions = new Float32Array(sporeCount * 3);
  const sporeSizes = new Float32Array(sporeCount);

  for (let index = 0; index < sporeCount; index += 1) {
    const angle = hash(index, 3.3) * Math.PI * 2;
    const radius = 2.2 + Math.pow(hash(index, 4.4), 0.62) * 15;
    sporePositions[index * 3] = Math.cos(angle) * radius;
    sporePositions[index * 3 + 1] =
      terrainHeight(
        sporePositions[index * 3],
        Math.sin(angle) * radius - 2
      ) +
      0.5 +
      hash(index, 5.5) * 6.8;
    sporePositions[index * 3 + 2] = Math.sin(angle) * radius - 2;
    sporeSizes[index] = 1.2 + hash(index, 6.6) * 2.8;
  }

  const sporeGeometry = new THREE.BufferGeometry();
  sporeGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(sporePositions, 3)
  );
  sporeGeometry.setAttribute(
    "aSize",
    new THREE.BufferAttribute(sporeSizes, 1)
  );
  const sporeMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: `
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vFade;

      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.14 + position.y * 1.7) * 0.12;
        p.y += sin(uTime * 0.19 + position.x * 0.8) * 0.09;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uPixelRatio * (45.0 / max(1.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
        vFade = 1.0 - smoothstep(4.0, 30.0, -mvPosition.z);
      }
    `,
    fragmentShader: `
      varying float vFade;

      void main() {
        float distanceToCenter = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.05, distanceToCenter) * 0.42 * vFade;
        gl_FragColor = vec4(vec3(0.60, 0.68, 0.39), alpha);
      }
    `
  });
  const spores = new THREE.Points(sporeGeometry, sporeMaterial);
  garden.add(spores);
  animatedMaterials.push(sporeMaterial);
  disposables.push(sporeGeometry, sporeMaterial);

  scene.add(new THREE.HemisphereLight(0x718578, 0x1b160e, 0.58));

  const keyLight = new THREE.DirectionalLight(0xc6d7b5, 2.65);
  keyLight.position.set(-7, 10, 7);
  keyLight.target.position.set(0, 0, -3);
  keyLight.castShadow = !isCompact;
  if (!isCompact) {
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 35;
    keyLight.shadow.camera.left = -12;
    keyLight.shadow.camera.right = 12;
    keyLight.shadow.camera.top = 12;
    keyLight.shadow.camera.bottom = -12;
    keyLight.shadow.bias = -0.00045;
    keyLight.shadow.normalBias = 0.035;
  }
  scene.add(keyLight, keyLight.target);

  const underLight = new THREE.PointLight(0xa3b456, 35, 11, 2);
  underLight.position.set(0, -0.2, -1.8);
  scene.add(underLight);

  const rimLight = new THREE.SpotLight(
    0x9daac6,
    170,
    38,
    Math.PI * 0.18,
    0.72,
    2
  );
  rimLight.position.set(7, 7, -11);
  rimLight.target.position.set(0, 2, -2.5);
  scene.add(rimLight, rimLight.target);

  const clockState = { elapsed: 0 };

  function resize() {
    fitPerspectiveCamera(camera);
    sporeMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    if (prefersReducedMotion.matches) {
      render();
    }
  }

  function render() {
    const { delta, elapsed } = runtime.tick();
    const reducedMotion = prefersReducedMotion.matches;
    const timeScale = reducedMotion ? 0 : 1;
    clockState.elapsed += delta * timeScale;

    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      reducedMotion ? 0 : pointer.x * 0.72,
      2.2,
      delta
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      4.5 + (reducedMotion ? 0 : pointer.y * 0.3),
      2.2,
      delta
    );
    cameraLook.x = THREE.MathUtils.damp(
      cameraLook.x,
      reducedMotion ? 0 : pointer.x * 0.38,
      2,
      delta
    );
    cameraLook.y = THREE.MathUtils.damp(
      cameraLook.y,
      cameraTarget.y + (reducedMotion ? 0 : pointer.y * 0.13),
      2,
      delta
    );
    camera.lookAt(cameraLook);

    garden.rotation.y = reducedMotion
      ? 0
      : Math.sin(elapsed * 0.075) * 0.012 + pointer.x * 0.009;
    monolith.rotation.y =
      -0.12 + (reducedMotion ? 0 : Math.sin(elapsed * 0.1) * 0.014);
    facetMaterial.opacity =
      0.17 + (reducedMotion ? 0 : Math.sin(elapsed * 0.42) * 0.035);
    underLight.intensity =
      34 + (reducedMotion ? 0 : Math.sin(elapsed * 0.36) * 4);

    skyMaterial.uniforms.uTime.value = clockState.elapsed;
    if (reducedMotion) {
      skyMaterial.uniforms.uPointer.value.set(0, 0);
    } else {
      skyMaterial.uniforms.uPointer.value.copy(pointer);
    }
    sporeMaterial.uniforms.uTime.value = clockState.elapsed;
    if (stalkMaterial.userData.shader) {
      stalkMaterial.userData.shader.uniforms.uTime.value = clockState.elapsed;
    }

    renderer.render(scene, camera);

    if (reducedMotion) {
      renderer.setAnimationLoop(null);
    }
  }

  const onMotionPreferenceChange = () => renderer.setAnimationLoop(render);

  window.addEventListener("resize", resize, { passive: true });
  prefersReducedMotion.addEventListener("change", onMotionPreferenceChange);
  renderer.setAnimationLoop(render);

  window.addEventListener(
    "pagehide",
    () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      prefersReducedMotion.removeEventListener("change", onMotionPreferenceChange);
      animatedMaterials.length = 0;
      disposables.forEach((item) => item.dispose());
      runtime.dispose();
    },
    { once: true }
  );
}
