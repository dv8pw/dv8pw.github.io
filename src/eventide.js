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
  instrument.add(dial, inclinedOrbit, polarOrbit);
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

  const haloMaterial = registerMaterial(
    new THREE.ShaderMaterial({
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
        precision highp float;

        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uPointer;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 p = vUv - 0.5;
          float radius = length(p);
          float angle = atan(p.y, p.x);
          float roughness = (hash(vec2(floor(angle * 74.0), 2.0)) - 0.5) * 0.005;
          float ring = 1.0 - smoothstep(0.006, 0.045, abs(radius - 0.273 - roughness));
          float outerBloom = exp(-abs(radius - 0.282) * 22.0) * 0.22;
          float directional = 0.34 + 0.66 * pow(max(0.0, cos(angle - 0.64 + uPointer.x * 0.12)), 5.0);
          float pulse = 0.96 + sin(uTime * 0.43 + angle * 2.0) * 0.04;
          float alpha = (ring * 0.76 + outerBloom) * directional * pulse;
          vec3 cool = vec3(0.34, 0.72, 0.72);
          vec3 warm = vec3(0.94, 0.66, 0.28);
          vec3 color = mix(cool, warm, smoothstep(-0.4, 0.85, cos(angle - 0.55)));
          gl_FragColor = vec4(color * (1.1 + ring), alpha);
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
  scene.add(stars);

  const onResize = () => fitPerspectiveCamera(camera);
  window.addEventListener("resize", onResize, { passive: true });

  let renderedReducedFrame = false;
  const animate = () => {
    const { delta, elapsed } = runtime.tick();
    const reduced = prefersReducedMotion.matches;
    const time = reduced ? 18 : elapsed;
    const pointerAmount = reduced ? 0 : 1;

    camera.position.x +=
      (pointer.x * 0.33 * pointerAmount - camera.position.x) * 0.035;
    camera.position.y +=
      (pointer.y * 0.24 * pointerAmount - camera.position.y) * 0.035;
    camera.lookAt(0, 0, 0);

    instrument.rotation.x +=
      (pointer.y * -0.065 * pointerAmount - instrument.rotation.x) * 0.035;
    instrument.rotation.y +=
      (pointer.x * 0.09 * pointerAmount - instrument.rotation.y) * 0.035;

    if (!reduced) {
      dial.rotation.z += delta * 0.014;
      inclinedOrbit.rotation.z -= delta * 0.029;
      polarOrbit.rotation.z += delta * 0.017;
      stars.rotation.z -= delta * 0.0018;
    }

    const markerAngle = reduced ? 1.12 : time * 0.19;
    marker.position.set(
      Math.cos(markerAngle) * 4.95,
      Math.sin(markerAngle) * 4.95,
      0
    );
    marker.rotation.z = markerAngle;

    haloMaterial.uniforms.uTime.value = time;
    haloMaterial.uniforms.uPointer.value.copy(pointer);
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
