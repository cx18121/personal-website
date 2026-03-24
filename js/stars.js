(function createStars() {
  function makeStarLayer(count, minR, maxR, size, opacity) {
    var positions = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var radius = minR + Math.random() * (maxR - minR);
      var theta  = Math.random() * Math.PI * 2;
      var phi    = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xe6e1d6, size: size, transparent: true, opacity: opacity, sizeAttenuation: true,
    }));
  }

  var starsBase   = makeStarLayer(750, 80, 250, 0.22, 0.6);
  var starsBright = makeStarLayer(280, 80, 200, 0.48, 0.75);
  Orbital.scene.add(starsBase);
  Orbital.scene.add(starsBright);
  Orbital.starLayers = [starsBase, starsBright];

  // ── Animated nebula — domain-warped FBM noise ──────────────────────────
  var vert = [
    'varying vec3 vDir;',
    'void main() {',
    '  vDir = normalize(position);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}',
  ].join('\n');

  var frag = [
    'uniform float time;',
    'varying vec3 vDir;',

    // Value noise kernel
    'float _h(vec3 p){',
    '  p=fract(p*vec3(127.1,311.7,74.7));',
    '  p+=dot(p,p.yzx+19.19);',
    '  return fract((p.x+p.y)*p.z);',
    '}',
    'float _n(vec3 p){',
    '  vec3 i=floor(p),f=fract(p);',
    '  f=f*f*(3.0-2.0*f);',
    '  return mix(',
    '    mix(mix(_h(i),_h(i+vec3(1,0,0)),f.x),mix(_h(i+vec3(0,1,0)),_h(i+vec3(1,1,0)),f.x),f.y),',
    '    mix(mix(_h(i+vec3(0,0,1)),_h(i+vec3(1,0,1)),f.x),mix(_h(i+vec3(0,1,1)),_h(i+vec3(1,1,1)),f.x),f.y),',
    '    f.z);',
    '}',
    'float fbm(vec3 p){',
    '  float v=0.0,a=0.5;',
    '  for(int i=0;i<4;i++){v+=a*_n(p);p=p*2.1+vec3(5.2,1.3,8.7);a*=0.48;}',
    '  return v;',
    '}',

    'void main() {',
    '  vec3 d = normalize(vDir);',
    '  float t = time * 0.015;',
    // Domain warp — makes it swirl organically
    '  vec3 q = vec3(',
    '    fbm(d*2.0+vec3(t, 0.0, t*0.6)),',
    '    fbm(d*2.0+vec3(0.0, t, 0.0)),',
    '    fbm(d*2.0+vec3(t*0.4, 0.0, t))',
    '  );',
    '  float n  = fbm(d*2.4 + q*1.5);',
    '  float n2 = fbm(d*1.1 + q*0.7 + vec3(t*0.35));',
    // Palette: dark navy / deep violet / warm amber dust
    '  vec3 navy   = vec3(0.040, 0.065, 0.220);',
    '  vec3 violet = vec3(0.085, 0.032, 0.195);',
    '  vec3 amber  = vec3(0.340, 0.165, 0.038);',
    '  vec3 col = mix(navy, mix(violet, amber, n*1.2), pow(n2, 0.8));',
    '  float alpha = n * 0.55 * (0.35 + n2*0.65);',
    '  gl_FragColor = vec4(col, alpha);',
    '}',
  ].join('\n');

  var nebulaMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0.0 } },
    vertexShader:   vert,
    fragmentShader: frag,
    transparent:    true,
    depthWrite:     false,
    side:           THREE.BackSide,
  });

  var nebulaMesh = new THREE.Mesh(new THREE.SphereGeometry(310, 32, 16), nebulaMat);
  nebulaMesh.renderOrder = -1;
  Orbital.scene.add(nebulaMesh);
  // Exposed so main.js can tick the time uniform
  Orbital.nebulaMat = nebulaMat;
})();
