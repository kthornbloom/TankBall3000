import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createTankPreview(container, onLoaded = () => {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a121e, 10, 28);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x56616d, 0));
  scene.add(new THREE.AmbientLight(0xcbdcf0, 0));
  const overhead = new THREE.DirectionalLight(0xfff1d5, 4.5);
  overhead.position.set(10, 10, 0);
  overhead.castShadow = true;
  overhead.shadow.mapSize.set(1024, 1024);
  overhead.shadow.camera.left = -7;
  overhead.shadow.camera.right = 7;
  overhead.shadow.camera.top = 7;
  overhead.shadow.camera.bottom = -7;
  overhead.shadow.camera.near = 0.5;
  overhead.shadow.camera.far = 25;
  overhead.shadow.bias = -0.0002;
  overhead.shadow.normalBias = 0.05;
  scene.add(overhead);
  const cameraFill = new THREE.PointLight(0xc9e1ff, 110, 36, 2);
  scene.add(cameraFill);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x4b5b6d, roughness: 0.9, metalness: 0.02 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.18;
  floor.receiveShadow = true;
  scene.add(floor);

  let model = null;
  let frame = 0;
  let lastTime = 0;
  let orbit = 0;
  let disposed = false;
  let requestId = 0;
  let loadedModelRequest = 0;
  const orbitTarget = new THREE.Vector3(0, 0.45, 0);
  const orbitRadius = 8;
  const orbitHeight = 1.9;
  camera.position.set(0, orbitHeight, orbitRadius);
  camera.lookAt(orbitTarget.clone().add(new THREE.Vector3(-2.1, 0, 0)));
  cameraFill.position.copy(camera.position);

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const loader = new GLTFLoader();
  function clearModel() {
    if (!model) return;
    scene.remove(model);
    model.traverse(object => {
      object.geometry?.dispose();
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        material?.dispose();
      }
    });
    model = null;
  }

  function setTank(url) {
    const request = ++requestId;
    loadedModelRequest = 0;
    onLoaded('loading');
    clearModel();
    loader.load(url, gltf => {
      if (disposed || request !== requestId) return;
      // Keep the imported hierarchy and the Ball mesh at the same origin used
      // by the game. Only enlarge it slightly to fill the selector viewport.
      model = gltf.scene;
      model.scale.setScalar(1.15);
      model.rotation.y = Math.PI;
      model.traverse(object => {
        object.visible = true;
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      scene.add(model);
      orbit = 0;
      loadedModelRequest = request;
      preparePreview();
    }, undefined, error => {
      if (disposed || request !== requestId) return;
      console.error(`Could not load tank preview ${url}:`, error);
      onLoaded('error');
    });
  }

  async function preparePreview() {
    const request = loadedModelRequest;
    if (!request || request !== requestId || disposed) return;
    scene.updateMatrixWorld(true);
    try {
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
    } catch (compileError) {
      console.warn('Tank preview warm-up did not complete:', compileError);
    }
    if (disposed || request !== requestId) return;
    renderer.render(scene, camera);
    onLoaded('ready');
  }

  function render(time) {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    const dt = Math.min((time - lastTime) / 1000 || 0, 0.05);
    lastTime = time;
    orbit += dt * 0.13;
    camera.position.set(
      Math.sin(orbit) * orbitRadius,
      orbitHeight,
      Math.cos(orbit) * orbitRadius
    );
    const cameraRight = new THREE.Vector3(Math.cos(orbit), 0, -Math.sin(orbit));
    camera.lookAt(orbitTarget.clone().addScaledVector(cameraRight, -2.1));
    cameraFill.position.copy(camera.position);
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(render);

  return {
    setTank,
    dispose() {
      disposed = true;
      requestId++;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
