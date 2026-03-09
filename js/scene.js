window.Orbital = {
  palette: {
    background: 0x050508,
    text: "#e8e4dc",
    textDim: "#6b6760",
    accent: "#c4b99a",
    sun: 0xf5e6c8,
    about: 0xa89880,
    projects: 0x5a7d8a,
    skills: 0xb8a9c9,
    contact: 0xc8d8de,
  },
  scene: null,
  camera: null,
  renderer: null,
  clock: null,
  raycaster: null,
  pointer: null,
  planets: [],
  hoveredPlanet: null,
  focusedPlanet: null,
  focusedPanelId: null,
  isOrbitPaused: false,
  isTransitioning: false,
  systemCenterY: -1.15,
  isMobileViewport: false,
  defaultCameraDesktop: {
    position: new THREE.Vector3(26, 17, 32),
    lookAt: new THREE.Vector3(2, -3.5, 0),
  },
  defaultCameraMobile: {
    position: new THREE.Vector3(20, 14, 24),
    lookAt: new THREE.Vector3(1, -3, 0),
  },
  defaultCamera: {
    position: new THREE.Vector3(26, 17, 32),
    lookAt: new THREE.Vector3(2, -3.5, 0),
  },
};

Orbital.applyViewportConfig = function applyViewportConfig() {
  var mobile = window.innerWidth <= 900;
  Orbital.isMobileViewport = mobile;
  var preset = mobile
    ? Orbital.defaultCameraMobile
    : Orbital.defaultCameraDesktop;
  Orbital.defaultCamera.position.copy(preset.position);
  Orbital.defaultCamera.lookAt.copy(preset.lookAt);
};

(function initScene() {
  var root = document.getElementById("scene-root");

  Orbital.scene = new THREE.Scene();
  Orbital.scene.background = new THREE.Color(Orbital.palette.background);

  Orbital.applyViewportConfig();

  Orbital.camera = new THREE.PerspectiveCamera(
    52,
    window.innerWidth / window.innerHeight,
    0.1,
    450,
  );
  Orbital.camera.position.copy(Orbital.defaultCamera.position);
  Orbital.camera.lookAt(Orbital.defaultCamera.lookAt);

  Orbital.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  Orbital.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  Orbital.renderer.setSize(window.innerWidth, window.innerHeight);
  root.appendChild(Orbital.renderer.domElement);

  Orbital.clock = new THREE.Clock();
  Orbital.raycaster = new THREE.Raycaster();
  Orbital.pointer = new THREE.Vector2();

  var ambient = new THREE.AmbientLight(0xffffff, 0.18);
  Orbital.scene.add(ambient);

  // Sun emits light outward for planet shading
  var sunLight = new THREE.PointLight(Orbital.palette.sun, 0.9, 260, 2);
  sunLight.position.set(0, Orbital.systemCenterY, 0);
  Orbital.scene.add(sunLight);

  // Offset key light — creates the toon shadow boundary on the sun and near planets
  var keyLight = new THREE.DirectionalLight(0xfff5e8, 0.5);
  keyLight.position.set(14, 10, 16);
  Orbital.scene.add(keyLight);

  var fillLight = new THREE.DirectionalLight(0x8899aa, 0.15);
  fillLight.position.set(-20, 8, -10);
  Orbital.scene.add(fillLight);
})();
