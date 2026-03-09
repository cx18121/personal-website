(function createSystemBodies() {
  // Sun — dark fill + warm outline
  var sunGeometry = new THREE.SphereGeometry(2.8, 48, 48);
  var sunFillMaterial = new THREE.MeshBasicMaterial({ color: 0x07070a });

  Orbital.sun = new THREE.Mesh(sunGeometry, sunFillMaterial);
  Orbital.sun.position.set(0, Orbital.systemCenterY, 0);
  Orbital.sun.userData = {
    type: "sun",
    name: "About",
    panelId: "about-panel",
    focusDistance: 6.8,
    labelYOffset: 3.8,
    radius: 2.8,
  };

  var sunOutlineGeometry = new THREE.SphereGeometry(2.8 * 1.06, 48, 48);
  var sunOutlineMaterial = new THREE.MeshBasicMaterial({
    color: Orbital.palette.sun,
    side: THREE.BackSide,
  });
  Orbital.sun.add(new THREE.Mesh(sunOutlineGeometry, sunOutlineMaterial));
  Orbital.scene.add(Orbital.sun);

  // Subtle outer glow halo
  var haloGeometry = new THREE.SphereGeometry(4.4, 48, 48);
  var haloMaterial = new THREE.MeshBasicMaterial({
    color: Orbital.palette.sun,
    transparent: true,
    opacity: 0.04,
    side: THREE.BackSide,
  });
  Orbital.sunHalo = new THREE.Mesh(haloGeometry, haloMaterial);
  Orbital.sunHalo.position.copy(Orbital.sun.position);
  Orbital.scene.add(Orbital.sunHalo);

  // Corona layers — stacked transparent shells for a soft stellar glow
  [
    { r: 6.2, o: 0.028 },
    { r: 8.8, o: 0.014 },
    { r: 13.0, o: 0.006 },
  ].forEach(function (layer) {
    var coronaMesh = new THREE.Mesh(
      new THREE.SphereGeometry(layer.r, 32, 32),
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

  // Solar system planets
  // interactive: true  → has a content panel (Earth, Jupiter, Saturn)
  // interactive: false → decorative only
  Orbital.planetData = [
    {
      name: null,
      interactive: false,
      outlineColor: 0x8a8a8a, // Mercury — gray
      radius: 0.22,
      orbitRadius: 4.5,
      orbitSpeed: 0.45,
      orbitOffset: 1.2,
      tilt: 0.01,
    },
    {
      name: null,
      interactive: false,
      outlineColor: 0xd4b060, // Venus — pale gold
      radius: 0.45,
      orbitRadius: 6.8,
      orbitSpeed: 0.35,
      orbitOffset: 3.8,
      tilt: -0.02,
    },
    {
      name: "Projects",
      panelId: "projects-panel",
      interactive: true,
      outlineColor: 0x3a6eb5, // Earth — blue
      radius: 0.9,
      orbitRadius: 9.2,
      orbitSpeed: 0.22,
      orbitOffset: 0.4,
      tilt: -0.03,
      focusDistance: 2.8,
    },
    {
      name: null,
      interactive: false,
      outlineColor: 0xb04020, // Mars — red-orange
      radius: 0.35,
      orbitRadius: 11.8,
      orbitSpeed: 0.17,
      orbitOffset: 2.1,
      tilt: 0.02,
    },
    {
      name: "Skills",
      panelId: "skills-panel",
      interactive: true,
      outlineColor: 0xc07840, // Jupiter — orange-tan
      radius: 1.35,
      orbitRadius: 16.5,
      orbitSpeed: 0.1,
      orbitOffset: 4.3,
      tilt: -0.04,
      focusDistance: 3.8,
    },
    {
      name: "Contact",
      panelId: "contact-panel",
      interactive: true,
      outlineColor: 0xd4c060, // Saturn — pale gold
      radius: 1.1,
      orbitRadius: 22.5,
      orbitSpeed: 0.072,
      orbitOffset: 5.5,
      tilt: 0.03,
      focusDistance: 4.2,
      hasRings: true,
    },
    {
      name: null,
      interactive: false,
      outlineColor: 0x70d8d0, // Uranus — pale aqua
      radius: 0.7,
      orbitRadius: 27.5,
      orbitSpeed: 0.05,
      orbitOffset: 2.9,
      tilt: -0.02,
    },
    {
      name: null,
      interactive: false,
      outlineColor: 0x2848b0, // Neptune — deep blue
      radius: 0.65,
      orbitRadius: 32.5,
      orbitSpeed: 0.036,
      orbitOffset: 1.7,
      tilt: 0.01,
    },
  ];

  // Only interactive planets go into interactiveBodies
  Orbital.interactiveBodies = [Orbital.sun];

  Orbital.planetData.forEach(function (data) {
    // Orbit ring
    var orbitGeometry = new THREE.RingGeometry(
      data.orbitRadius - 0.018,
      data.orbitRadius + 0.018,
      128,
    );
    var orbitMaterial = new THREE.MeshBasicMaterial({
      color: 0x505050,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.12,
    });
    var orbitRing = new THREE.Mesh(orbitGeometry, orbitMaterial);
    orbitRing.position.set(0, Orbital.systemCenterY, 0);
    orbitRing.rotation.x = Math.PI / 2;
    Orbital.scene.add(orbitRing);

    // Planet — dark fill + colored outline
    var geometry = new THREE.SphereGeometry(data.radius, 32, 32);
    var fillMaterial = new THREE.MeshBasicMaterial({ color: 0x07070a });
    var mesh = new THREE.Mesh(geometry, fillMaterial);

    var outlineGeometry = new THREE.SphereGeometry(data.radius * 1.08, 32, 32);
    var outlineMaterial = new THREE.MeshBasicMaterial({
      color: data.outlineColor,
      side: THREE.BackSide,
    });
    mesh.add(new THREE.Mesh(outlineGeometry, outlineMaterial));

    // Saturn's rings
    if (data.hasRings) {
      var ringInner = data.radius * 1.45;
      var ringOuter = data.radius * 2.55;
      var ringGeometry = new THREE.RingGeometry(ringInner, ringOuter, 80);
      var ringMaterial = new THREE.MeshBasicMaterial({
        color: data.outlineColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      });
      var ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
      ringMesh.rotation.x = Math.PI * 0.38;
      mesh.add(ringMesh);
    }

    mesh.userData = {
      type: "planet",
      name: data.name,
      panelId: data.panelId || null,
      orbitRadius: data.orbitRadius,
      orbitSpeed: data.orbitSpeed,
      orbitOffset: data.orbitOffset,
      tilt: data.tilt,
      focusDistance: data.focusDistance || null,
      labelYOffset: data.radius * 1.6 + 0.5,
      radius: data.radius,
    };

    Orbital.scene.add(mesh);
    Orbital.planets.push(mesh);

    if (data.interactive) {
      Orbital.interactiveBodies.push(mesh);
    }
  });

  // Asteroid belt — sparse field between Mars (11.8) and Jupiter (16.5)
  var beltCount = 180;
  var beltPos = new Float32Array(beltCount * 3);
  for (var bi = 0; bi < beltCount; bi++) {
    var bAngle = Math.random() * Math.PI * 2;
    var bR = 13.0 + Math.random() * 2.2;
    beltPos[bi * 3] = Math.cos(bAngle) * bR;
    beltPos[bi * 3 + 1] = Orbital.systemCenterY + (Math.random() - 0.5) * 0.9;
    beltPos[bi * 3 + 2] = Math.sin(bAngle) * bR;
  }
  var beltGeo = new THREE.BufferGeometry();
  beltGeo.setAttribute("position", new THREE.BufferAttribute(beltPos, 3));
  var beltMat = new THREE.PointsMaterial({
    color: 0x9a9080,
    size: 0.18,
    transparent: true,
    opacity: 0.5,
  });
  Orbital.asteroidBelt = new THREE.Points(beltGeo, beltMat);
  Orbital.scene.add(Orbital.asteroidBelt);

  Orbital.updatePlanets = function updatePlanets(elapsed) {
    if (Orbital.sunHalo) {
      Orbital.sunHalo.scale.setScalar(1 + Math.sin(elapsed * 0.55) * 0.02);
    }
    Orbital.planets.forEach(function (planet) {
      var info = planet.userData;
      var angle = elapsed * info.orbitSpeed + info.orbitOffset;
      planet.position.x = Math.cos(angle) * info.orbitRadius;
      planet.position.z = Math.sin(angle) * info.orbitRadius;
      planet.position.y =
        Orbital.systemCenterY + Math.sin(angle * 1.4) * info.tilt;
    });
  };
})();
