import * as THREE from "three";
import "./eventide.css";
import { createRuntime, fitPerspectiveCamera } from "./shared/runtime.js";

const canvas = document.querySelector(".webgl");
const isCompact = window.matchMedia("(max-width: 700px)").matches;
const runtime = createRuntime(canvas, {
  antialias: true,
  clearColor: 0x020609,
  maxPixelRatio: isCompact ? 1.15 : 1.35
});

if (runtime) {
  const { renderer, pointer, prefersReducedMotion } = runtime;
  const identity = document.querySelector(".identity");
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x010509, 0.039);

  const camera = new THREE.PerspectiveCamera(
    38,
    window.innerWidth / window.innerHeight,
    0.1,
    70
  );
  camera.position.set(0, 0, 14.5);

  const instrument = new THREE.Group();
  const dial = new THREE.Group();
  const inclinedOrbit = new THREE.Group();
  const polarOrbit = new THREE.Group();
  const signalSweep = new THREE.Group();
  const signalEchoes = new THREE.Group();
  instrument.add(dial, inclinedOrbit, polarOrbit, signalSweep, signalEchoes);
  scene.add(instrument);

  const materials = [];
  const geometries = [];
  const registerMaterial = (material) => {
    materials.push(material);
    return material;
  };
  const registerGeometry = (geometry) => {
    geometries.push(geometry);
    return geometry;
  };

  const brass = registerMaterial(
    new THREE.LineBasicMaterial({
      color: 0xf0b85c,
      transparent: true,
      opacity: 0.62,
      depthWrite: false
    })
  );
  const brassFaint = registerMaterial(
    new THREE.LineBasicMaterial({
      color: 0xb97542,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    })
  );
  const cold = registerMaterial(
    new THREE.LineBasicMaterial({
      color: 0x66e5df,
      transparent: true,
      opacity: 0.46,
      depthWrite: false
    })
  );
  const coldFaint = registerMaterial(
    new THREE.LineBasicMaterial({
      color: 0x358f9a,
      transparent: true,
      opacity: 0.19,
      depthWrite: false
    })
  );

  const makeOrbit = (radius, segments, material, scaleY = 1) => {
    const points = [];
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * scaleY,
          0
        )
      );
    }
    const geometry = registerGeometry(
      new THREE.BufferGeometry().setFromPoints(points)
    );
    return new THREE.LineLoop(geometry, material);
  };

  dial.add(
    makeOrbit(2.72, 160, coldFaint),
    makeOrbit(3.56, 192, brassFaint),
    makeOrbit(4.35, 224, brass),
    makeOrbit(5.12, 224, coldFaint),
    makeOrbit(5.78, 256, brassFaint)
  );

  const tickPositions = [];
  const majorTickPositions = [];
  const tickCount = 144;
  for (let index = 0; index < tickCount; index += 1) {
    const angle = (index / tickCount) * Math.PI * 2;
    const major = index % 12 === 0;
    const medium = index % 3 === 0;
    const outer = 4.62;
    const inner = outer - (major ? 0.3 : medium ? 0.17 : 0.09);
    const target = major ? majorTickPositions : tickPositions;
    target.push(
      Math.cos(angle) * inner,
      Math.sin(angle) * inner,
      0,
      Math.cos(angle) * outer,
      Math.sin(angle) * outer,
      0
    );
  }

  const ticks = new THREE.LineSegments(
    registerGeometry(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(tickPositions, 3)
      )
    ),
    brassFaint
  );
  const majorTicks = new THREE.LineSegments(
    registerGeometry(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(majorTickPositions, 3)
      )
    ),
    brass
  );
  dial.add(ticks, majorTicks);

  const reticlePositions = [
    -6.25, 0, 0, -4.92, 0, 0,
    4.92, 0, 0, 6.25, 0, 0,
    0, -6.25, 0, 0, -4.92, 0,
    0, 4.92, 0, 0, 6.25, 0,
    -3.1, -3.1, 0, -2.68, -2.68, 0,
    3.1, -3.1, 0, 2.68, -2.68, 0,
    -3.1, 3.1, 0, -2.68, 2.68, 0,
    3.1, 3.1, 0, 2.68, 2.68, 0
  ];
  const reticle = new THREE.LineSegments(
    registerGeometry(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(reticlePositions, 3)
      )
    ),
    coldFaint
  );
  dial.add(reticle);

  const createArcSegments = (radius, start, length, count, material) => {
    const positions = [];
    for (let index = 0; index < count; index += 1) {
      const a = start + (index / count) * length;
      const b = start + ((index + 0.62) / count) * length;
      positions.push(
        Math.cos(a) * radius,
        Math.sin(a) * radius,
        0,
        Math.cos(b) * radius,
        Math.sin(b) * radius,
        0
      );
    }
    return new THREE.LineSegments(
      registerGeometry(
        new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3)
        )
      ),
      material
    );
  };

  dial.add(
    createArcSegments(3.02, -0.56, 1.08, 17, brass),
    createArcSegments(3.02, Math.PI - 0.56, 1.08, 17, brass),
    createArcSegments(5.43, 0.78, 0.9, 15, cold),
    createArcSegments(5.43, Math.PI + 0.78, 0.9, 15, cold)
  );

  inclinedOrbit.rotation.set(1.02, 0.1, -0.35);
  inclinedOrbit.add(
    makeOrbit(4.95, 224, cold, 0.98),
    makeOrbit(5.05, 224, coldFaint, 0.98)
  );
  polarOrbit.rotation.set(0.12, 1.08, 0.2);
  polarOrbit.add(makeOrbit(4.73, 224, brassFaint));

  const sweepPositions = [];
  const sweepColors = [];
  const sweepStart = 2.74;
  const sweepLength = 3.05;
  const sweepSegments = 22;
  const sweepColor = new THREE.Color(0x73f5ed);
  for (let index = 0; index < sweepSegments; index += 1) {
    const from = sweepStart + (index / sweepSegments) * sweepLength;
    const to = sweepStart + ((index + 0.72) / sweepSegments) * sweepLength;
    const strength = Math.pow(1 - index / sweepSegments, 1.65);
    sweepPositions.push(from, 0, 0.075, to, 0, 0.075);
    sweepColors.push(
      sweepColor.r * strength,
      sweepColor.g * strength,
      sweepColor.b * strength,
      sweepColor.r * strength * 0.82,
      sweepColor.g * strength * 0.82,
      sweepColor.b * strength * 0.82
    );
  }
  const sweepGeometry = registerGeometry(
    new THREE.BufferGeometry()
      .setAttribute(
        "position",
        new THREE.Float32BufferAttribute(sweepPositions, 3)
      )
      .setAttribute(
        "color",
        new THREE.Float32BufferAttribute(sweepColors, 3)
      )
  );
  const sweepMaterial = registerMaterial(
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  signalSweep.add(new THREE.LineSegments(sweepGeometry, sweepMaterial));

  const sweepHead = new THREE.Mesh(
    registerGeometry(new THREE.CircleGeometry(0.052, 20)),
    registerMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xc5ffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
  );
  sweepHead.position.set(5.79, 0, 0.08);
  signalSweep.add(sweepHead);

  const nearEcho = createArcSegments(4.93, -0.19, 0.38, 10, cold);
  const farEcho = createArcSegments(5.55, -0.12, 0.24, 7, brassFaint);
  nearEcho.rotation.z = 0.8;
  farEcho.rotation.z = -2.1;
  signalEchoes.add(nearEcho, farEcho);

  const haloMaterial = registerMaterial(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uSignal: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;

        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uPointer;
        uniform float uSignal;

        void main() {
          vec2 p = vUv - 0.5;
          float radius = length(p);
          float angle = atan(p.y, p.x);

          float roughness =
            sin(angle * 13.0 + uTime * 0.055) * 0.0029
            + sin(angle * 31.0 - uTime * 0.082) * 0.0017
            + sin(angle * 67.0 + uTime * 0.034) * 0.0008;
          float ringDistance = abs(radius - 0.288 - roughness);
          float ring = 1.0 - smoothstep(0.002, 0.025, ringDistance);
          float innerEdge = exp(-abs(radius - 0.286) * 74.0) * 0.24;
          float outerBloom = exp(-max(0.0, radius - 0.29) * 19.0) * 0.17;

          float rayWarp =
            sin(angle * 7.0 - uTime * 0.018) * 1.35
            + sin(angle * 17.0 + uTime * 0.026) * 0.48;
          float rayA = pow(
            0.5 + 0.5 * sin(angle * 47.0 + rayWarp + uTime * 0.035),
            9.0
          );
          float rayB = pow(
            0.5 + 0.5 * sin(angle * 73.0 - rayWarp * 0.7 - uTime * 0.021),
            13.0
          );
          float rayReach = exp(-max(0.0, radius - 0.29) * 24.0);
          float rays =
            smoothstep(0.286, 0.298, radius)
            * (rayA * 0.7 + rayB * 0.3)
            * rayReach;

          float pointerAzimuth = uPointer.x * 0.15 - uPointer.y * 0.08;
          float directional = 0.4 + 0.6 * pow(
            max(0.0, cos(angle - 0.64 + pointerAzimuth)),
            5.0
          );
          float sweep = pow(
            max(0.0, cos(angle - uTime * 0.115 - 0.7)),
            54.0
          );
          float pulse = 0.965 + sin(uTime * 0.38 + angle * 2.0) * 0.035;
          float innerFade = smoothstep(0.276, 0.287, radius);
          float outerFade = 1.0 - smoothstep(0.39, 0.495, radius);
          float radialEnvelope = innerFade * outerFade;
          float alpha = (
            ring * 0.94
            + innerEdge
            + outerBloom * 1.15
            + rays * 0.52
            + sweep * (0.1 + uSignal * 0.15)
          ) * directional * pulse * radialEnvelope;

          vec3 cool = vec3(0.18, 0.92, 0.95);
          vec3 warm = vec3(1.0, 0.48, 0.12);
          float warmth = smoothstep(-0.4, 0.85, cos(angle - 0.55));
          warmth += sweep * 0.18;
          vec3 color = mix(cool, warm, clamp(warmth, 0.0, 1.0));
          color *= 1.14 + ring * 1.04 + rays * 0.34;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false
    })
  );
  const halo = new THREE.Mesh(
    registerGeometry(
      new THREE.RingGeometry(2.46, 4.45, isCompact ? 72 : 112, 1)
    ),
    haloMaterial
  );
  halo.position.z = -0.42;
  scene.add(halo);

  const energyDiscMaterial = registerMaterial(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: `
        precision mediump float;

        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec3 transformed = position;
          float angle = atan(position.y, position.x);
          transformed.z +=
            sin(angle * 3.0 + uTime * 0.055) * 0.035
            + sin(angle * 7.0 - uTime * 0.034) * 0.012;
          gl_Position =
            projectionMatrix
            * modelViewMatrix
            * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;

        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vec2 p = vUv - 0.5;
          float radius = length(p);
          float angle = atan(p.y, p.x);
          float envelope =
            smoothstep(0.315, 0.338, radius)
            * (1.0 - smoothstep(0.455, 0.499, radius));
          float lane = pow(
            0.5
            + 0.5 * sin((radius - 0.315) * 118.0 + angle * 2.0 - uTime * 0.58),
            2.0
          );
          float streak = pow(
            0.5
            + 0.5 * sin(angle * 23.0 + radius * 91.0 - uTime * 0.46),
            7.0
          );
          float counterStreak = pow(
            0.5
            + 0.5 * sin(angle * 37.0 - radius * 63.0 + uTime * 0.24),
            10.0
          );
          float hotFront = pow(
            max(0.0, cos(angle - uTime * 0.085 - 0.34)),
            18.0
          );
          float warmth =
            0.5
            + 0.5 * cos(angle - uTime * 0.038 - radius * 8.0);
          vec3 cool = vec3(0.05, 0.78, 0.9);
          vec3 warm = vec3(1.0, 0.32, 0.055);
          vec3 color = mix(cool, warm, warmth);
          float intensity =
            0.075
            + lane * 0.14
            + streak * 0.48
            + counterStreak * 0.2
            + hotFront * 0.74;
          gl_FragColor = vec4(
            color * (0.88 + streak * 0.62 + hotFront * 0.85),
            intensity * envelope
          );
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  const energyDisc = new THREE.Mesh(
    registerGeometry(
      new THREE.RingGeometry(2.68, 4.25, isCompact ? 80 : 128, 3)
    ),
    energyDiscMaterial
  );
  energyDisc.position.z = -0.08;
  energyDisc.rotation.set(1.12, 0.14, -0.28);
  scene.add(energyDisc);

  const eclipse = new THREE.Mesh(
    registerGeometry(
      new THREE.SphereGeometry(
        2.56,
        isCompact ? 36 : 48,
        isCompact ? 24 : 32
      )
    ),
    registerMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x000102
      })
    )
  );
  eclipse.position.z = -0.05;
  scene.add(eclipse);

  const rim = new THREE.Mesh(
    registerGeometry(
      new THREE.RingGeometry(2.55, 2.575, isCompact ? 128 : 192)
    ),
    registerMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x9bf9f2,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    )
  );
  const rimMaterial = rim.material;
  rim.position.z = 0.1;
  scene.add(rim);

  const photonMaterial = registerMaterial(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position =
            projectionMatrix
            * modelViewMatrix
            * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;

        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vec2 p = vUv - 0.5;
          float radius = length(p);
          float angle = atan(p.y, p.x);
          float radial = clamp((radius - 0.472) / 0.028, 0.0, 1.0);
          float ribbon = sin(radial * 3.14159265);
          float leading = pow(
            max(0.0, cos(angle - uTime * 0.13 - 0.5)),
            24.0
          );
          float trailing = pow(
            max(0.0, cos(angle + uTime * 0.09 + 2.45)),
            30.0
          );
          float filaments =
            0.5
            + 0.5 * sin(angle * 41.0 - uTime * 0.17);
          vec3 cool = vec3(0.22, 0.98, 1.0);
          vec3 warm = vec3(1.0, 0.55, 0.12);
          vec3 color = mix(cool, warm, 0.24 + leading * 0.76);
          float alpha =
            ribbon
            * (
              0.18
              + filaments * 0.12
              + leading * 0.88
              + trailing * 0.55
            );
          gl_FragColor = vec4(
            color * (1.15 + leading * 0.95 + trailing * 0.45),
            alpha
          );
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  const photonShell = new THREE.Mesh(
    registerGeometry(
      new THREE.RingGeometry(2.575, 2.73, isCompact ? 80 : 128, 2)
    ),
    photonMaterial
  );
  photonShell.position.z = 0.085;
  scene.add(photonShell);

  const nodeGeometry = registerGeometry(new THREE.IcosahedronGeometry(0.055, 1));
  const nodeMaterial = registerMaterial(
    new THREE.MeshBasicMaterial({ color: 0xe7d39d })
  );
  const nodeCount = 18;
  const nodes = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodeCount);
  const nodeDummy = new THREE.Object3D();
  for (let index = 0; index < nodeCount; index += 1) {
    const angle = (index / nodeCount) * Math.PI * 2 + 0.08;
    const radius = index % 2 === 0 ? 4.36 : 5.13;
    nodeDummy.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0.035
    );
    nodeDummy.scale.setScalar(index % 6 === 0 ? 1.65 : 0.75);
    nodeDummy.updateMatrix();
    nodes.setMatrixAt(index, nodeDummy.matrix);
  }
  nodes.instanceMatrix.needsUpdate = true;
  dial.add(nodes);

  const marker = new THREE.Mesh(
    registerGeometry(new THREE.OctahedronGeometry(0.12, 0)),
    registerMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xb8eeee,
        transparent: true,
        opacity: 0.92
      })
    )
  );
  marker.position.set(4.95, 0, 0);
  inclinedOrbit.add(marker);

  const returnMarker = new THREE.Mesh(
    registerGeometry(new THREE.RingGeometry(0.075, 0.115, 24)),
    registerMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xdcc38b,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
  );
  polarOrbit.add(returnMarker);

  let seed = 21873;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const shardCount = isCompact ? 16 : 30;
  const shardGeometry = registerGeometry(
    new THREE.BoxGeometry(0.026, 0.2, 0.026)
  );
  const shardMaterial = registerMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.84,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  const energyShards = new THREE.InstancedMesh(
    shardGeometry,
    shardMaterial,
    shardCount
  );
  const shardDummy = new THREE.Object3D();
  const shardColor = new THREE.Color();
  const shardCool = new THREE.Color(0x55f8ef);
  const shardWarm = new THREE.Color(0xff8a26);
  for (let index = 0; index < shardCount; index += 1) {
    const angle =
      (index / shardCount) * Math.PI * 2
      + (random() - 0.5) * 0.12;
    const radius = 3.18 + random() * 1.48;
    shardDummy.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      (random() - 0.5) * 0.48
    );
    shardDummy.rotation.set(
      (random() - 0.5) * 0.18,
      (random() - 0.5) * 0.18,
      angle + Math.PI * 0.5
    );
    shardDummy.scale.set(
      0.7 + random() * 0.55,
      0.45 + random() * 1.65,
      0.7 + random() * 0.55
    );
    shardDummy.updateMatrix();
    energyShards.setMatrixAt(index, shardDummy.matrix);
    shardColor.copy(shardCool).lerp(shardWarm, random());
    energyShards.setColorAt(index, shardColor);
  }
  energyShards.instanceMatrix.needsUpdate = true;
  if (energyShards.instanceColor) {
    energyShards.instanceColor.needsUpdate = true;
  }
  const energyShardShell = new THREE.Group();
  energyShardShell.rotation.set(0.73, -0.08, 0.31);
  energyShardShell.add(energyShards);
  scene.add(energyShardShell);

  const accretionCount = isCompact ? 42 : 84;
  const accretionPositions = new Float32Array(accretionCount * 3);
  const accretionColors = new Float32Array(accretionCount * 3);
  const accretionPhases = new Float32Array(accretionCount);
  const accretionSizes = new Float32Array(accretionCount);
  const accretionCool = new THREE.Color(0x4ce6e1);
  const accretionWarm = new THREE.Color(0xf58d35);
  const accretionColor = new THREE.Color();

  for (let index = 0; index < accretionCount; index += 1) {
    const offset = index * 3;
    const angle = random() * Math.PI * 2;
    const radius = 2.82 + Math.pow(random(), 0.72) * 1.55;
    const warmth = 0.2 + random() * 0.8;
    accretionPositions[offset] = Math.cos(angle) * radius;
    accretionPositions[offset + 1] =
      Math.sin(angle) * radius * (0.16 + random() * 0.12);
    accretionPositions[offset + 2] =
      Math.sin(angle) * 0.23 + (random() - 0.5) * 0.16;
    accretionColor.copy(accretionCool).lerp(accretionWarm, warmth);
    accretionColors[offset] = accretionColor.r;
    accretionColors[offset + 1] = accretionColor.g;
    accretionColors[offset + 2] = accretionColor.b;
    accretionPhases[index] = random() * Math.PI * 2;
    accretionSizes[index] = 0.45 + random() * 0.9;
  }

  const accretionGeometry = registerGeometry(
    new THREE.BufferGeometry()
      .setAttribute(
        "position",
        new THREE.BufferAttribute(accretionPositions, 3)
      )
      .setAttribute(
        "color",
        new THREE.BufferAttribute(accretionColors, 3)
      )
      .setAttribute(
        "aPhase",
        new THREE.BufferAttribute(accretionPhases, 1)
      )
      .setAttribute(
        "aSize",
        new THREE.BufferAttribute(accretionSizes, 1)
      )
  );
  const accretionMaterial = registerMaterial(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        varying vec3 vColor;
        varying float vPulse;

        void main() {
          vec3 transformed = position;
          float shimmer = sin(uTime * 0.47 + aPhase) * 0.5 + 0.5;
          transformed.y += sin(uTime * 0.09 + aPhase) * 0.018;
          vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = (1.25 + aSize * 1.7) * (17.0 / -viewPosition.z);
          vColor = color;
          vPulse = 0.52 + shimmer * 0.48;
        }
      `,
      fragmentShader: `
        precision mediump float;

        varying vec3 vColor;
        varying float vPulse;

        void main() {
          float radius = length(gl_PointCoord - 0.5);
          if (radius > 0.5) discard;
          float body = 1.0 - smoothstep(0.12, 0.5, radius);
          float core = 1.0 - smoothstep(0.0, 0.12, radius);
          gl_FragColor = vec4(
            vColor * (0.88 + core * 0.72),
            body * vPulse * 0.78
          );
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      vertexColors: true
    })
  );
  const accretionField = new THREE.Points(
    accretionGeometry,
    accretionMaterial
  );
  accretionField.rotation.set(0.48, 0.1, -0.17);
  scene.add(accretionField);

  const starCount = isCompact ? 280 : 500;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let index = 0; index < starCount; index += 1) {
    const offset = index * 3;
    const radius = 4.1 + Math.pow(random(), 0.66) * 11;
    const angle = random() * Math.PI * 2;
    const flatten = 0.65 + random() * 0.42;
    starPositions[offset] = Math.cos(angle) * radius;
    starPositions[offset + 1] = Math.sin(angle) * radius * flatten;
    starPositions[offset + 2] = -2.2 - random() * 11;
    const warmth = random();
    starColors[offset] = 0.45 + warmth * 0.34;
    starColors[offset + 1] = 0.55 + warmth * 0.22;
    starColors[offset + 2] = 0.58 + (1 - warmth) * 0.28;
  }
  const starGeometry = registerGeometry(
    new THREE.BufferGeometry()
      .setAttribute("position", new THREE.BufferAttribute(starPositions, 3))
      .setAttribute("color", new THREE.BufferAttribute(starColors, 3))
  );
  const stars = new THREE.Points(
    starGeometry,
    registerMaterial(
      new THREE.PointsMaterial({
        size: isCompact ? 0.045 : 0.052,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false
      })
    )
  );

  const deepField = new THREE.Group();
  deepField.add(stars);
  scene.add(deepField);

  const signalCount = isCompact ? 28 : 64;
  const signalPositions = new Float32Array(signalCount * 3);
  const signalPhases = new Float32Array(signalCount);
  const signalRates = new Float32Array(signalCount);
  const signalSizes = new Float32Array(signalCount);
  for (let index = 0; index < signalCount; index += 1) {
    const offset = index * 3;
    const radius = 3.1 + Math.pow(random(), 0.76) * 6.9;
    const angle = random() * Math.PI * 2;
    signalPositions[offset] = Math.cos(angle) * radius;
    signalPositions[offset + 1] = Math.sin(angle) * radius * (0.72 + random() * 0.2);
    signalPositions[offset + 2] = -0.8 - random() * 5.5;
    signalPhases[index] = random() * Math.PI * 2;
    signalRates[index] = 0.3 + random() * 0.7;
    signalSizes[index] = random();
  }
  const signalGeometry = registerGeometry(
    new THREE.BufferGeometry()
      .setAttribute("position", new THREE.BufferAttribute(signalPositions, 3))
      .setAttribute("aPhase", new THREE.BufferAttribute(signalPhases, 1))
      .setAttribute("aRate", new THREE.BufferAttribute(signalRates, 1))
      .setAttribute("aSize", new THREE.BufferAttribute(signalSizes, 1))
  );
  const signalMaterial = registerMaterial(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2() }
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aRate;
        attribute float aSize;
        uniform float uTime;
        uniform vec2 uPointer;
        varying float vIntensity;
        varying float vWarmth;

        void main() {
          vec3 transformed = position;
          float drift = uTime * (0.006 + aRate * 0.009);
          float c = cos(drift);
          float s = sin(drift);
          transformed.xy = mat2(c, -s, s, c) * transformed.xy;
          transformed.xy += uPointer * (0.025 + aRate * 0.055);
          transformed.z += sin(uTime * 0.11 + aPhase) * 0.075;

          vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = (1.15 + aSize * 2.0) * (18.0 / -viewPosition.z);
          vIntensity = 0.38 + aSize * 0.62;
          vWarmth = aRate;
        }
      `,
      fragmentShader: `
        precision mediump float;

        varying float vIntensity;
        varying float vWarmth;

        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float distanceToCenter = length(p);
          if (distanceToCenter > 0.5) discard;
          float softDisc = 1.0 - smoothstep(0.06, 0.5, distanceToCenter);
          float core = 1.0 - smoothstep(0.0, 0.12, distanceToCenter);
          vec3 cool = vec3(0.38, 0.72, 0.74);
          vec3 warm = vec3(0.88, 0.72, 0.42);
          vec3 color = mix(cool, warm, vWarmth * 0.58);
          gl_FragColor = vec4(color * (0.7 + core), softDisc * vIntensity * 0.52);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  const signalDust = new THREE.Points(signalGeometry, signalMaterial);
  deepField.add(signalDust);

  const onResize = () => {
    fitPerspectiveCamera(camera);
    if (prefersReducedMotion.matches) {
      renderer.setAnimationLoop(animate);
    }
  };
  window.addEventListener("resize", onResize, { passive: true });

  const cameraTarget = new THREE.Vector3();
  const baseInclinedRotation = new THREE.Euler(1.02, 0.1, -0.35);
  const basePolarRotation = new THREE.Euler(0.12, 1.08, 0.2);
  let lastIdentityX = Number.NaN;
  let lastIdentityY = Number.NaN;
  const animate = () => {
    const { elapsed } = runtime.tick();
    const reduced = prefersReducedMotion.matches;
    const time = reduced ? 18 : elapsed;
    const inputX = reduced ? 0 : pointer.x;
    const inputY = reduced ? 0 : pointer.y;
    const compactMotion = isCompact ? 0.62 : 1;
    camera.position.set(
      inputX * 0.37 * compactMotion,
      inputY * 0.27 * compactMotion,
      14.5
    );
    cameraTarget.set(
      inputX * 0.045 * compactMotion,
      inputY * 0.035 * compactMotion,
      0
    );
    camera.lookAt(cameraTarget);

    instrument.rotation.set(
      inputY * -0.062 * compactMotion,
      inputX * 0.086 * compactMotion,
      inputX * -0.009 * compactMotion
    );

    dial.rotation.z = reduced
      ? 0.18
      : time * 0.011 + Math.sin(time * 0.071) * 0.006;
    inclinedOrbit.rotation.set(
      baseInclinedRotation.x + (reduced ? 0 : Math.sin(time * 0.09) * 0.014),
      baseInclinedRotation.y + (reduced ? 0 : Math.cos(time * 0.067) * 0.01),
      baseInclinedRotation.z - (reduced ? 0 : time * 0.024)
    );
    polarOrbit.rotation.set(
      basePolarRotation.x + (reduced ? 0 : Math.cos(time * 0.073) * 0.012),
      basePolarRotation.y + (reduced ? 0 : Math.sin(time * 0.058) * 0.014),
      basePolarRotation.z + (reduced ? 0 : time * 0.015)
    );
    signalSweep.rotation.z = reduced
      ? 1.36
      : time * 0.115 + Math.sin(time * 0.19) * 0.025;
    signalEchoes.rotation.z = reduced
      ? -0.7
      : -time * 0.021 + Math.sin(time * 0.11) * 0.04;
    nearEcho.rotation.z = 0.8 + (reduced ? 0 : Math.sin(time * 0.23) * 0.035);
    farEcho.rotation.z = -2.1 + (reduced ? 0 : Math.cos(time * 0.17) * 0.028);
    signalEchoes.position.z = -0.16;
    signalEchoes.scale.setScalar(
      reduced ? 1 : 1 + Math.sin(time * 0.16) * 0.004
    );
    deepField.rotation.set(
      inputY * 0.009 * compactMotion,
      inputX * -0.013 * compactMotion,
      reduced ? -0.015 : -time * 0.00125
    );
    stars.position.set(
      inputX * -0.11 * compactMotion,
      inputY * -0.08 * compactMotion,
      0
    );
    signalDust.position.set(
      inputX * 0.035 * compactMotion,
      inputY * 0.025 * compactMotion,
      0
    );
    halo.position.set(
      inputX * -0.045 * compactMotion,
      inputY * -0.035 * compactMotion,
      -0.42
    );
    energyDisc.position.set(
      inputX * 0.018 * compactMotion,
      inputY * 0.014 * compactMotion,
      -0.08
    );
    energyDisc.rotation.set(
      1.12 + inputY * 0.032 * compactMotion,
      0.14 + inputX * 0.038 * compactMotion,
      reduced ? -0.28 : -0.28 + time * 0.006
    );
    energyDiscMaterial.uniforms.uTime.value = time;
    photonShell.rotation.z = reduced ? 0.32 : 0.32 - time * 0.018;
    photonMaterial.uniforms.uTime.value = time;
    energyShardShell.position.set(
      inputX * -0.018 * compactMotion,
      inputY * -0.014 * compactMotion,
      0
    );
    energyShardShell.rotation.set(
      0.73 + inputY * 0.022 * compactMotion,
      -0.08 + inputX * 0.03 * compactMotion,
      reduced ? 0.31 : 0.31 - time * 0.019
    );
    energyShardShell.scale.setScalar(
      reduced ? 1 : 1 + Math.sin(time * 0.21) * 0.006
    );
    accretionField.position.set(
      inputX * -0.024 * compactMotion,
      inputY * -0.018 * compactMotion,
      0
    );
    accretionField.rotation.set(
      0.48 + inputY * 0.018 * compactMotion,
      0.1 + inputX * 0.025 * compactMotion,
      reduced ? -0.17 : -0.17 - time * 0.014
    );
    accretionMaterial.uniforms.uTime.value = time;

    const markerAngle = reduced ? 1.12 : time * 0.19;
    marker.position.set(
      Math.cos(markerAngle) * 4.95,
      Math.sin(markerAngle) * 4.95,
      0
    );
    marker.rotation.z = markerAngle;
    marker.scale.setScalar(
      reduced ? 1 : 0.92 + Math.sin(time * 1.15) * 0.08
    );

    const returnAngle = reduced ? -1.9 : -time * 0.113 - 1.1;
    returnMarker.position.set(
      Math.cos(returnAngle) * 4.73,
      Math.sin(returnAngle) * 4.73,
      0.02
    );
    returnMarker.rotation.z = returnAngle;
    sweepHead.scale.setScalar(
      reduced ? 1 : 0.82 + Math.sin(time * 1.7) * 0.18
    );
    rimMaterial.opacity = reduced
      ? 0.25
      : 0.23 + Math.sin(time * 0.51) * 0.025;
    sweepMaterial.opacity = reduced
      ? 0.58
      : 0.54 + Math.sin(time * 0.37) * 0.06;

    haloMaterial.uniforms.uTime.value = time;
    haloMaterial.uniforms.uPointer.value.set(inputX, inputY);
    haloMaterial.uniforms.uSignal.value = reduced
      ? 0.35
      : 0.35 + Math.sin(time * 0.43) * 0.2;
    signalMaterial.uniforms.uTime.value = time;
    signalMaterial.uniforms.uPointer.value.set(inputX, inputY);

    if (
      identity
      && (inputX !== lastIdentityX || inputY !== lastIdentityY)
    ) {
      identity.style.setProperty(
        "--identity-drift",
        `translate3d(${(inputX * 4.2 * compactMotion).toFixed(2)}px, ${
          (inputY * -3.1 * compactMotion).toFixed(2)
        }px, 0)`
      );
      lastIdentityX = inputX;
      lastIdentityY = inputY;
    }

    renderer.render(scene, camera);

    if (reduced) {
      renderer.setAnimationLoop(null);
    }
  };

  renderer.setAnimationLoop(animate);

  const onMotionPreferenceChange = () => {
    renderer.setAnimationLoop(animate);
  };
  prefersReducedMotion.addEventListener("change", onMotionPreferenceChange);

  const onVisibilityChange = () => {
    if (document.hidden) {
      renderer.setAnimationLoop(null);
    } else {
      renderer.setAnimationLoop(animate);
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.addEventListener(
    "pagehide",
    () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      prefersReducedMotion.removeEventListener(
        "change",
        onMotionPreferenceChange
      );
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      runtime.dispose();
    },
    { once: true }
  );
}
