(function createSystemBodies() {

  // ── Shared GLSL noise utilities ────────────────────────────────────────
  var NOISE_GLSL = [
    'float _h(vec3 p){p=fract(p*vec3(127.1,311.7,74.7));p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}',
    'float _n(vec3 p){',
    '  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
    '  return mix(',
    '    mix(mix(_h(i),_h(i+vec3(1,0,0)),f.x),mix(_h(i+vec3(0,1,0)),_h(i+vec3(1,1,0)),f.x),f.y),',
    '    mix(mix(_h(i+vec3(0,0,1)),_h(i+vec3(1,0,1)),f.x),mix(_h(i+vec3(0,1,1)),_h(i+vec3(1,1,1)),f.x),f.y),f.z);',
    '}',
    'float fbm(vec3 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*_n(p);p=p*2.1+vec3(5.2,1.3,8.7);a*=0.5;}return v;}',
  ].join('\n');

  var SURFACE_VERT = [
    'varying vec3 vPos;',
    'void main() {',
    '  vPos = position;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}',
  ].join('\n');

  // ── Sun fill — thermal plasma / granulation ────────────────────────────
  function makeSunShader() {
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0.0 } },
      vertexShader: SURFACE_VERT,
      fragmentShader: [
        'uniform float time;',
        'varying vec3 vPos;',
        NOISE_GLSL,
        'void main() {',
        '  vec3 p = normalize(vPos);',
        '  float t = time;',
        // Two fbm layers at different speeds — creates drifting convection cells
        '  float n  = fbm(p*3.8 + vec3(t*0.055, t*0.035, t*0.020));',
        '  float n2 = fbm(p*7.2 + vec3(-t*0.025, t*0.042, t*0.018));',
        '  float pat = n*0.6 + n2*0.4;',
        // Very dark baseline with barely-visible warm highlights
        '  vec3 dark = vec3(0.026, 0.020, 0.014);',
        '  vec3 glow = vec3(0.110, 0.068, 0.028);',
        '  vec3 col = mix(dark, glow, pow(pat, 2.0));',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
    });
  }

  // ── Jupiter fill — animated horizontal gas bands ───────────────────────
  function makeJupiterShader() {
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0.0 } },
      vertexShader: SURFACE_VERT,
      fragmentShader: [
        'uniform float time;',
        'varying vec3 vPos;',
        NOISE_GLSL,
        'void main() {',
        '  vec3 p = normalize(vPos);',
        '  float t = time * 0.042;',
        // Warp the latitude slightly with noise for turbulent band edges
        '  float warp = _n(vec3(p.x*2.5, p.y*3.0+t, p.z*2.5)) * 0.18;',
        // Horizontal bands along Y axis
        '  float y = p.y + warp;',
        '  float bands = sin(y * 13.0 + t*0.5) * 0.5 + 0.5;',
        // Fine detail noise
        '  float detail = _n(vec3(p.x*6.0 + t*0.3, p.y*9.0, p.z*6.0));',
        '  float pat = bands*0.65 + detail*0.35;',
        '  vec3 dark = vec3(0.024, 0.016, 0.010);',
        '  vec3 band = vec3(0.100, 0.058, 0.022);',
        '  vec3 col = mix(dark, band, pow(pat, 1.6) * 0.92);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
    });
  }

  // ── Saturn ring — radial gradient + Cassini division ──────────────────
  function makeSaturnRingShader(innerR, outerR, color) {
    var c = new THREE.Color(color);
    return new THREE.ShaderMaterial({
      uniforms: {
        innerR:    { value: innerR },
        outerR:    { value: outerR },
        ringColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
      },
      vertexShader: [
        'varying vec2 vPos2D;',
        'void main() {',
        '  vPos2D = position.xy;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform float innerR;',
        'uniform float outerR;',
        'uniform vec3 ringColor;',
        'varying vec2 vPos2D;',
        'void main() {',
        '  float r = (length(vPos2D) - innerR) / (outerR - innerR);',
        '  r = clamp(r, 0.0, 1.0);',
        // Cassini division — dark gap at ~57%
        '  float gap = smoothstep(0.50,0.55,r) * (1.0 - smoothstep(0.55,0.61,r));',
        '  float cassini = 1.0 - gap * 0.88;',
        // Radial density profile — denser toward inner edge
        '  float profile = 0.25 + 0.75 * pow(1.0 - r, 0.55);',
        // Subtle sub-bands
        '  float subband = 0.88 + 0.12 * sin(r * 32.0);',
        '  float alpha = profile * cassini * subband * 0.68;',
        '  gl_FragColor = vec4(ringColor, alpha);',
        '}',
      ].join('\n'),
      transparent: true,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });
  }

  // Collect all time-animated shader materials for main.js tick
  Orbital.shaderMats = [];

  // ── Sun ───────────────────────────────────────────────────────────────
  var sunShaderMat = makeSunShader();
  Orbital.shaderMats.push(sunShaderMat);

  var sunGeometry = new THREE.SphereGeometry(2.8, 32, 32);
  Orbital.sun = new THREE.Mesh(sunGeometry, sunShaderMat);
  Orbital.sun.position.set(0, Orbital.systemCenterY, 0);
  Orbital.sun.userData = {
    type: "sun",
    name: "About",
    panelId: "about-panel",
    focusDistance: 6.8,
    labelYOffset: 3.8,
    radius: 2.8,
  };

  var sunOutlineGeometry = new THREE.SphereGeometry(2.8 * 1.06, 32, 32);
  var sunOutlineMaterial = new THREE.MeshBasicMaterial({
    color: Orbital.palette.sun,
    side: THREE.BackSide,
  });
  Orbital.sun.add(new THREE.Mesh(sunOutlineGeometry, sunOutlineMaterial));
  Orbital.scene.add(Orbital.sun);

  // Subtle outer glow halo
  var haloGeometry = new THREE.SphereGeometry(4.4, 24, 24);
  var haloMaterial = new THREE.MeshBasicMaterial({
    color: Orbital.palette.sun,
    transparent: true,
    opacity: 0.04,
    side: THREE.BackSide,
  });
  Orbital.sunHalo = new THREE.Mesh(haloGeometry, haloMaterial);
  Orbital.sunHalo.position.copy(Orbital.sun.position);
  Orbital.scene.add(Orbital.sunHalo);

  // Corona layers
  [
    { r: 6.2,  o: 0.028 },
    { r: 8.8,  o: 0.014 },
    { r: 13.0, o: 0.006 },
  ].forEach(function (layer) {
    var coronaMesh = new THREE.Mesh(
      new THREE.SphereGeometry(layer.r, 20, 20),
      new THREE.MeshBasicMaterial({
        color: Orbital.palette.sun,
        transparent: true,
        opacity: layer.o,
        side: THREE.BackSide,
      }),
    );
    coronaMesh.position.copy(Orbital.sun.position);
    Orbital.scene.add(coronaMesh);
  });

  // ── Planet data ───────────────────────────────────────────────────────
  Orbital.planetData = [
    {
      name: null, interactive: false,
      outlineColor: 0x8a8a8a, radius: 0.22,
      orbitRadius: 4.5, orbitSpeed: 0.45, orbitOffset: 1.2, tilt: 0.01,
    },
    {
      name: null, interactive: false,
      outlineColor: 0xd4b060, radius: 0.45,
      orbitRadius: 6.8, orbitSpeed: 0.35, orbitOffset: 3.8, tilt: -0.02,
    },
    {
      name: null, interactive: false,
      outlineColor: 0x3a6eb5, radius: 0.9,
      orbitRadius: 9.2, orbitSpeed: 0.22, orbitOffset: 0.4, tilt: -0.03,
    },
    {
      name: null, interactive: false,
      outlineColor: 0xb04020, radius: 0.35,
      orbitRadius: 11.8, orbitSpeed: 0.17, orbitOffset: 2.1, tilt: 0.02,
    },
    {
      name: "Skills", panelId: "skills-panel", interactive: true,
      outlineColor: 0xc07840, radius: 1.35,
      orbitRadius: 15.5, orbitSpeed: 0.1, orbitOffset: 4.3, tilt: -0.04,
      focusDistance: 6.5,
      shaderType: "jupiter",
    },
    {
      name: "Projects", panelId: "projects-panel", interactive: true,
      outlineColor: 0xd4c060, radius: 1.1,
      orbitRadius: 19.5, orbitSpeed: 0.072, orbitOffset: 5.5, tilt: 0.03,
      focusDistance: 4.2,
      hasRings: true,
    },
    {
      name: null, interactive: false,
      outlineColor: 0x70d8d0, radius: 0.7,
      orbitRadius: 23.5, orbitSpeed: 0.05, orbitOffset: 2.9, tilt: -0.02,
    },
    {
      name: null, interactive: false,
      outlineColor: 0x2848b0, radius: 0.65,
      orbitRadius: 27.5, orbitSpeed: 0.036, orbitOffset: 1.7, tilt: 0.01,
    },
  ];

  Orbital.interactiveBodies = [Orbital.sun];

  Orbital.planetData.forEach(function (data) {
    // Orbit ring
    var orbitGeometry = new THREE.RingGeometry(
      data.orbitRadius - 0.018,
      data.orbitRadius + 0.018,
      64,
    );
    var orbitMaterial = new THREE.MeshBasicMaterial({
      color: 0x505050, side: THREE.DoubleSide, transparent: true, opacity: 0.12,
    });
    var orbitRing = new THREE.Mesh(orbitGeometry, orbitMaterial);
    orbitRing.position.set(0, Orbital.systemCenterY, 0);
    orbitRing.rotation.x = Math.PI / 2;
    Orbital.scene.add(orbitRing);

    // Planet fill — shader for Jupiter, MeshBasicMaterial for others
    var geometry   = new THREE.SphereGeometry(data.radius, 32, 32);
    var fillMat;
    if (data.shaderType === "jupiter") {
      fillMat = makeJupiterShader();
      Orbital.shaderMats.push(fillMat);
    } else {
      fillMat = new THREE.MeshBasicMaterial({ color: 0x07070a });
    }
    var mesh = new THREE.Mesh(geometry, fillMat);

    // Colored outline sphere
    var outlineGeometry = new THREE.SphereGeometry(data.radius * 1.08, 32, 32);
    var outlineMaterial = new THREE.MeshBasicMaterial({
      color: data.outlineColor, side: THREE.BackSide,
    });
    mesh.add(new THREE.Mesh(outlineGeometry, outlineMaterial));

    // Saturn rings — shader with Cassini division
    if (data.hasRings) {
      var ringInner = data.radius * 1.45;
      var ringOuter = data.radius * 2.55;
      var ringMat   = makeSaturnRingShader(ringInner, ringOuter, data.outlineColor);
      var ringMesh  = new THREE.Mesh(new THREE.RingGeometry(ringInner, ringOuter, 56), ringMat);
      ringMesh.rotation.x = Math.PI * 0.38;
      mesh.add(ringMesh);
    }

    mesh.userData = {
      type: "planet",
      name: data.name,
      panelId: data.panelId || null,
      orbitRadius: data.orbitRadius,
      orbitSpeed:  data.orbitSpeed,
      orbitOffset: data.orbitOffset,
      tilt:        data.tilt,
      focusDistance:  data.focusDistance  || null,
      labelYOffset:   data.radius * 1.6 + 0.5,
      radius:         data.radius,
    };

    // Set initial position from orbitOffset so interactive planets aren't at origin
    var initAngle = data.orbitOffset;
    mesh.position.x = Math.cos(initAngle) * data.orbitRadius;
    mesh.position.z = Math.sin(initAngle) * data.orbitRadius;
    mesh.position.y = Orbital.systemCenterY + Math.sin(initAngle * 1.4) * data.tilt;

    Orbital.scene.add(mesh);
    Orbital.planets.push(mesh);
    if (data.interactive) {
      Orbital.interactiveBodies.push(mesh);
    }
  });

  // ── Asteroid belt ─────────────────────────────────────────────────────
  var beltCount = 180;
  var beltPos   = new Float32Array(beltCount * 3);
  for (var bi = 0; bi < beltCount; bi++) {
    var bAngle = Math.random() * Math.PI * 2;
    var bR     = 13.2 + Math.random() * 1.0;
    beltPos[bi * 3]     = Math.cos(bAngle) * bR;
    beltPos[bi * 3 + 1] = Orbital.systemCenterY + (Math.random() - 0.5) * 0.9;
    beltPos[bi * 3 + 2] = Math.sin(bAngle) * bR;
  }
  var beltGeo = new THREE.BufferGeometry();
  beltGeo.setAttribute("position", new THREE.BufferAttribute(beltPos, 3));
  Orbital.asteroidBelt = new THREE.Points(beltGeo, new THREE.PointsMaterial({
    color: 0x9a9080, size: 0.18, transparent: true, opacity: 0.5,
  }));
  Orbital.scene.add(Orbital.asteroidBelt);

  Orbital.updatePlanets = function updatePlanets(elapsed) {
    if (Orbital.sunHalo) {
      Orbital.sunHalo.scale.setScalar(1 + Math.sin(elapsed * 0.55) * 0.02);
    }
    Orbital.planets.forEach(function (planet) {
      var info  = planet.userData;
      var angle = elapsed * info.orbitSpeed * 0.2 + info.orbitOffset;
      planet.position.x = Math.cos(angle) * info.orbitRadius;
      planet.position.z = Math.sin(angle) * info.orbitRadius;
      planet.position.y = Orbital.systemCenterY + Math.sin(angle * 1.4) * info.tilt;
    });
  };
})();
