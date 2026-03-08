(function createStars() {
    function makeStarLayer(count, minR, maxR, size, opacity) {
        var positions = new Float32Array(count * 3);
        for (var i = 0; i < count; i++) {
            var radius = minR + Math.random() * (maxR - minR);
            var theta = Math.random() * Math.PI * 2;
            var phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
        }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        return new THREE.Points(geo, new THREE.PointsMaterial({
            color: 0xe6e1d6, size: size, transparent: true, opacity: opacity, sizeAttenuation: true
        }));
    }

    // Dense small layer — background depth
    Orbital.stars = makeStarLayer(750, 80, 250, 0.22, 0.6);
    Orbital.scene.add(Orbital.stars);

    // Sparse bright layer — foreground highlights
    var starsBright = makeStarLayer(280, 80, 200, 0.48, 0.75);
    Orbital.scene.add(starsBright);

    // Expose both layers so warp effect can animate their sizes
    Orbital.starLayers = [Orbital.stars, starsBright];

    // Nebula — distant faint colored volumes behind the starfield
    [
        { r: 310, color: 0x0a1030, opacity: 0.16 },
        { r: 290, color: 0x100620, opacity: 0.07 },
        { r: 275, color: 0x281605, opacity: 0.14 }
    ].forEach(function (n) {
        var mesh = new THREE.Mesh(
            new THREE.SphereGeometry(n.r, 16, 16),
            new THREE.MeshBasicMaterial({ color: n.color, transparent: true, opacity: n.opacity, side: THREE.BackSide, depthWrite: false })
        );
        mesh.renderOrder = -1;
        Orbital.scene.add(mesh);
    });
}());
