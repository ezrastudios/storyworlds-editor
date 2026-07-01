import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

const canvasRoot = document.querySelector('#worldCanvas');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdce8e2);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
camera.position.set(8, 7, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
canvasRoot.appendChild(renderer.domElement);

const ambientLight = new THREE.HemisphereLight(0xffffff, 0x8b846f, 1.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
sunLight.position.set(8, 12, 6);
sunLight.castShadow = true;
scene.add(sunLight);

const terrainGeometry = new THREE.PlaneGeometry(12, 12, 24, 24);
terrainGeometry.rotateX(-Math.PI / 2);

const terrainMaterial = new THREE.MeshStandardMaterial({
  color: 0xa8b589,
  roughness: 0.95
});

const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrain.receiveShadow = true;
scene.add(terrain);

const lakeGeometry = new THREE.CircleGeometry(1.25, 32);
lakeGeometry.rotateX(-Math.PI / 2);

const lakeMaterial = new THREE.MeshStandardMaterial({
  color: 0x8cbaba,
  transparent: true,
  opacity: 0.72,
  roughness: 0.4
});

const lake = new THREE.Mesh(lakeGeometry, lakeMaterial);
lake.position.set(2.2, 0.025, -1.2);
scene.add(lake);

const markerGeometry = new THREE.CylinderGeometry(0.12, 0.18, 0.45, 12);
const markerMaterial = new THREE.MeshStandardMaterial({
  color: 0x6d8060,
  roughness: 0.8
});

const marker = new THREE.Mesh(markerGeometry, markerMaterial);
marker.position.set(-1.8, 0.25, 1.4);
marker.castShadow = true;
scene.add(marker);

const grid = new THREE.GridHelper(12, 12, 0xf6efe1, 0xd2c5ad);
grid.position.y = 0.01;
scene.add(grid);

function resizeRenderer() {
  const width = canvasRoot.clientWidth;
  const height = canvasRoot.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  lake.rotation.z += 0.0015;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', resizeRenderer);
resizeRenderer();
animate();
