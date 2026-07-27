import * as THREE from "three";
import "./eventide.css";
import { createRuntime, fitPerspectiveCamera } from "./shared/runtime.js";

const canvas = document.querySelector(".webgl");
const runtime = createRuntime(canvas, {
  antialias: true,
  clearColor: 0x020609,
  maxPixelRatio: 1.5
});

if (runtime) {
  const { renderer, pointer, prefersReducedMotion } = runtime;
  const identity = document.querySelector(".identity");
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020609, 0.045);

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
      color: 0xc7ad72,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    })
  );
  const brassFaint = registerMaterial(
    new THREE.LineBasicMaterial({
      color: 0xa79467,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    })
  );
  const cold = registerMaterial(
    new THREE.LineBasicMaterial({
      color: 0x93c8c7,
      transparent: true,
      opacity: 0.34,
      depthWrite: false
    })
  );
  const coldFaint = registerMaterial(
    new THREE.LineBasicMaterial({
      color: 0x6c9698,
      transparent: true,
      opacity: 0.15,
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
  const sweepColor = new THREE.Color(0x90ceca);
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
        precision highp float;

        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uPointer;
        uniform float uSignal;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(float x) {
          float i = floor(x);
          float f = fract(x);
          float u = f * f * (3.0 - 2.0 * f);
          return mix(hash(vec2(i, 5.31)), hash(vec2(i + 1.0, 5.31)), u);
        }

        float fbm(float x) {
          float value = noise(x) * 0.57;
          value += noise(x * 2.03 + 17.4) * 0.28;
          value += noise(x * 4.11 - 9.7) * 0.15;
          return value;
        }

        void main() {
          vec2 p = vUv - 0.5;
          float radius = length(p);
          float angle = atan(p.y, p.x);
          float angularNoise = fbm(angle * 13.0 + uTime * 0.025);
          float roughness = (angularNoise - 0.5) * 0.011;
          roughness += sin(angle * 19.0 - uTime * 0.07) * 0.0017;

          float ringDistance = abs(radius - 0.273 - roughness);
          float ring = 1.0 - smoothstep(0.002, 0.034, ringDistance);
          float innerEdge = exp(-abs(radius - 0.269) * 62.0) * 0.28;
          float outerBloom = exp(-abs(radius - 0.289) * 19.0) * 0.2;

          float rayCell = floor((angle + 3.14159265) * 18.0);
          float raySeed = hash(vec2(rayCell, 11.7));
          float rayShape = pow(
            max(0.0, sin(angle * (43.0 + raySeed * 19.0) + raySeed * 21.0)),
            8.0
          );
          float rayReach = exp(-max(0.0, radius - 0.278) * (18.0 + raySeed * 38.0));
          float rays = smoothstep(0.275, 0.292, radius) * rayShape * rayReach;

          float pointerAzimuth = uPointer.x * 0.15 - uPointer.y * 0.08;
          float directional = 0.3 + 0.7 * pow(
            max(0.0, cos(angle - 0.64 + pointerAzimuth)),
            5.0
          );
          float sweep = pow(
            max(0.0, cos(angle - uTime * 0.115 - 0.7)),
            54.0
          );
          float pulse = 0.965 + sin(uTime * 0.38 + angle * 2.0) * 0.035;
          float alpha = (
            ring * 0.72
            + innerEdge
            + outerBloom
            + rays * 0.34
            + sweep * (0.08 + uSignal * 0.12)
          ) * directional * pulse;

          vec3 cool = vec3(0.34, 0.72, 0.72);
          vec3 warm = vec3(0.94, 0.66, 0.28);
          float warmth = smoothstep(-0.4, 0.85, cos(angle - 0.55));
          warmth += sweep * 0.18;
          vec3 color = mix(cool, warm, clamp(warmth, 0.0, 1.0));
          color *= 1.02 + ring * 0.82 + rays * 0.28;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false
    })
  );
  const halo = new THREE.Mesh(
    registerGeometry(new THREE.PlaneGeometry(9.4, 9.4)),
    haloMaterial
  );
  halo.position.z = -0.42;
  scene.add(halo);

  const eclipse = new THREE.Mesh(
    registerGeometry(new THREE.SphereGeometry(2.56, 48, 32)),
    registerMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x010304
      })
    )
  );
  eclipse.position.z = -0.05;
  scene.add(eclipse);

  const rim = new THREE.Mesh(
    registerGeometry(new THREE.RingGeometry(2.55, 2.575, 192)),
    registerMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x88b7b2,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    )
  );
  rim.position.z = 0.1;
  scene.add(rim);

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
  const isCompact = window.matchMedia("(max-width: 700px)").matches;
  const starCount = isCompact ? 320 : 620;
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

  const signalCount = isCompact ? 36 : 92;
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
        precision highp float;

        varying float vIntensity;
        varying float vWarmth;

        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float distanceToCenter = length(p);
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

  const parallax = new THREE.Vector2();
  const cameraTarget = new THREE.Vector3();
  const baseInclinedRotation = new THREE.Euler(1.02, 0.1, -0.35);
  const basePolarRotation = new THREE.Euler(0.12, 1.08, 0.2);
  let renderedReducedFrame = false;
  const animate = () => {
    const { delta, elapsed } = runtime.tick();
    const reduced = prefersReducedMotion.matches;
    const time = reduced ? 18 : elapsed;
    const parallaxEase = 1 - Math.exp(-delta * 2.15);

    if (reduced) {
      parallax.set(0, 0);
    } else {
      parallax.lerp(pointer, parallaxEase);
    }

    const compactMotion = isCompact ? 0.62 : 1;
    camera.position.set(
      parallax.x * 0.37 * compactMotion,
      parallax.y * 0.27 * compactMotion,
      14.5
    );
    cameraTarget.set(
      parallax.x * 0.045 * compactMotion,
      parallax.y * 0.035 * compactMotion,
      0
    );
    camera.lookAt(cameraTarget);

    instrument.rotation.set(
      parallax.y * -0.062 * compactMotion,
      parallax.x * 0.086 * compactMotion,
      parallax.x * -0.009 * compactMotion
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
    deepField.rotation.set(
      parallax.y * 0.009 * compactMotion,
      parallax.x * -0.013 * compactMotion,
      reduced ? -0.015 : -time * 0.00125
    );
    halo.position.set(
      parallax.x * -0.045 * compactMotion,
      parallax.y * -0.035 * compactMotion,
      -0.42
    );

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

    haloMaterial.uniforms.uTime.value = time;
    haloMaterial.uniforms.uPointer.value.copy(parallax);
    haloMaterial.uniforms.uSignal.value = reduced
      ? 0.35
      : 0.35 + Math.sin(time * 0.43) * 0.2;
    signalMaterial.uniforms.uTime.value = time;
    signalMaterial.uniforms.uPointer.value.copy(parallax);

    if (identity) {
      if (reduced) {
        identity.style.setProperty("--identity-x", "0px");
        identity.style.setProperty("--identity-y", "0px");
        identity.style.setProperty("--signal-luma", "1");
      } else {
        identity.style.setProperty(
          "--identity-x",
          `${(parallax.x * 4.2 * compactMotion).toFixed(2)}px`
        );
        identity.style.setProperty(
          "--identity-y",
          `${(parallax.y * -3.1 * compactMotion).toFixed(2)}px`
        );
        identity.style.setProperty(
          "--signal-luma",
          (0.985 + Math.sin(time * 0.43) * 0.015).toFixed(3)
        );
      }
    }

    renderer.render(scene, camera);

    if (reduced) {
      renderedReducedFrame = true;
      renderer.setAnimationLoop(null);
    }
  };

  renderer.setAnimationLoop(animate);

  const onMotionPreferenceChange = () => {
    renderedReducedFrame = false;
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
