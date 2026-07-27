import * as THREE from "three";
import { createRuntime, fitPerspectiveCamera } from "./shared/runtime.js";
import "./shared/base.css";
import "./null-garden.css";

const canvas = document.querySelector(".webgl");
const identity = document.querySelector(".identity");
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
  const motionStrength = isCompact ? 0.58 : 1;

  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = !isCompact;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080a);
  scene.fog = new THREE.FogExp2(0x071113, isCompact ? 0.041 : 0.033);

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
  const orbitalRings = [];

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
        vec2 drift = vec2(uTime * 0.0022, -uTime * 0.0011);
        float glow = pow(max(0.0, 1.0 - length(vDirection.xy - vec2(uPointer.x * 0.035, -0.05))), 4.0);
        float veilNoise = random(floor((vDirection.xz + drift) * 34.0));
        float veil = sin(
          vDirection.x * 10.0 +
          vDirection.y * 5.0 +
          veilNoise * 2.6 +
          uTime * 0.028
        ) * 0.5 + 0.5;
        veil *= smoothstep(-0.34, 0.05, vDirection.y) *
          (1.0 - smoothstep(0.20, 0.66, vDirection.y));
        float grain = random(floor((vDirection.xy + uTime * 0.0008) * 240.0));
        float aurora = pow(veil, 2.2) * (0.28 + 0.72 * sin(vDirection.x * 5.0 - uTime * 0.018) * 0.5 + 0.36);
        float polar = smoothstep(-0.24, 0.03, vDirection.y) *
          (1.0 - smoothstep(0.24, 0.7, vDirection.y));
        vec3 earth = vec3(0.030, 0.048, 0.039);
        vec3 voidColor = vec3(0.004, 0.009, 0.015);
        vec3 color = mix(earth, voidColor, horizon);
        color += vec3(0.030, 0.145, 0.125) * glow;
        color += mix(
          vec3(0.015, 0.18, 0.16),
          vec3(0.21, 0.028, 0.18),
          sin(vDirection.x * 7.0 + uTime * 0.012) * 0.5 + 0.5
        ) * aurora * polar * 0.34;
        color += vec3(0.19, 0.11, 0.025) * pow(veil, 8.0) * polar * 0.22;
        color += (grain - 0.5) * 0.008;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  animatedMaterials.push(skyMaterial);
  disposables.push(skyGeometry, skyMaterial);
  scene.add(new THREE.Mesh(skyGeometry, skyMaterial));

  const environmentScene = new THREE.Scene();
  environmentScene.background = new THREE.Color(0x010305);
  const environmentRoomGeometry = new THREE.SphereGeometry(28, 24, 12);
  const environmentRoomMaterial = new THREE.MeshBasicMaterial({
    color: 0x081114,
    side: THREE.BackSide
  });
  environmentScene.add(
    new THREE.Mesh(environmentRoomGeometry, environmentRoomMaterial)
  );

  const environmentPanelGeometry = new THREE.PlaneGeometry(10, 18);
  const environmentPanelColors = [
    [0x16ffe0, [-9, 3, 2], [2.2, 1, 1]],
    [0xff2fcf, [8, 5, -4], [1.35, 1, 1]],
    [0xffb13b, [1, -8, 2], [1.8, 0.8, 1]],
    [0x5276ff, [-2, 8, -9], [1.4, 0.55, 1]]
  ];
  const environmentPanelMaterials = [];

  environmentPanelColors.forEach(([color, position, scale]) => {
    const panelMaterial = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const panel = new THREE.Mesh(environmentPanelGeometry, panelMaterial);
    panel.position.fromArray(position);
    panel.scale.fromArray(scale);
    panel.lookAt(0, 0, 0);
    environmentScene.add(panel);
    environmentPanelMaterials.push(panelMaterial);
  });

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmremGenerator.fromScene(
    environmentScene,
    0.035,
    0.1,
    80,
    { size: isCompact ? 128 : 256 }
  );
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = isCompact ? 0.85 : 1.16;
  pmremGenerator.dispose();
  environmentRoomGeometry.dispose();
  environmentRoomMaterial.dispose();
  environmentPanelGeometry.dispose();
  environmentPanelMaterials.forEach((material) => material.dispose());
  disposables.push(environmentTarget);

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
  const lowColor = new THREE.Color(0x07100e);
  const highColor = new THREE.Color(0x25463d);
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
    color: 0x71968b,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.03,
    emissive: 0x071c19,
    emissiveIntensity: 0.2,
    flatShading: true
  });
  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrain.receiveShadow = !isCompact;
  garden.add(terrain);
  disposables.push(terrainGeometry, terrainMaterial);

  const poolY = terrainHeight(0, -2) + 0.16;
  const poolGeometry = new THREE.CircleGeometry(
    6.2,
    isCompact ? 64 : 112
  );
  poolGeometry.rotateX(-Math.PI / 2);
  const poolMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x061417,
    roughness: isCompact ? 0.18 : 0.075,
    metalness: 0.96,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    iridescence: isCompact ? 0.24 : 0.7,
    iridescenceIOR: 1.52,
    iridescenceThicknessRange: [160, 520],
    emissive: 0x031110,
    emissiveIntensity: 0.32,
    side: THREE.DoubleSide
  });
  const mirrorPool = new THREE.Mesh(poolGeometry, poolMaterial);
  mirrorPool.position.set(0, poolY, -2);
  mirrorPool.receiveShadow = !isCompact;
  mirrorPool.renderOrder = 1;
  garden.add(mirrorPool);
  disposables.push(poolGeometry, poolMaterial);

  const causticGeometry = new THREE.RingGeometry(
    0.72,
    6.12,
    isCompact ? 72 : 128,
    1
  );
  causticGeometry.rotateX(-Math.PI / 2);
  const causticMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uPointer;

      void main() {
        vec2 p = vUv - 0.5;
        p += uPointer * 0.006;
        float radius = length(p) * 2.0;
        float angle = atan(p.y, p.x);
        float spiral = sin(radius * 49.0 - angle * 9.0 - uTime * 0.34);
        float counter = sin(radius * 32.0 + angle * 13.0 + uTime * 0.21);
        float veins = pow(max(0.0, spiral * counter), 7.0);
        float rings = pow(max(0.0, sin(radius * 61.0 - uTime * 0.16)), 18.0);
        float fade = smoothstep(1.0, 0.72, radius) *
          smoothstep(0.08, 0.28, radius);
        vec3 cyan = vec3(0.05, 0.95, 0.82);
        vec3 orchid = vec3(0.92, 0.09, 0.75);
        vec3 gold = vec3(1.0, 0.56, 0.12);
        vec3 color = mix(cyan, orchid, sin(angle * 2.0 - uTime * 0.08) * 0.5 + 0.5);
        color = mix(color, gold, rings * 0.48);
        float alpha = fade * (veins * 0.22 + rings * 0.055);
        gl_FragColor = vec4(color, alpha);
      }
    `
  });
  const poolCaustics = new THREE.Mesh(causticGeometry, causticMaterial);
  poolCaustics.position.set(0, poolY + 0.028, -2);
  poolCaustics.renderOrder = 2;
  garden.add(poolCaustics);
  animatedMaterials.push(causticMaterial);
  disposables.push(causticGeometry, causticMaterial);

  const rootPositions = [];
  const rootColors = [];
  const rootDark = new THREE.Color(0x123f3d);
  const rootLight = new THREE.Color(0x72e6ca);
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
  const stoneLow = new THREE.Color(0x030809);
  const stoneHigh = new THREE.Color(0x245a58);
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

  const monolithClearcoat = isCompact ? 0.42 : 0.86;
  const monolithMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x92c5bd,
    vertexColors: true,
    roughness: isCompact ? 0.24 : 0.13,
    metalness: 0.76,
    clearcoat: isCompact ? 0.42 : 0.86,
    clearcoatRoughness: 0.16,
    iridescence: isCompact ? 0.18 : 0.72,
    iridescenceIOR: 1.48,
    iridescenceThicknessRange: [110, 470],
    sheen: isCompact ? 0 : 0.22,
    sheenColor: 0x8bfff0,
    sheenRoughness: 0.44,
    emissive: 0x061a1b,
    emissiveIntensity: 0.3,
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
    color: 0x8cfff0,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const facets = new THREE.LineSegments(facetGeometry, facetMaterial);
  facets.renderOrder = 2;
  monolith.add(facets);
  disposables.push(facetGeometry, facetMaterial);

  const shellMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() }
    },
    vertexShader: `
      uniform float uTime;
      uniform vec2 uPointer;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying float vHeight;

      void main() {
        float pulse = sin(
          position.y * 3.4 +
          position.x * 2.2 -
          uTime * 0.38 +
          uPointer.x * 1.5
        );
        vec3 displaced = position + normal * (0.012 + pulse * 0.006);
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        vHeight = position.y;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec2 uPointer;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying float vHeight;

      void main() {
        float fresnel = pow(
          1.0 - clamp(dot(vViewDirection, normalize(vNormal)), 0.0, 1.0),
          2.7
        );
        float scan = pow(
          1.0 - abs(sin(vHeight * 7.0 - uTime * 0.31 + uPointer.y)),
          14.0
        );
        float alpha = fresnel * (0.045 + scan * 0.11);
        vec3 color = mix(
          vec3(0.02, 0.92, 0.78),
          vec3(0.98, 0.11, 0.76),
          scan
        );
        color = mix(color, vec3(1.0, 0.62, 0.18), fresnel * 0.24);
        gl_FragColor = vec4(color, alpha);
      }
    `
  });
  const ghostShell = new THREE.Mesh(monolithGeometry, shellMaterial);
  ghostShell.scale.setScalar(1.026);
  ghostShell.renderOrder = 3;
  monolith.add(ghostShell);
  animatedMaterials.push(shellMaterial);
  disposables.push(shellMaterial);

  const spectralCrown = new THREE.Group();
  spectralCrown.position.copy(monolith.position);
  garden.add(spectralCrown);

  const prismCount = isCompact ? 12 : 22;
  const prismGeometry = new THREE.OctahedronGeometry(0.21, 0);
  prismGeometry.scale(0.44, 1.9, 0.44);
  const prismMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd8fffa,
    vertexColors: true,
    roughness: 0.12,
    metalness: 0.68,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    iridescence: isCompact ? 0.25 : 0.9,
    iridescenceIOR: 1.56,
    iridescenceThicknessRange: [100, 560],
    emissive: 0x082a29,
    emissiveIntensity: 0.34,
    flatShading: true
  });
  const prisms = new THREE.InstancedMesh(
    prismGeometry,
    prismMaterial,
    prismCount
  );
  const prismDummy = new THREE.Object3D();
  const prismColor = new THREE.Color();
  const prismPalette = [0x4ffff0, 0xff48cf, 0xffb642, 0x7796ff];

  for (let index = 0; index < prismCount; index += 1) {
    const angle = (index / prismCount) * Math.PI * 2;
    const radius = 2.72 + Math.sin(index * 2.17) * 0.28;
    prismDummy.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * (3.35 + Math.cos(index * 1.3) * 0.16),
      -0.16 + Math.sin(index * 1.91) * 0.58
    );
    prismDummy.rotation.set(
      angle * 0.7,
      -angle + Math.PI * 0.5,
      angle + Math.PI * 0.5
    );
    prismDummy.scale.setScalar(0.62 + hash(index, 93.2) * 0.72);
    prismDummy.updateMatrix();
    prisms.setMatrixAt(index, prismDummy.matrix);
    prismColor
      .set(prismPalette[index % prismPalette.length])
      .multiplyScalar(0.72 + hash(index, 11.4) * 0.28);
    prisms.setColorAt(index, prismColor);
  }
  prisms.instanceMatrix.needsUpdate = true;
  if (prisms.instanceColor) prisms.instanceColor.needsUpdate = true;
  spectralCrown.add(prisms);
  disposables.push(prismGeometry, prismMaterial);

  const spectralArcs = [];
  const arcPalette = [0x4ffff0, 0xff43ca, 0xffbd55, 0x758fff, 0x91fff0];
  const arcGroup = new THREE.Group();
  arcGroup.position.copy(monolith.position);
  garden.add(arcGroup);

  for (let index = 0; index < 6; index += 1) {
    const arcGeometry = new THREE.TorusGeometry(
      2.45 + index * 0.31,
      0.009 + (index % 2) * 0.006,
      4,
      isCompact ? 72 : 112,
      Math.PI * (0.48 + index * 0.075)
    );
    const arcMaterial = new THREE.MeshBasicMaterial({
      color: arcPalette[index % arcPalette.length],
      transparent: true,
      opacity: 0.18 + (index % 3) * 0.035,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const arc = new THREE.Mesh(arcGeometry, arcMaterial);
    arc.rotation.z = index * 1.13 - 1.8;
    arc.rotation.x = (index - 2.5) * 0.035;
    arc.position.z = -0.35 + index * 0.12;
    arc.userData.phase = index * 1.37;
    arcGroup.add(arc);
    spectralArcs.push(arc);
    disposables.push(arcGeometry, arcMaterial);
  }

  const tendrilGroup = new THREE.Group();
  tendrilGroup.position.copy(monolith.position);
  garden.add(tendrilGroup);
  const tendrilColors = [0x48ffe8, 0xff47c8, 0xffb64d];

  for (let strand = 0; strand < 3; strand += 1) {
    const points = [];
    const turns = 22;
    for (let index = 0; index < turns; index += 1) {
      const angle = (index / turns) * Math.PI * 2;
      const phase = strand * 2.094;
      points.push(
        new THREE.Vector3(
          Math.cos(angle + phase) * (2.3 + strand * 0.17),
          Math.sin(angle) * (4.75 - strand * 0.25),
          Math.sin(angle * 2 + phase) * (0.48 + strand * 0.1)
        )
      );
    }
    const curve = new THREE.CatmullRomCurve3(points, true, "centripetal");
    const geometry = new THREE.TubeGeometry(
      curve,
      isCompact ? 72 : 112,
      0.012 + strand * 0.003,
      4,
      true
    );
    const material = new THREE.MeshBasicMaterial({
      color: tendrilColors[strand],
      transparent: true,
      opacity: 0.14 - strand * 0.02,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const tendril = new THREE.Mesh(geometry, material);
    tendril.userData.phase = strand * 1.7;
    tendrilGroup.add(tendril);
    disposables.push(geometry, material);
  }

  const auraGeometry = new THREE.PlaneGeometry(11.5, 12.5);
  const auraCurrentExpression = isCompact
    ? `0.5 + 0.5 * sin(
        p.x * 9.0 +
        p.y * 7.0 +
        uTime * 0.04 +
        sin(p.y * 11.0 - uTime * 0.02)
      )`
    : `noise(
        p * 4.2 +
        vec2(cos(angle), sin(angle)) * 0.35 +
        vec2(uTime * 0.012, -uTime * 0.008)
      )`;
  const auraMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uPointer;

      float random(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec2 p = vUv - 0.5;
        p.x *= 0.88;
        p -= uPointer * vec2(0.008, 0.005);
        float radius = length(p);
        float angle = atan(p.y, p.x);
        float current = ${auraCurrentExpression};
        float breath = 0.5 + 0.5 * sin(uTime * 0.18 + current * 4.0);
        float body = smoothstep(0.53, 0.08, radius);
        float hollow = smoothstep(0.04, 0.22, radius);
        float outerRing = smoothstep(0.46, 0.27, radius) *
          smoothstep(0.13, 0.3, radius);
        float alpha = body * hollow * (0.02 + current * 0.046);
        alpha += outerRing * (0.012 + breath * 0.018);
        vec3 color = mix(
          vec3(0.02, 0.86, 0.72),
          vec3(0.89, 0.08, 0.68),
          current
        );
        color = mix(color, vec3(1.0, 0.58, 0.16), outerRing * breath * 0.36);
        gl_FragColor = vec4(color, alpha);
      }
    `
  });
  const aura = new THREE.Mesh(auraGeometry, auraMaterial);
  aura.position.set(0, 2.45, -3.72);
  aura.quaternion.copy(camera.quaternion);
  aura.renderOrder = -1;
  scene.add(aura);
  animatedMaterials.push(auraMaterial);
  disposables.push(auraGeometry, auraMaterial);

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b8278,
    emissive: 0x063d38,
    emissiveIntensity: 0.88,
    roughness: 0.2,
    metalness: 0.86
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
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.phase = ring * 1.37;
    mesh.userData.baseScale = 1 + ring * 0.008;
    orbitalRings.push(mesh);
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
    color: 0x3b756c,
    roughness: 0.6,
    metalness: 0.24,
    flatShading: true,
    vertexColors: false
  });

  stalkMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uPointer = { value: new THREE.Vector2() };
    shader.vertexShader =
      `uniform float uTime;\nuniform vec2 uPointer;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
        #include <begin_vertex>
        vec3 instanceOffset = vec3(0.0);
        #ifdef USE_INSTANCING
          instanceOffset = instanceMatrix[3].xyz;
        #endif
        float phase = dot(instanceOffset.xz, vec2(0.73, 0.41));
        float slowCurrent = sin(uTime * 0.19 + phase * 0.37) * 0.5 + 0.5;
        float sway = sin(
          uTime * (0.34 + slowCurrent * 0.08) +
          phase +
          position.y * 2.8
        ) * position.y;
        transformed.x += sway * (0.014 + slowCurrent * 0.012);
        transformed.x += uPointer.x * position.y * 0.007;
        transformed.z += cos(
          uTime * 0.27 +
          phase * 1.31 +
          position.y * 2.1
        ) * position.y * 0.016;
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
      0.43 + randomA * 0.12,
      0.34 + randomB * 0.26,
      0.12 + randomB * 0.16
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
    color: 0xa5eee0,
    emissive: 0x072b2b,
    emissiveIntensity: 0.16,
    roughness: 0.2,
    metalness: 0.74,
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
      uPixelRatio: { value: renderer.getPixelRatio() },
      uPointer: { value: new THREE.Vector2() }
    },
    vertexShader: `
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec2 uPointer;
      varying float vFade;
      varying float vShimmer;

      void main() {
        vec3 p = position;
        float seed = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float current = sin(uTime * 0.11 + position.y * 0.82 + seed * 6.2831);
        p.x += current * (0.08 + seed * 0.11);
        p.x += uPointer.x * (0.025 + seed * 0.025);
        p.y += sin(uTime * (0.13 + seed * 0.08) + position.x * 0.54) * 0.12;
        p.z += cos(uTime * 0.09 + position.x * 0.31 + seed * 4.0) * 0.08;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uPixelRatio * (45.0 / max(1.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
        vFade = 1.0 - smoothstep(4.0, 30.0, -mvPosition.z);
        vShimmer = 0.68 + 0.32 * sin(uTime * 0.43 + seed * 12.0);
      }
    `,
    fragmentShader: `
      varying float vFade;
      varying float vShimmer;

      void main() {
        float distanceToCenter = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.05, distanceToCenter) *
          0.42 * vFade * vShimmer;
        vec3 color = mix(
          vec3(0.20, 1.0, 0.82),
          vec3(1.0, 0.18, 0.72),
          vShimmer
        );
        gl_FragColor = vec4(color, alpha);
      }
    `
  });
  const spores = new THREE.Points(sporeGeometry, sporeMaterial);
  garden.add(spores);
  animatedMaterials.push(sporeMaterial);
  disposables.push(sporeGeometry, sporeMaterial);

  const hemisphereLight = new THREE.HemisphereLight(
    0x76d9d1,
    0x1c071c,
    0.72
  );
  scene.add(hemisphereLight);

  const keyLight = new THREE.DirectionalLight(0xc7fff5, 3.3);
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

  const underLight = new THREE.PointLight(0x28ffe0, 58, 13, 2);
  underLight.position.set(0, -0.2, -1.8);
  scene.add(underLight);

  const rimLight = new THREE.SpotLight(
    0xff37c5,
    230,
    38,
    Math.PI * 0.18,
    0.72,
    2
  );
  rimLight.position.set(7, 7, -11);
  rimLight.target.position.set(0, 2, -2.5);
  scene.add(rimLight, rimLight.target);

  const emberLight = new THREE.PointLight(0xff9a32, 42, 15, 2);
  emberLight.position.set(-4.8, 1.2, 0.4);
  scene.add(emberLight);

  const clockState = { elapsed: 0 };
  let lastIdentityX = Number.NaN;
  let lastIdentityY = Number.NaN;

  function updateIdentity(reducedMotion) {
    if (!identity) return;

    const x = reducedMotion ? 0 : pointer.x * 4.5 * motionStrength;
    const y = reducedMotion ? 0 : -pointer.y * 3.2 * motionStrength;
    if (x === lastIdentityX && y === lastIdentityY) return;

    identity.style.transform =
      `translate(calc(-50% + ${x.toFixed(3)}px), ` +
      `calc(-50% + ${y.toFixed(3)}px))`;
    lastIdentityX = x;
    lastIdentityY = y;
  }

  function resize() {
    fitPerspectiveCamera(camera);
    sporeMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    if (prefersReducedMotion.matches) {
      render();
    }
  }

  function render() {
    const { delta } = runtime.tick();
    const reducedMotion = prefersReducedMotion.matches;
    const timeScale = reducedMotion ? 0 : 1;
    clockState.elapsed += delta * timeScale;
    const motionTime = clockState.elapsed;
    const activePointerX = reducedMotion ? 0 : pointer.x * motionStrength;
    const activePointerY = reducedMotion ? 0 : pointer.y * motionStrength;

    camera.position.x = activePointerX * 0.66;
    camera.position.y = 4.5 + activePointerY * 0.28;
    camera.position.z = reducedMotion
      ? 13.8
      : 13.8 + Math.sin(motionTime * 0.105) * 0.045 * motionStrength;
    cameraLook.x = activePointerX * 0.36;
    cameraLook.y = cameraTarget.y + activePointerY * 0.13;
    camera.lookAt(cameraLook);
    camera.rotation.z = reducedMotion
      ? 0
      : (-activePointerX * 0.0018 +
          Math.sin(motionTime * 0.13) * 0.00055) *
        motionStrength;

    garden.rotation.y = reducedMotion
      ? 0
      : Math.sin(motionTime * 0.075) * 0.013 + activePointerX * 0.01;
    garden.position.x = reducedMotion ? 0 : -activePointerX * 0.045;
    monolith.position.y =
      2.35 +
      (reducedMotion
        ? 0
        : Math.sin(motionTime * 0.16) * 0.018 * motionStrength);
    monolith.rotation.x =
      -0.025 +
      (reducedMotion
        ? 0
        : Math.sin(motionTime * 0.12 + 0.8) * 0.004 * motionStrength);
    monolith.rotation.y =
      -0.12 +
      (reducedMotion
        ? 0
        : Math.sin(motionTime * 0.1) * 0.016 +
          activePointerX * 0.009);
    monolith.rotation.z =
      0.018 +
      (reducedMotion
        ? 0
        : Math.cos(motionTime * 0.115) * 0.003 * motionStrength);
    facetMaterial.opacity =
      0.31 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.42) * 0.045);
    monolithMaterial.clearcoat =
      monolithClearcoat +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.18) * 0.035);
    monolithMaterial.emissiveIntensity =
      0.3 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.29 + 1.1) * 0.055);
    shellMaterial.uniforms.uTime.value = motionTime;
    shellMaterial.uniforms.uPointer.value.set(
      activePointerX,
      activePointerY
    );
    tendrilGroup.rotation.x = reducedMotion
      ? 0
      : Math.sin(motionTime * 0.08) * 0.025 + activePointerY * 0.012;
    tendrilGroup.rotation.y = reducedMotion
      ? 0
      : motionTime * 0.018 + activePointerX * 0.035;
    tendrilGroup.rotation.z = reducedMotion
      ? 0
      : Math.cos(motionTime * 0.065) * 0.018;
    tendrilGroup.children.forEach((tendril) => {
      tendril.material.opacity =
        0.145 +
        (reducedMotion
          ? 0
          : Math.sin(motionTime * 0.23 + tendril.userData.phase) * 0.04);
    });
    spectralCrown.rotation.x = reducedMotion
      ? 0
      : Math.sin(motionTime * 0.095) * 0.025 + activePointerY * 0.016;
    spectralCrown.rotation.y = reducedMotion
      ? 0
      : Math.sin(motionTime * 0.08) * 0.07 + activePointerX * 0.04;
    spectralCrown.rotation.z = reducedMotion ? 0 : motionTime * 0.018;
    prismMaterial.emissiveIntensity =
      0.34 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.38) * 0.08);
    arcGroup.rotation.x = reducedMotion ? 0 : activePointerY * 0.012;
    arcGroup.rotation.y = reducedMotion ? 0 : activePointerX * 0.026;
    spectralArcs.forEach((arc, index) => {
      arc.rotation.z =
        index * 1.13 -
        1.8 +
        (reducedMotion
          ? 0
          : motionTime * (index % 2 === 0 ? 0.018 : -0.014));
      arc.material.opacity =
        0.19 +
        (index % 3) * 0.035 +
        (reducedMotion
          ? 0
          : Math.sin(motionTime * 0.31 + arc.userData.phase) * 0.045);
    });
    causticMaterial.uniforms.uTime.value = motionTime;
    causticMaterial.uniforms.uPointer.value.set(
      activePointerX,
      activePointerY
    );
    poolMaterial.emissiveIntensity =
      0.32 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.17 - 0.8) * 0.055);
    underLight.intensity =
      58 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.36) * 7.5);
    underLight.position.x = reducedMotion
      ? 0
      : Math.sin(motionTime * 0.16) * 0.35 + activePointerX * 0.2;
    keyLight.position.x = reducedMotion
      ? -7
      : -7 + Math.sin(motionTime * 0.09) * 0.55;
    keyLight.position.z = reducedMotion
      ? 7
      : 7 + Math.cos(motionTime * 0.09) * 0.42;
    rimLight.intensity =
      230 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.21 + 0.8) * 18);
    emberLight.intensity =
      42 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.27 + 1.7) * 7);
    emberLight.position.z =
      0.4 + (reducedMotion ? 0 : Math.cos(motionTime * 0.12) * 0.5);
    hemisphereLight.intensity =
      0.72 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.14) * 0.025);
    terrainMaterial.emissiveIntensity =
      0.2 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.16 - 0.6) * 0.018);
    rootsMaterial.opacity =
      0.48 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.24) * 0.045);
    roots.rotation.y = reducedMotion
      ? 0
      : Math.sin(motionTime * 0.055) * 0.012;
    ringMaterial.emissiveIntensity =
      0.88 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.25 + 0.9) * 0.14);
    crownMaterial.emissiveIntensity =
      0.16 +
      (reducedMotion ? 0 : Math.sin(motionTime * 0.31 + 2.1) * 0.045);

    orbitalRings.forEach((ring, index) => {
      const ringMotion = reducedMotion
        ? 0
        : Math.sin(motionTime * (0.12 + index * 0.008) + ring.userData.phase);
      ring.position.y = ring.userData.baseY + ringMotion * 0.018;
      ring.rotation.y = reducedMotion
        ? 0
        : motionTime * (0.0025 + index * 0.00035) + ringMotion * 0.008;
      ring.scale.x =
        ring.userData.baseScale + ringMotion * 0.0025 * motionStrength;
      ring.scale.z =
        0.78 * ring.userData.baseScale -
        ringMotion * 0.0025 * motionStrength;
    });

    skyMaterial.uniforms.uTime.value = motionTime;
    if (reducedMotion) {
      skyMaterial.uniforms.uPointer.value.set(0, 0);
      auraMaterial.uniforms.uPointer.value.set(0, 0);
      sporeMaterial.uniforms.uPointer.value.set(0, 0);
    } else {
      skyMaterial.uniforms.uPointer.value.set(
        activePointerX,
        activePointerY
      );
      auraMaterial.uniforms.uPointer.value.set(
        activePointerX,
        activePointerY
      );
      sporeMaterial.uniforms.uPointer.value.set(
        activePointerX,
        activePointerY
      );
    }
    auraMaterial.uniforms.uTime.value = motionTime;
    aura.position.x = reducedMotion ? 0 : activePointerX * -0.055;
    aura.position.y =
      2.45 +
      (reducedMotion
        ? 0
        : Math.sin(motionTime * 0.13 + 0.4) * 0.025 * motionStrength);
    aura.quaternion.copy(camera.quaternion);
    sporeMaterial.uniforms.uTime.value = motionTime;
    if (stalkMaterial.userData.shader) {
      stalkMaterial.userData.shader.uniforms.uTime.value = motionTime;
      if (reducedMotion) {
        stalkMaterial.userData.shader.uniforms.uPointer.value.set(0, 0);
      } else {
        stalkMaterial.userData.shader.uniforms.uPointer.value.set(
          activePointerX,
          activePointerY
        );
      }
    }
    updateIdentity(reducedMotion);

    renderer.render(scene, camera);

    if (reducedMotion) {
      renderer.setAnimationLoop(null);
    }
  }

  const onMotionPreferenceChange = () => renderer.setAnimationLoop(render);
  const onVisibilityChange = () => {
    renderer.setAnimationLoop(document.hidden ? null : render);
  };

  window.addEventListener("resize", resize, { passive: true });
  prefersReducedMotion.addEventListener("change", onMotionPreferenceChange);
  document.addEventListener("visibilitychange", onVisibilityChange);
  renderer.setAnimationLoop(render);

  window.addEventListener(
    "pagehide",
    () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      prefersReducedMotion.removeEventListener("change", onMotionPreferenceChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      animatedMaterials.length = 0;
      disposables.forEach((item) => item.dispose());
      runtime.dispose();
    },
    { once: true }
  );
}
