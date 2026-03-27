(function start() {
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  Orbital.reducedMotion = reducedMotion;

  function onResize() {
    Orbital.applyViewportConfig();
    Orbital.camera.aspect = window.innerWidth / window.innerHeight;
    Orbital.camera.updateProjectionMatrix();
    Orbital.renderer.setSize(window.innerWidth, window.innerHeight);
    if (!Orbital.focusedPlanet) {
      Orbital.camera.position.copy(Orbital.defaultCamera.position);
      Orbital.camera.lookAt(Orbital.defaultCamera.lookAt);
    }
  }
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onResize, 120);
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      lastTime = Orbital.clock.getElapsedTime();
      if (Orbital.trails) {
        Orbital.trails.forEach(function (t) {
          t.history = [];
          t.geo.setDrawRange(0, 0);
        });
      }
    }
  });

  // ── Render loop setup ─────────────────────────────────────────────────
  var orbitTime = 0;
  var lastTime  = Orbital.clock.getElapsedTime();
  var labelVec  = new THREE.Vector3();

  Orbital.updatePlanets(orbitTime);

  if (!reducedMotion) {
    Orbital.sun.scale.setScalar(0);
    Orbital.planets.forEach(function (p) { p.scale.setScalar(0); });
  }

  // Intro fade-in
  var overlay = document.getElementById("intro-overlay");
  setTimeout(function () {
    overlay.style.opacity = "0";
    setTimeout(function () { overlay.style.display = "none"; }, 1500);
    if (!reducedMotion) {
      var bodies = [Orbital.sun].concat(Orbital.planets);
      bodies.forEach(function (body, i) {
        gsap.to(body.scale, {
          x: 1, y: 1, z: 1,
          duration: 0.85,
          delay:    0.1 + i * 0.07,
          ease:     "back.out(1.4)",
        });
      });
    }
  }, 80);

  // Auto-focus sun on load
  setTimeout(function () {
    if (!Orbital.focusedPlanet && typeof Orbital.focusPlanet === "function") {
      Orbital.focusPlanet(Orbital.sun);
    }
  }, 0);

  // Typewriter
  var siteNameEl = document.querySelector(".site-name");
  var fullText   = siteNameEl.textContent;
  if (!reducedMotion) {
    siteNameEl.textContent = "";
    var charIdx = 0;
    setTimeout(function () {
      var typeTimer = setInterval(function () {
        siteNameEl.textContent += fullText[charIdx];
        charIdx++;
        if (charIdx >= fullText.length) { clearInterval(typeTimer); }
      }, 72);
    }, 320);
  }

  // Persistent labels
  Orbital.bodyLabels = Orbital.interactiveBodies.map(function (body) {
    var el = document.createElement("div");
    el.className   = "body-label";
    el.textContent = body.userData.name;
    document.body.appendChild(el);
    return { mesh: body, el: el };
  });

  // Hover reticle
  var reticleEl = document.getElementById("hover-reticle");

  // Orbit trails
  var trailMaxLen = 55;
  Orbital.trails = Orbital.planets.map(function (body) {
    var positions = new Float32Array(trailMaxLen * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 0);
    var mat  = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.35 });
    var line = new THREE.Line(geo, mat);
    Orbital.scene.add(line);
    return { body: body, geo: geo, positions: positions, history: [], frame: 0 };
  });

  var prevHovered = null;

  // Hyperspace warp
  Orbital.triggerWarp = function () {
    if (reducedMotion || !Orbital.starLayers) { return; }
    Orbital.starLayers.forEach(function (layer) {
      var base = layer.material.size;
      gsap.killTweensOf(layer.material);
      gsap.to(layer.material, {
        size: base * 16,
        duration: 0.12,
        ease: "power2.out",
        onComplete: function () {
          gsap.to(layer.material, { size: base, duration: 0.42, ease: "power3.in" });
        },
      });
    });
  };

  Orbital.resetParallax = function () {};

  // Click ripples
  Orbital.ripples = [];
  Orbital.spawnRipple = function (planet) {
    var r   = (planet.userData.radius || 1) * 1.15;
    var geo = new THREE.RingGeometry(r, r + 0.1, 64);
    var mat = new THREE.MeshBasicMaterial({
      color: 0xd8d4cc, transparent: true, opacity: 0.65, side: THREE.DoubleSide,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(planet.position);
    mesh.rotation.x = Math.PI / 2;
    Orbital.scene.add(mesh);
    Orbital.ripples.push({ mesh: mesh, progress: 0 });
  };

  // ── Tick ─────────────────────────────────────────────────────────────
  function tick() {
    requestAnimationFrame(tick);
    var now   = Orbital.clock.getElapsedTime();
    var delta = now - lastTime;
    lastTime  = now;

    if (!Orbital.isOrbitPaused) {
      orbitTime += delta;
      Orbital.updatePlanets(orbitTime);
      if (Orbital.asteroidBelt) {
        Orbital.asteroidBelt.rotation.y += delta * 0.022;
      }
    }

    // Tick shader time uniforms
    if (Orbital.nebulaMat && !reducedMotion) {
      Orbital.nebulaMat.uniforms.time.value = now;
    }
    if (Orbital.shaderMats) {
      Orbital.shaderMats.forEach(function (m) {
        m.uniforms.time.value = now;
      });
    }

    // Orbit trails
    var hideTrails = reducedMotion || !!Orbital.focusedPlanet || Orbital.isTransitioning;
    Orbital.trails.forEach(function (t) {
      t.frame++;
      if (!Orbital.isOrbitPaused && t.frame % 2 === 0) {
        t.history.unshift({ x: t.body.position.x, y: t.body.position.y, z: t.body.position.z });
        if (t.history.length > trailMaxLen) { t.history.pop(); }
      }
      var n = t.history.length;
      if (hideTrails || n < 2) {
        t.geo.setDrawRange(0, 0);
      } else {
        for (var i = 0; i < n; i++) {
          t.positions[i * 3]     = t.history[i].x;
          t.positions[i * 3 + 1] = t.history[i].y;
          t.positions[i * 3 + 2] = t.history[i].z;
        }
        t.geo.setDrawRange(0, n);
        t.geo.attributes.position.needsUpdate = true;
      }
    });

    // Persistent label positions
    Orbital.bodyLabels.forEach(function (item) {
      if (Orbital.focusedPlanet) { item.el.style.opacity = "0"; return; }
      labelVec.copy(item.mesh.position);
      labelVec.project(Orbital.camera);
      if (labelVec.z > 1) { item.el.style.opacity = "0"; return; }
      var screenX = (labelVec.x * 0.5 + 0.5) * window.innerWidth;
      labelVec.set(
        item.mesh.position.x,
        item.mesh.position.y + (item.mesh.userData.labelYOffset || 2),
        item.mesh.position.z,
      );
      labelVec.project(Orbital.camera);
      var screenY = (-labelVec.y * 0.5 + 0.5) * window.innerHeight;
      item.el.style.left    = screenX + "px";
      item.el.style.top     = screenY + "px";
      item.el.style.opacity = "1";
    });

    // Hover reticle
    if (Orbital.hoveredPlanet && Orbital.hoveredPlanet.userData.panelId && !Orbital.focusedPlanet) {
      var hp = Orbital.hoveredPlanet;
      labelVec.copy(hp.position);
      labelVec.project(Orbital.camera);
      var rScreenX = (labelVec.x * 0.5 + 0.5) * window.innerWidth;
      var rScreenY = (-labelVec.y * 0.5 + 0.5) * window.innerHeight;
      var hpRadius = hp.userData.radius || 1;
      labelVec.set(hp.position.x, hp.position.y + hpRadius, hp.position.z);
      labelVec.project(Orbital.camera);
      var edgeY     = (-labelVec.y * 0.5 + 0.5) * window.innerHeight;
      var screenR   = Math.max(14, Math.abs(edgeY - rScreenY));
      var reticlePx = screenR * 2.6;
      reticleEl.style.left   = rScreenX + "px";
      reticleEl.style.top    = rScreenY + "px";
      reticleEl.style.width  = reticlePx + "px";
      reticleEl.style.height = reticlePx + "px";
      reticleEl.classList.add("visible");
    } else {
      reticleEl.classList.remove("visible");
    }

    // Planet pulse on hover
    if (!reducedMotion && Orbital.hoveredPlanet && !Orbital.focusedPlanet) {
      if (prevHovered !== Orbital.hoveredPlanet) {
        if (prevHovered) { prevHovered.scale.setScalar(1); }
        prevHovered = Orbital.hoveredPlanet;
      }
      Orbital.hoveredPlanet.scale.setScalar(1 + Math.sin(now * 4.5) * 0.04);
    } else if (prevHovered) {
      prevHovered.scale.setScalar(1);
      prevHovered = null;
    }

    // Ripples
    for (var ri = Orbital.ripples.length - 1; ri >= 0; ri--) {
      var rip = Orbital.ripples[ri];
      rip.progress += delta * 1.2;
      rip.mesh.scale.setScalar(1 + rip.progress * 2.5);
      rip.mesh.material.opacity = 0.6 * (1 - rip.progress);
      if (rip.progress >= 1) {
        Orbital.scene.remove(rip.mesh);
        Orbital.ripples.splice(ri, 1);
      }
    }

    Orbital.renderer.render(Orbital.scene, Orbital.camera);
  }

  tick();
})();
