import * as THREE from "three";
import { createRuntime, fitPerspectiveCamera } from "./shared/runtime.js";
import "./shared/base.css";
import "./eidolon.css";

const canvas = document.querySelector(".webgl");
const experience = document.querySelector(".experience");
const runtime = createRuntime(canvas, {
  antialias: true,
  clearColor: 0xe9e6df,
  maxPixelRatio: 1.6
});

if (runtime) {
  const { renderer, pointer, prefersReducedMotion } = runtime;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6df);
  scene.fog = new THREE.Fog(0xe9e6df, 10, 19);

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 30);
  camera.position.set(0, 0.05, 10.2);
  camera.lookAt(0, 0, 0);
  fitPerspectiveCamera(camera);

  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const isCompact = window.matchMedia("(max-width: 700px)").matches;
  const tubularSegments = isCompact ? 56 : 84;
  const radialSegments = isCompact ? 5 : 7;
  const layerCount = isCompact ? 11 : 15;
  const ribCount = isCompact ? 8 : 10;

  const sculpture = new THREE.Group();
  sculpture.rotation.set(-0.08, -0.14, -0.035);
  scene.add(sculpture);

  const hoopMeshes = [];
  const ribMeshes = [];

  const porcelain = new THREE.MeshPhysicalMaterial({
    color: 0xf3f0e8,
    roughness: 0.36,
    metalness: 0.02,
    clearcoat: 0.45,
    clearcoatRoughness: 0.5,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xd8d2c6),
    iridescence: 0.075,
    iridescenceIOR: 1.22,
    iridescenceThicknessRange: [120, 210],
    specularIntensity: 0.78,
    specularColor: new THREE.Color(0xfaf7ef)
  });

  const bone = new THREE.MeshStandardMaterial({
    color: 0xd4cec2,
    roughness: 0.58,
    metalness: 0
  });

  const graphite = new THREE.MeshStandardMaterial({
    color: 0x68635d,
    roughness: 0.32,
    metalness: 0.55
  });

  const contourPoint = (depth, angle, target = new THREE.Vector3()) => {
    const envelope = Math.sqrt(Math.max(0, 1 - depth * depth));
    const phase = depth * 1.75;
    const ripple =
      Math.sin(angle * 3 + phase) * 0.055 +
      Math.sin(angle * 5 - phase * 0.7) * 0.026;
    const rx = 2.02 + envelope * 0.88;
    const ry = 1.4 + envelope * 0.78;
    const asymmetry = 1 + ripple + Math.cos(angle - 0.7) * depth * 0.045;

    return target.set(
      Math.cos(angle) * rx * asymmetry + depth * 0.14,
      Math.sin(angle) * ry * (1 + ripple * 0.78) +
        Math.cos(angle * 2 + phase) * 0.08,
      depth * 1.48 +
        Math.sin(angle * 2 - phase) * 0.13 * envelope
    );
  };

  class ContourCurve extends THREE.Curve {
    constructor(depth) {
      super();
      this.depth = depth;
    }

    getPoint(t, target = new THREE.Vector3()) {
      return contourPoint(this.depth, t * Math.PI * 2, target);
    }
  }

  const hoopDepths = [];
  for (let index = 0; index < layerCount; index += 1) {
    const depth = THREE.MathUtils.lerp(
      -0.94,
      0.94,
      index / (layerCount - 1)
    );
    hoopDepths.push(depth);

    const curve = new ContourCurve(depth);
    const thickness =
      0.032 + (1 - Math.abs(depth)) * 0.025 + (index % 3 === 0 ? 0.012 : 0);
    const geometry = new THREE.TubeGeometry(
      curve,
      tubularSegments,
      thickness,
      radialSegments,
      true
    );
    const material =
      index === 1 || index === layerCount - 2 ? graphite : porcelain;
    const hoop = new THREE.Mesh(geometry, material);
    hoop.castShadow = true;
    hoop.receiveShadow = true;
    hoop.userData.motionPhase = index * 0.73;
    hoop.userData.depth = depth;
    hoopMeshes.push(hoop);
    sculpture.add(hoop);
  }

  for (let ribIndex = 0; ribIndex < ribCount; ribIndex += 1) {
    const angle =
      (ribIndex / ribCount) * Math.PI * 2 +
      0.16 * Math.sin(ribIndex * 2.41);
    const points = [];
    const stepCount = isCompact ? 12 : 16;

    for (let step = 0; step <= stepCount; step += 1) {
      const depth = THREE.MathUtils.lerp(-0.96, 0.96, step / stepCount);
      points.push(
        contourPoint(depth, angle + Math.sin(depth * Math.PI) * 0.055)
      );
    }

    const path = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const geometry = new THREE.TubeGeometry(
      path,
      tubularSegments,
      ribIndex % 4 === 0 ? 0.042 : 0.029,
      radialSegments,
      false
    );
    const rib = new THREE.Mesh(
      geometry,
      ribIndex === ribCount - 2 ? graphite : porcelain
    );
    rib.castShadow = true;
    rib.receiveShadow = true;
    rib.userData.motionPhase = ribIndex * 0.91;
    ribMeshes.push(rib);
    sculpture.add(rib);
  }

  const jointGeometry = new THREE.IcosahedronGeometry(0.055, 1);
  const jointCount = layerCount * ribCount;
  const joints = new THREE.InstancedMesh(
    jointGeometry,
    bone,
    jointCount
  );
  const jointTransform = new THREE.Object3D();
  let jointIndex = 0;

  for (const depth of hoopDepths) {
    for (let ribIndex = 0; ribIndex < ribCount; ribIndex += 1) {
      const angle =
        (ribIndex / ribCount) * Math.PI * 2 +
        0.16 * Math.sin(ribIndex * 2.41) +
        Math.sin(depth * Math.PI) * 0.055;
      jointTransform.position.copy(contourPoint(depth, angle));
      jointTransform.scale.setScalar(
        0.78 + (1 - Math.abs(depth)) * 0.4
      );
      jointTransform.rotation.set(angle * 0.5, depth, angle);
      jointTransform.updateMatrix();
      joints.setMatrixAt(jointIndex, jointTransform.matrix);
      jointIndex += 1;
    }
  }

  joints.instanceMatrix.needsUpdate = true;
  joints.castShadow = true;
  joints.receiveShadow = true;
  sculpture.add(joints);

  const aureoleMaterial = new THREE.MeshBasicMaterial({
    color: 0x8b857c,
    transparent: true,
    opacity: isCompact ? 0.085 : 0.105,
    depthWrite: false,
    toneMapped: false
  });
  const aureoleArcGeometry = new THREE.TorusGeometry(
    1.66,
    0.006,
    4,
    isCompact ? 56 : 80,
    Math.PI * 0.49
  );
  const aureole = new THREE.Group();
  const aureoleRight = new THREE.Mesh(
    aureoleArcGeometry,
    aureoleMaterial
  );
  const aureoleLeft = new THREE.Mesh(
    aureoleArcGeometry,
    aureoleMaterial
  );
  aureoleRight.rotation.z = -Math.PI * 0.245;
  aureoleLeft.rotation.z = Math.PI * 0.755;
  aureole.add(aureoleRight, aureoleLeft);
  aureole.scale.y = 0.68;
  aureole.position.set(0, 0.08, 0.72);
  sculpture.add(aureole);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 22),
    new THREE.MeshStandardMaterial({
      color: 0xe5e1d9,
      roughness: 1,
      metalness: 0
    })
  );
  wall.position.z = -3.25;
  wall.receiveShadow = true;
  scene.add(wall);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8afa2, 1.65));

  const key = new THREE.DirectionalLight(0xfffbf3, 4.2);
  key.position.set(-4.5, 6.5, 8);
  key.target.position.set(0.4, -0.2, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(isCompact ? 512 : 1024, isCompact ? 512 : 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 16;
  key.shadow.camera.left = -4.6;
  key.shadow.camera.right = 4.6;
  key.shadow.camera.top = 4.2;
  key.shadow.camera.bottom = -4.2;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.025;
  scene.add(key, key.target);

  const edge = new THREE.DirectionalLight(0xcbd8dc, 2.2);
  edge.position.set(5, -2, 4);
  scene.add(edge);

  const baseRotation = new THREE.Euler(-0.08, -0.14, -0.035);
  const baseKeyPosition = key.position.clone();
  const baseEdgePosition = edge.position.clone();
  const baseKeyTarget = key.target.position.clone();
  let baseCameraZ = 10.2;
  let animationFrame;

  const setResponsiveFraming = () => {
    fitPerspectiveCamera(camera);
    const portrait = window.innerHeight > window.innerWidth;
    baseCameraZ = portrait ? 11.9 : 10.2;
    camera.position.z = baseCameraZ;
    sculpture.scale.setScalar(portrait ? 0.92 : 1);
  };

  const setAtmosphere = (x = 0, y = 0, pulse = 0) => {
    experience.style.setProperty("--eidolon-focus-x", `${50 + x * 1.4}%`);
    experience.style.setProperty("--eidolon-focus-y", `${44 - y * 1.1}%`);
    experience.style.setProperty(
      "--eidolon-line-breath",
      `${1 + pulse * 0.028}`
    );
  };

  const setStaticPose = () => {
    sculpture.rotation.copy(baseRotation);
    sculpture.position.set(0, 0, 0);
    camera.position.set(0, 0.05, baseCameraZ);
    camera.lookAt(0, 0, 0);

    for (const hoop of hoopMeshes) {
      hoop.position.set(0, 0, 0);
      hoop.rotation.set(0, 0, 0);
      hoop.scale.set(1, 1, 1);
    }

    for (const rib of ribMeshes) {
      rib.position.set(0, 0, 0);
      rib.rotation.set(0, 0, 0);
    }

    aureole.position.set(0, 0.08, 0.72);
    aureole.rotation.set(0, 0, 0);
    aureole.scale.set(1, 0.68, 1);
    aureoleMaterial.opacity = isCompact ? 0.085 : 0.105;

    key.position.copy(baseKeyPosition);
    key.target.position.copy(baseKeyTarget);
    key.intensity = 4.2;
    edge.position.copy(baseEdgePosition);
    edge.intensity = 2.2;
    porcelain.clearcoat = 0.45;
    porcelain.sheen = 0.25;
    graphite.roughness = 0.32;
    setAtmosphere();
  };

  const render = () => {
    const { elapsed } = runtime.tick();
    const reduced = prefersReducedMotion.matches;
    if (reduced) {
      setStaticPose();
    } else {
      const pointerX = pointer.x;
      const pointerY = pointer.y;
      const breathe = Math.sin(elapsed * 0.31);
      const drift = Math.sin(elapsed * 0.115);
      const targetX =
        baseRotation.x - pointerY * 0.045 + drift * 0.006;
      const targetY =
        baseRotation.y + pointerX * 0.085 + breathe * 0.022;
      const targetZ =
        baseRotation.z + pointerX * pointerY * 0.008 +
        Math.sin(elapsed * 0.19) * 0.006;

      sculpture.rotation.set(targetX, targetY, targetZ);
      sculpture.position.x = pointerX * 0.018;
      sculpture.position.y =
        Math.sin(elapsed * 0.43) * 0.032 - pointerY * 0.012;
      sculpture.position.z = Math.cos(elapsed * 0.21) * 0.018;

      camera.position.x = pointerX * 0.055;
      camera.position.y = 0.05 + pointerY * 0.035;
      camera.position.z = baseCameraZ;
      camera.lookAt(pointerX * 0.012, pointerY * 0.008, 0);

      for (const hoop of hoopMeshes) {
        const phase = hoop.userData.motionPhase;
        const envelope = 1 - Math.abs(hoop.userData.depth) * 0.62;
        hoop.position.z =
          Math.sin(elapsed * 0.28 + phase) * 0.008 * envelope;
        hoop.rotation.z =
          Math.sin(elapsed * 0.2 + phase * 0.63) * 0.0025 * envelope;
        hoop.scale.x =
          1 + Math.sin(elapsed * 0.24 + phase) * 0.0028 * envelope;
        hoop.scale.y =
          1 + Math.cos(elapsed * 0.21 + phase) * 0.0034 * envelope;
      }

      for (const rib of ribMeshes) {
        const phase = rib.userData.motionPhase;
        rib.position.z = Math.sin(elapsed * 0.25 + phase) * 0.0045;
        rib.rotation.z = Math.cos(elapsed * 0.18 + phase) * 0.0018;
      }

      const aureolePulse = Math.sin(elapsed * 0.36);
      aureole.rotation.z = Math.sin(elapsed * 0.17) * 0.007;
      aureole.position.y = 0.08 + Math.sin(elapsed * 0.23) * 0.008;
      aureole.position.z = 0.72 + Math.cos(elapsed * 0.27) * 0.008;
      aureole.scale.set(
        1 + aureolePulse * 0.003,
        0.68 - aureolePulse * 0.002,
        1
      );
      aureoleMaterial.opacity =
        (isCompact ? 0.08 : 0.1) + aureolePulse * 0.01;

      const lightOrbit = elapsed * 0.135;
      key.position.set(
        baseKeyPosition.x + Math.sin(lightOrbit) * 0.34,
        baseKeyPosition.y + Math.cos(lightOrbit * 0.77) * 0.2,
        baseKeyPosition.z + Math.cos(lightOrbit) * 0.24
      );
      key.target.position.set(
        baseKeyTarget.x + pointerX * 0.075,
        baseKeyTarget.y + pointerY * 0.05,
        baseKeyTarget.z
      );
      key.intensity = 4.2 + Math.sin(elapsed * 0.29) * 0.18;
      edge.position.set(
        baseEdgePosition.x + Math.cos(lightOrbit * 0.83) * 0.24,
        baseEdgePosition.y + Math.sin(lightOrbit) * 0.16,
        baseEdgePosition.z
      );
      edge.intensity = 2.2 - Math.sin(elapsed * 0.29) * 0.11;

      porcelain.clearcoat = 0.45 + Math.sin(elapsed * 0.22) * 0.035;
      porcelain.sheen = 0.25 + Math.cos(elapsed * 0.26) * 0.035;
      graphite.roughness = 0.32 + Math.sin(elapsed * 0.24) * 0.025;
      setAtmosphere(pointerX, pointerY, breathe);
    }

    renderer.render(scene, camera);
    animationFrame = reduced ? undefined : window.requestAnimationFrame(render);
  };

  const onResize = () => {
    setResponsiveFraming();
    if (prefersReducedMotion.matches) {
      render();
    }
  };
  const onMotionPreferenceChange = () => {
    if (animationFrame !== undefined) {
      window.cancelAnimationFrame(animationFrame);
    }
    animationFrame = undefined;
    render();
  };
  const onVisibilityChange = () => {
    if (document.hidden) {
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
      animationFrame = undefined;
    } else if (animationFrame === undefined) {
      render();
    }
  };

  window.addEventListener("resize", onResize, { passive: true });
  prefersReducedMotion.addEventListener("change", onMotionPreferenceChange);
  document.addEventListener("visibilitychange", onVisibilityChange);
  setResponsiveFraming();
  render();

  window.addEventListener(
    "pagehide",
    () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", onResize);
      prefersReducedMotion.removeEventListener("change", onMotionPreferenceChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material?.dispose();
        }
      });
      runtime.dispose();
    },
    { once: true }
  );
}
