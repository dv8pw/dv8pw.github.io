import * as THREE from "three";
import { createRuntime, fitPerspectiveCamera } from "./shared/runtime.js";
import "./shared/base.css";
import "./eidolon.css";

const canvas = document.querySelector(".webgl");
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

  const porcelain = new THREE.MeshPhysicalMaterial({
    color: 0xf3f0e8,
    roughness: 0.36,
    metalness: 0.02,
    clearcoat: 0.45,
    clearcoatRoughness: 0.5,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xd8d2c6)
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

  const aureole = new THREE.Mesh(
    new THREE.TorusGeometry(
      1.03,
      0.012,
      5,
      isCompact ? 72 : 108
    ),
    graphite
  );
  aureole.scale.y = 0.51;
  aureole.position.z = 1.57;
  aureole.rotation.z = -0.03;
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
  let animationFrame;

  const setResponsiveFraming = () => {
    fitPerspectiveCamera(camera);
    const portrait = window.innerHeight > window.innerWidth;
    camera.position.z = portrait ? 11.9 : 10.2;
    sculpture.scale.setScalar(portrait ? 0.92 : 1);
  };

  const render = () => {
    const { delta, elapsed } = runtime.tick();
    const reduced = prefersReducedMotion.matches;
    if (reduced) {
      sculpture.rotation.copy(baseRotation);
      sculpture.position.y = 0;
    } else {
      const ease = 1 - Math.exp(-delta * 3.1);
      const breathe = Math.sin(elapsed * 0.34) * 0.025;
      const targetX = baseRotation.x - pointer.y * 0.075;
      const targetY = baseRotation.y + pointer.x * 0.14 + breathe;

      sculpture.rotation.x = THREE.MathUtils.lerp(
        sculpture.rotation.x,
        targetX,
        ease
      );
      sculpture.rotation.y = THREE.MathUtils.lerp(
        sculpture.rotation.y,
        targetY,
        ease
      );
      sculpture.position.y = Math.sin(elapsed * 0.47) * 0.025;
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

  window.addEventListener("resize", onResize, { passive: true });
  prefersReducedMotion.addEventListener("change", onMotionPreferenceChange);
  setResponsiveFraming();
  render();

  window.addEventListener(
    "pagehide",
    () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", onResize);
      prefersReducedMotion.removeEventListener("change", onMotionPreferenceChange);
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
