(function initInteraction() {
    var label = document.getElementById("planet-label");
    var backButton = document.getElementById("back-btn");
    var panelsRoot = document.getElementById("panels");
    var currentLookTarget = Orbital.defaultCamera.lookAt.clone();

    function pointerToNdc(event) {
        var rect = Orbital.renderer.domElement.getBoundingClientRect();
        var x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        var y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        Orbital.pointer.set(x, y);
    }

    function setHover(body, clientX, clientY) {
        Orbital.hoveredPlanet = body;
        if (body) {
            label.textContent = body.userData.name;
            label.style.left = clientX + "px";
            label.style.top = clientY + "px";
            label.style.display = "block";
            document.body.style.cursor = "pointer";
            return;
        }
        label.style.display = "none";
        document.body.style.cursor = "default";
    }

    Orbital.focusPlanet = function focusPlanet(body) {
        if (!body || Orbital.focusedPlanet === body) {
            return;
        }
        Orbital.focusedPlanet = body;
        Orbital.isOrbitPaused = true;
        if (typeof Orbital.spawnRipple === "function") { Orbital.spawnRipple(body); }
        if (typeof Orbital.triggerWarp === "function") { Orbital.triggerWarp(); }

        var worldPos = body.position.clone();
        var isMobile = Orbital.isMobileViewport;
        var destination;

        if (body.userData.type === "sun") {
            var offset = isMobile ? new THREE.Vector3(0, 3.15, 6.1) : new THREE.Vector3(0, 3.8, 7.4);
            destination = worldPos.clone().add(offset);
        } else {
            var dirFromSun = worldPos.clone().sub(Orbital.sun.position).normalize();
            var focusScale = isMobile ? 0.86 : 1;
            var vertLift = isMobile ? 1.45 : 1.2;
            var sideLift = isMobile ? 0.58 : 0.8;
            var camOffset = dirFromSun.multiplyScalar(body.userData.focusDistance * focusScale)
                .add(new THREE.Vector3(sideLift, vertLift, sideLift));
            destination = worldPos.clone().add(camOffset);
        }

        gsap.to(Orbital.camera.position, {
            x: destination.x,
            y: destination.y,
            z: destination.z,
            duration: 1.1,
            ease: "power2.inOut",
            onComplete: function () {
                if (typeof Orbital.openPanel === "function") {
                    Orbital.openPanel(body.userData.panelId);
                }
            }
        });
        gsap.to(currentLookTarget, {
            x: worldPos.x,
            y: worldPos.y,
            z: worldPos.z,
            duration: 1.1,
            ease: "power2.inOut",
            onUpdate: function () {
                Orbital.camera.lookAt(currentLookTarget);
            }
        });
    };

    Orbital.resetCamera = function resetCamera() {
        Orbital.focusedPlanet = null;
        Orbital.isTransitioning = true;
        var lookTarget = Orbital.defaultCamera.lookAt.clone();

        gsap.to(Orbital.camera.position, {
            x: Orbital.defaultCamera.position.x,
            y: Orbital.defaultCamera.position.y,
            z: Orbital.defaultCamera.position.z,
            duration: 1.1,
            ease: "power2.inOut",
            onComplete: function () {
                Orbital.isOrbitPaused = false;
                Orbital.isTransitioning = false;
            }
        });
        gsap.to(currentLookTarget, {
            x: lookTarget.x,
            y: lookTarget.y,
            z: lookTarget.z,
            duration: 1.1,
            ease: "power2.inOut",
            onUpdate: function () {
                Orbital.camera.lookAt(currentLookTarget);
            }
        });
    };

    window.addEventListener("pointermove", function (event) {
        pointerToNdc(event);
        Orbital.raycaster.setFromCamera(Orbital.pointer, Orbital.camera);
        var hits = Orbital.raycaster.intersectObjects(Orbital.interactiveBodies || Orbital.planets, false);
        if (hits.length > 0 && !Orbital.focusedPlanet) {
            setHover(hits[0].object, event.clientX, event.clientY);
            return;
        }
        setHover(null, event.clientX, event.clientY);
    });

    function tryFocusFromPointer(event) {
        if (Orbital.focusedPlanet) {
            var openPanel = document.querySelector(".panel.open");
            if (openPanel && !openPanel.contains(event.target) && !backButton.contains(event.target)) {
                if (typeof Orbital.closePanels === "function") { Orbital.closePanels(); }
                Orbital.resetCamera();
            }
            return;
        }
        if (backButton.contains(event.target) || panelsRoot.contains(event.target)) {
            return;
        }
        pointerToNdc(event);
        Orbital.raycaster.setFromCamera(Orbital.pointer, Orbital.camera);
        var hits = Orbital.raycaster.intersectObjects(Orbital.interactiveBodies || Orbital.planets, false);
        if (hits.length > 0) {
            setHover(null, 0, 0);
            Orbital.focusPlanet(hits[0].object);
            return;
        }
        if (Orbital.hoveredPlanet) {
            setHover(null, 0, 0);
            Orbital.focusPlanet(Orbital.hoveredPlanet);
        }
    }

    window.addEventListener("pointerup", tryFocusFromPointer);

    // Scroll wheel zoom — moves camera along view axis, clamped between near/far limits
    window.addEventListener("wheel", function (event) {
        if (Orbital.focusedPlanet) { return; }
        var dir = new THREE.Vector3()
            .subVectors(Orbital.camera.position, currentLookTarget)
            .normalize();
        var dist = Orbital.camera.position.distanceTo(currentLookTarget);
        var newDist = Math.max(18, Math.min(120, dist + event.deltaY * 0.08));
        var newPos = currentLookTarget.clone().addScaledVector(dir, newDist);
        gsap.to(Orbital.camera.position, {
            x: newPos.x, y: newPos.y, z: newPos.z,
            duration: 0.5,
            ease: "power2.out"
        });
    }, { passive: true });

    backButton.addEventListener("click", function () {
        if (typeof Orbital.closePanels === "function") {
            Orbital.closePanels();
        }
        Orbital.resetCamera();
    });

    // Keyboard navigation
    window.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && Orbital.focusedPlanet) {
            if (typeof Orbital.closePanels === "function") { Orbital.closePanels(); }
            Orbital.resetCamera();
            return;
        }
        if (Orbital.focusedPlanet || Orbital.isTransitioning) { return; }
        var panelMap = { "1": "about-panel", "2": "projects-panel", "3": "skills-panel", "4": "contact-panel" };
        var panelId = panelMap[e.key];
        if (!panelId) { return; }
        for (var i = 0; i < Orbital.interactiveBodies.length; i++) {
            if (Orbital.interactiveBodies[i].userData.panelId === panelId) {
                Orbital.focusPlanet(Orbital.interactiveBodies[i]);
                return;
            }
        }
    });
}());
