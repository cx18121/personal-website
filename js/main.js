(function start() {
  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
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

  window.addEventListener("resize", onResize);

  // Reset clock and clear trails when tab regains focus to avoid
  // a huge delta accumulation and the resulting long artifact lines
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

  var orbitTime = 0;
  var lastTime = Orbital.clock.getElapsedTime();

  // Prime planet positions before first frame
  Orbital.updatePlanets(orbitTime);

  // Planet intro stagger — start invisible, scale in after fade
  if (!reducedMotion) {
    Orbital.sun.scale.setScalar(0);
    Orbital.planets.forEach(function (p) {
      p.scale.setScalar(0);
    });
  }

  // 1. Intro fade-in
  var overlay = document.getElementById("intro-overlay");
  setTimeout(function () {
    overlay.style.opacity = "0";
    setTimeout(function () {
      overlay.style.display = "none";
    }, 1500);
    if (!reducedMotion) {
      // Stagger planets in as the scene reveals
      var bodies = [Orbital.sun].concat(Orbital.planets);
      bodies.forEach(function (body, i) {
        gsap.to(body.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.85,
          delay: 0.1 + i * 0.07,
          ease: "back.out(1.4)",
        });
      });
    }
  }, 80);

  // Auto-focus sun on load — open about panel after intro settles
  setTimeout(function () {
    if (!Orbital.focusedPlanet && typeof Orbital.focusPlanet === 'function') {
      Orbital.focusPlanet(Orbital.sun);
    }
  }, 0);

// 6. Typewriter — type site name letter by letter after fade begins
  var siteNameEl = document.querySelector(".site-name");
  var fullText = siteNameEl.textContent;
  if (reducedMotion) {
    // Show text immediately, no typewriter
  } else {
    siteNameEl.textContent = "";
    var charIdx = 0;
    setTimeout(function () {
      var typeTimer = setInterval(function () {
        siteNameEl.textContent += fullText[charIdx];
        charIdx++;
        if (charIdx >= fullText.length) {
          clearInterval(typeTimer);
        }
      }, 72);
    }, 320);
  }

  // 2. Persistent labels for interactive bodies
  var labelVec = new THREE.Vector3();
  Orbital.bodyLabels = Orbital.interactiveBodies.map(function (body) {
    var el = document.createElement("div");
    el.className = "body-label";
    el.textContent = body.userData.name;
    document.body.appendChild(el);
    return { mesh: body, el: el };
  });

  // 4. Hover reticle
  var reticleEl = document.getElementById("hover-reticle");

  // 5. Orbit trails — Line geometry trailing behind each planet
  var trailMaxLen = 55;
  Orbital.trails = Orbital.planets.map(function (body) {
    var positions = new Float32Array(trailMaxLen * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 0);
    var mat = new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.35,
    });
    var line = new THREE.Line(geo, mat);
    Orbital.scene.add(line);
    return {
      body: body,
      geo: geo,
      positions: positions,
      history: [],
      frame: 0,
    };
  });

  // 2. Planet pulse on hover — track previous hovered body to reset scale
  var prevHovered = null;

  // Hyperspace warp — star size spike when jumping to a planet
  Orbital.triggerWarp = function () {
    if (reducedMotion || !Orbital.starLayers) {
      return;
    }
    Orbital.starLayers.forEach(function (layer) {
      var base = layer.material.size;
      gsap.killTweensOf(layer.material);
      gsap.to(layer.material, {
        size: base * 16,
        duration: 0.12,
        ease: "power2.out",
        onComplete: function () {
          gsap.to(layer.material, {
            size: base,
            duration: 0.42,
            ease: "power3.in",
          });
        },
      });
    });
  };

  // Mouse parallax — track normalized cursor position
  var parallaxTarget = { x: 0, y: 0 };
  var parallaxCurrent = { x: 0, y: 0 };
  Orbital.resetParallax = function () {
    parallaxCurrent.x = 0;
    parallaxCurrent.y = 0;
    parallaxTarget.x = 0;
    parallaxTarget.y = 0;
  };
  window.addEventListener(
    "mousemove",
    function (e) {
      parallaxTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
      parallaxTarget.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true },
  );

  // Click ripple pool
  Orbital.ripples = [];
  Orbital.spawnRipple = function (planet) {
    var r = (planet.userData.radius || 1) * 1.15;
    var geo = new THREE.RingGeometry(r, r + 0.1, 64);
    var mat = new THREE.MeshBasicMaterial({
      color: 0xd8d4cc,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(planet.position);
    mesh.rotation.x = Math.PI / 2;
    Orbital.scene.add(mesh);
    Orbital.ripples.push({ mesh: mesh, progress: 0 });
  };

  function tick() {
    requestAnimationFrame(tick);
    var now = Orbital.clock.getElapsedTime();
    var delta = now - lastTime;
    lastTime = now;
    if (!Orbital.isOrbitPaused) {
      orbitTime += delta;
      Orbital.updatePlanets(orbitTime);
      if (Orbital.asteroidBelt) {
        Orbital.asteroidBelt.rotation.y += delta * 0.022;
      }
    }

    // Update orbit trails
    var hideTrails = reducedMotion || !!Orbital.focusedPlanet || Orbital.isTransitioning;
    Orbital.trails.forEach(function (t) {
      t.frame++;
      if (!Orbital.isOrbitPaused && t.frame % 2 === 0) {
        t.history.unshift({
          x: t.body.position.x,
          y: t.body.position.y,
          z: t.body.position.z,
        });
        if (t.history.length > trailMaxLen) {
          t.history.pop();
        }
      }
      var n = t.history.length;
      if (hideTrails || n < 2) {
        t.geo.setDrawRange(0, 0);
      } else {
        for (var i = 0; i < n; i++) {
          t.positions[i * 3] = t.history[i].x;
          t.positions[i * 3 + 1] = t.history[i].y;
          t.positions[i * 3 + 2] = t.history[i].z;
        }
        t.geo.setDrawRange(0, n);
        t.geo.attributes.position.needsUpdate = true;
      }
    });

    // Update persistent label positions
    Orbital.bodyLabels.forEach(function (item) {
      if (Orbital.focusedPlanet) {
        item.el.style.opacity = "0";
        return;
      }
      // Project planet center for screenX (keeps label horizontally centered)
      labelVec.copy(item.mesh.position);
      labelVec.project(Orbital.camera);
      if (labelVec.z > 1) {
        item.el.style.opacity = "0";
        return;
      }
      var screenX = (labelVec.x * 0.5 + 0.5) * window.innerWidth;
      // Project offset point for screenY only
      labelVec.set(
        item.mesh.position.x,
        item.mesh.position.y + (item.mesh.userData.labelYOffset || 2),
        item.mesh.position.z,
      );
      labelVec.project(Orbital.camera);
      var screenY = (-labelVec.y * 0.5 + 0.5) * window.innerHeight;
      item.el.style.left = screenX + "px";
      item.el.style.top = screenY + "px";
      item.el.style.opacity = "1";
    });

    // Update hover reticle position and size
    if (
      Orbital.hoveredPlanet &&
      Orbital.hoveredPlanet.userData.panelId &&
      !Orbital.focusedPlanet
    ) {
      var hp = Orbital.hoveredPlanet;
      labelVec.copy(hp.position);
      labelVec.project(Orbital.camera);
      var rScreenX = (labelVec.x * 0.5 + 0.5) * window.innerWidth;
      var rScreenY = (-labelVec.y * 0.5 + 0.5) * window.innerHeight;
      // Project a point offset by planet radius upward to get screen-space size
      var hpRadius = hp.userData.radius || 1;
      labelVec.set(hp.position.x, hp.position.y + hpRadius, hp.position.z);
      labelVec.project(Orbital.camera);
      var edgeY = (-labelVec.y * 0.5 + 0.5) * window.innerHeight;
      var screenR = Math.max(14, Math.abs(edgeY - rScreenY));
      var reticlePx = screenR * 2.6;
      reticleEl.style.left = rScreenX + "px";
      reticleEl.style.top = rScreenY + "px";
      reticleEl.style.width = reticlePx + "px";
      reticleEl.style.height = reticlePx + "px";
      reticleEl.classList.add("visible");
    } else {
      reticleEl.classList.remove("visible");
    }



    // Planet pulse on hover
    if (!reducedMotion && Orbital.hoveredPlanet && !Orbital.focusedPlanet) {
      if (prevHovered !== Orbital.hoveredPlanet) {
        if (prevHovered) {
          prevHovered.scale.setScalar(1);
        }
        prevHovered = Orbital.hoveredPlanet;
      }
      Orbital.hoveredPlanet.scale.setScalar(1 + Math.sin(now * 4.5) * 0.04);
    } else if (prevHovered) {
      prevHovered.scale.setScalar(1);
      prevHovered = null;
    }

    // Ripple updates
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

    // Mouse parallax — gently shift lookAt toward cursor when not in transition
    if (!Orbital.focusedPlanet && !Orbital.isTransitioning) {
      parallaxCurrent.x += (parallaxTarget.x - parallaxCurrent.x) * 0.04;
      parallaxCurrent.y += (parallaxTarget.y - parallaxCurrent.y) * 0.04;
      var base = Orbital.defaultCamera.lookAt;
      Orbital.camera.lookAt(
        base.x + parallaxCurrent.x * 1.8,
        base.y + parallaxCurrent.y * 0.9,
        base.z,
      );
    }

    Orbital.renderer.render(Orbital.scene, Orbital.camera);
  }

  tick();
})();
