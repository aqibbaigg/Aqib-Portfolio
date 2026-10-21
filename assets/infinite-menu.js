/* InfiniteMenu — vanilla port of React Bits' <InfiniteMenu /> (https://reactbits.dev).
   A draggable WebGL2 sphere of image discs that snaps the nearest disc to the front.
   Needs lib/gl-matrix-min.js (window.glMatrix).
   Usage: InfiniteMenu.mount(containerEl, { items:[{image,title,description,link}], scale, onOpen(item,index),
                                            unique (one disc per item instead of 42 repeating), discScale,
                                            cap (deg: cluster all discs on the visible side), zoom, fade,
                                            ring + tilt (deg: every disc on one tilted ring, always visible) })
   Additions over the original: render loop pauses while offscreen, vertical page scroll
   passes through on touch screens, pointercancel handling, WebGL2 feature check. */
(function () {
  'use strict';
  var G = window.glMatrix;
  if (!G) return;
  var mat4 = G.mat4, quat = G.quat, vec2 = G.vec2, vec3 = G.vec3;

  const discVertShaderSource = `#version 300 es

uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPosition;
uniform vec4 uRotationAxisVelocity;
uniform float uFade;
uniform float uFlat;

in vec3 aModelPosition;
in vec3 aModelNormal;
in vec2 aModelUvs;
in mat4 aInstanceMatrix;

out vec2 vUvs;
out float vAlpha;
flat out int vInstanceId;

#define PI 3.141593

void main() {
    vec4 worldPosition = uWorldMatrix * aInstanceMatrix * vec4(aModelPosition, 1.);

    vec3 centerPos = (uWorldMatrix * aInstanceMatrix * vec4(0., 0., 0., 1.)).xyz;
    float radius = length(centerPos.xyz);

    if (gl_VertexID > 0 && uFlat < 0.5) {
        vec3 rotationAxis = uRotationAxisVelocity.xyz;
        float rotationVelocity = min(.15, uRotationAxisVelocity.w * 15.);
        vec3 stretchDir = normalize(cross(centerPos, rotationAxis));
        vec3 relativeVertexPos = normalize(worldPosition.xyz - centerPos);
        float strength = dot(stretchDir, relativeVertexPos);
        float invAbsStrength = min(0., abs(strength) - 1.);
        strength = rotationVelocity * sign(strength) * abs(invAbsStrength * invAbsStrength * invAbsStrength + 1.);
        worldPosition.xyz += stretchDir * strength;
    }

    if (uFlat < 0.5) worldPosition.xyz = radius * normalize(worldPosition.xyz);

    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;

    vAlpha = mix(1., smoothstep(0.5, 1., normalize(worldPosition.xyz).z) * .9 + .1, uFade);
    vUvs = aModelUvs;
    vInstanceId = gl_InstanceID;
}
`;

  const discFragShaderSource = `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform int uItemCount;
uniform int uAtlasSize;

out vec4 outColor;

in vec2 vUvs;
in float vAlpha;
flat in int vInstanceId;

void main() {
    int itemIndex = vInstanceId % uItemCount;
    int cellsPerRow = uAtlasSize;
    int cellX = itemIndex % cellsPerRow;
    int cellY = itemIndex / cellsPerRow;
    vec2 cellSize = vec2(1.0) / vec2(float(cellsPerRow));
    vec2 cellOffset = vec2(float(cellX), float(cellY)) * cellSize;

    ivec2 texSize = textureSize(uTex, 0);
    float imageAspect = float(texSize.x) / float(texSize.y);
    float containerAspect = 1.0;

    float scale = max(imageAspect / containerAspect,
                     containerAspect / imageAspect);

    vec2 st = vec2(vUvs.x, 1.0 - vUvs.y);
    st = (st - 0.5) * scale + 0.5;

    st = clamp(st, 0.0, 1.0);

    st = st * cellSize + cellOffset;

    outColor = texture(uTex, st);
    outColor.a *= vAlpha;
}
`;

  class Face {
    constructor(a, b, c) { this.a = a; this.b = b; this.c = c; }
  }

  class Vertex {
    constructor(x, y, z) {
      this.position = vec3.fromValues(x, y, z);
      this.normal = vec3.create();
      this.uv = vec2.create();
    }
  }

  class Geometry {
    constructor() { this.vertices = []; this.faces = []; }

    addVertex(...args) {
      for (let i = 0; i < args.length; i += 3) this.vertices.push(new Vertex(args[i], args[i + 1], args[i + 2]));
      return this;
    }

    addFace(...args) {
      for (let i = 0; i < args.length; i += 3) this.faces.push(new Face(args[i], args[i + 1], args[i + 2]));
      return this;
    }

    get lastVertex() { return this.vertices[this.vertices.length - 1]; }

    subdivide(divisions = 1) {
      const midPointCache = {};
      let f = this.faces;
      for (let div = 0; div < divisions; ++div) {
        const newFaces = new Array(f.length * 4);
        f.forEach((face, ndx) => {
          const mAB = this.getMidPoint(face.a, face.b, midPointCache);
          const mBC = this.getMidPoint(face.b, face.c, midPointCache);
          const mCA = this.getMidPoint(face.c, face.a, midPointCache);
          const i = ndx * 4;
          newFaces[i + 0] = new Face(face.a, mAB, mCA);
          newFaces[i + 1] = new Face(face.b, mBC, mAB);
          newFaces[i + 2] = new Face(face.c, mCA, mBC);
          newFaces[i + 3] = new Face(mAB, mBC, mCA);
        });
        f = newFaces;
      }
      this.faces = f;
      return this;
    }

    spherize(radius = 1) {
      this.vertices.forEach(vertex => {
        vec3.normalize(vertex.normal, vertex.position);
        vec3.scale(vertex.position, vertex.normal, radius);
      });
      return this;
    }

    get data() {
      return { vertices: this.vertexData, indices: this.indexData, normals: this.normalData, uvs: this.uvData };
    }
    get vertexData() { return new Float32Array(this.vertices.flatMap(v => Array.from(v.position))); }
    get normalData() { return new Float32Array(this.vertices.flatMap(v => Array.from(v.normal))); }
    get uvData() { return new Float32Array(this.vertices.flatMap(v => Array.from(v.uv))); }
    get indexData() { return new Uint16Array(this.faces.flatMap(f => [f.a, f.b, f.c])); }

    getMidPoint(ndxA, ndxB, cache) {
      const cacheKey = ndxA < ndxB ? `k_${ndxB}_${ndxA}` : `k_${ndxA}_${ndxB}`;
      if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) return cache[cacheKey];
      const a = this.vertices[ndxA].position;
      const b = this.vertices[ndxB].position;
      const ndx = this.vertices.length;
      cache[cacheKey] = ndx;
      this.addVertex((a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5);
      return ndx;
    }
  }

  class IcosahedronGeometry extends Geometry {
    constructor() {
      super();
      const t = Math.sqrt(5) * 0.5 + 0.5;
      this.addVertex(
        -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0,
        0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t,
        t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1
      ).addFace(
        0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
        1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
        3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
        4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1
      );
    }
  }

  class DiscGeometry extends Geometry {
    constructor(steps = 4, radius = 1) {
      super();
      steps = Math.max(4, steps);
      const alpha = (2 * Math.PI) / steps;
      this.addVertex(0, 0, 0);
      this.lastVertex.uv[0] = 0.5;
      this.lastVertex.uv[1] = 0.5;
      for (let i = 0; i < steps; ++i) {
        const x = Math.cos(alpha * i);
        const y = Math.sin(alpha * i);
        this.addVertex(radius * x, radius * y, 0);
        this.lastVertex.uv[0] = x * 0.5 + 0.5;
        this.lastVertex.uv[1] = y * 0.5 + 0.5;
        if (i > 0) this.addFace(0, i, i + 1);
      }
      this.addFace(0, steps, 1);
    }
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  function createProgram(gl, shaderSources, transformFeedbackVaryings, attribLocations) {
    const program = gl.createProgram();
    [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].forEach((type, ndx) => {
      const shader = createShader(gl, type, shaderSources[ndx]);
      if (shader) gl.attachShader(program, shader);
    });
    if (transformFeedbackVaryings) gl.transformFeedbackVaryings(program, transformFeedbackVaryings, gl.SEPARATE_ATTRIBS);
    if (attribLocations) {
      for (const attrib in attribLocations) gl.bindAttribLocation(program, attribLocations[attrib], attrib);
    }
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  function makeVertexArray(gl, bufLocNumElmPairs, indices) {
    const va = gl.createVertexArray();
    gl.bindVertexArray(va);
    for (const [buffer, loc, numElem] of bufLocNumElmPairs) {
      if (loc === -1) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, numElem, gl.FLOAT, false, 0, 0);
    }
    if (indices) {
      const indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    }
    gl.bindVertexArray(null);
    return va;
  }

  function resizeCanvasToDisplaySize(canvas) {
    const dpr = Math.min(2, window.devicePixelRatio);
    const displayWidth = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);
    const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
    if (needResize) { canvas.width = displayWidth; canvas.height = displayHeight; }
    return needResize;
  }

  function makeBuffer(gl, sizeOrData, usage) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, sizeOrData, usage);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buf;
  }

  function createAndSetupTexture(gl, minFilter, magFilter, wrapS, wrapT) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    return texture;
  }

  /* n points on a circle around the camera-facing axis (discs are drawn at -p, so that axis is -z) */
  function ringPoints(n, radius, capDeg) {
    const t = capDeg * Math.PI / 180, pts = [];
    for (let k = 0; k < n; k++) {
      const phi = Math.PI / 2 + (2 * Math.PI * k) / n;   // one disc sits straight up/down on the ring
      pts.push(vec3.fromValues(Math.sin(t) * Math.cos(phi) * radius, Math.sin(t) * Math.sin(phi) * radius, -Math.cos(t) * radius));
    }
    return pts;
  }

  /* evenly spaced points on a sphere: octahedron for 6 (perfectly even), Fibonacci lattice otherwise */
  function spherePoints(n, radius, capDeg) {
    if (capDeg > 0) {
      // discs are drawn at -p, so the camera-facing point is (0,0,-1)
      const t = capDeg * Math.PI / 180, pts = [vec3.fromValues(0, 0, -radius)];
      for (let k = 0; k < n - 1; k++) {
        const phi = -Math.PI / 2 + (2 * Math.PI * k) / (n - 1);   // one disc straight up on screen, none behind the button
        pts.push(vec3.fromValues(Math.sin(t) * Math.cos(phi) * radius, Math.sin(t) * Math.sin(phi) * radius, -Math.cos(t) * radius));
      }
      return pts;
    }
    if (n === 6) {
      return [[0, 0, 1], [1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0], [0, 0, -1]]
        .map(p => vec3.fromValues(p[0] * radius, p[1] * radius, p[2] * radius));
    }
    const pts = [], golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y), t = golden * i;
      pts.push(vec3.fromValues(Math.cos(t) * r * radius, y * radius, Math.sin(t) * r * radius));
    }
    return pts;
  }

  class ArcballControl {
    isPointerDown = false;
    orientation = quat.create();
    pointerRotation = quat.create();
    rotationVelocity = 0;
    rotationAxis = vec3.fromValues(1, 0, 0);
    snapDirection = vec3.fromValues(0, 0, -1);
    snapTargetDirection;
    EPSILON = 0.1;
    IDENTITY_QUAT = quat.create();

    constructor(canvas, updateCallback) {
      this.canvas = canvas;
      this.updateCallback = updateCallback || (() => null);
      this.pointerPos = vec2.create();
      this.previousPointerPos = vec2.create();
      this._rotationVelocity = 0;
      this._combinedQuat = quat.create();

      const release = () => { this.isPointerDown = false; };
      canvas.addEventListener('pointerdown', e => {
        vec2.set(this.pointerPos, e.clientX, e.clientY);
        vec2.copy(this.previousPointerPos, this.pointerPos);
        this.isPointerDown = true;
      });
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointerleave', release);
      canvas.addEventListener('pointercancel', release);   // touch handed over to page scroll
      canvas.addEventListener('pointermove', e => {
        if (this.isPointerDown) vec2.set(this.pointerPos, e.clientX, e.clientY);
      });

      // original uses 'none'; on touch screens keep vertical swipes scrolling the page
      const coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
      canvas.style.touchAction = coarse ? 'pan-y' : 'none';
    }

    update(deltaTime, targetFrameDuration = 16) {
      const timeScale = deltaTime / targetFrameDuration + 0.00001;
      let angleFactor = timeScale;
      let snapRotation = quat.create();

      if (this.isPointerDown) {
        const INTENSITY = 0.3 * timeScale;
        const ANGLE_AMPLIFICATION = 5 / timeScale;
        const midPointerPos = vec2.sub(vec2.create(), this.pointerPos, this.previousPointerPos);
        vec2.scale(midPointerPos, midPointerPos, INTENSITY);

        if (vec2.sqrLen(midPointerPos) > this.EPSILON) {
          vec2.add(midPointerPos, this.previousPointerPos, midPointerPos);
          const p = this.#project(midPointerPos);
          const q = this.#project(this.previousPointerPos);
          const a = vec3.normalize(vec3.create(), p);
          const b = vec3.normalize(vec3.create(), q);
          vec2.copy(this.previousPointerPos, midPointerPos);
          angleFactor *= ANGLE_AMPLIFICATION;
          this.quatFromVectors(a, b, this.pointerRotation, angleFactor);
        } else {
          quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);
        }
      } else {
        const INTENSITY = 0.1 * timeScale;
        quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);
        if (this.snapTargetDirection) {
          const SNAPPING_INTENSITY = 0.2;
          const a = this.snapTargetDirection;
          const b = this.snapDirection;
          const sqrDist = vec3.squaredDistance(a, b);
          const distanceFactor = Math.max(0.1, 1 - sqrDist * 10);
          angleFactor *= SNAPPING_INTENSITY * distanceFactor;
          this.quatFromVectors(a, b, snapRotation, angleFactor);
        }
      }

      const combinedQuat = quat.multiply(quat.create(), snapRotation, this.pointerRotation);
      this.orientation = quat.multiply(quat.create(), combinedQuat, this.orientation);
      quat.normalize(this.orientation, this.orientation);

      const RA_INTENSITY = 0.8 * timeScale;
      quat.slerp(this._combinedQuat, this._combinedQuat, combinedQuat, RA_INTENSITY);
      quat.normalize(this._combinedQuat, this._combinedQuat);

      const rad = Math.acos(this._combinedQuat[3]) * 2.0;
      const s = Math.sin(rad / 2.0);
      let rv = 0;
      if (s > 0.000001) {
        rv = rad / (2 * Math.PI);
        this.rotationAxis[0] = this._combinedQuat[0] / s;
        this.rotationAxis[1] = this._combinedQuat[1] / s;
        this.rotationAxis[2] = this._combinedQuat[2] / s;
      }

      const RV_INTENSITY = 0.5 * timeScale;
      this._rotationVelocity += (rv - this._rotationVelocity) * RV_INTENSITY;
      this.rotationVelocity = this._rotationVelocity / timeScale;

      this.updateCallback(deltaTime);
    }

    quatFromVectors(a, b, out, angleFactor = 1) {
      const axis = vec3.cross(vec3.create(), a, b);
      vec3.normalize(axis, axis);
      const d = Math.max(-1, Math.min(1, vec3.dot(a, b)));
      const angle = Math.acos(d) * angleFactor;
      quat.setAxisAngle(out, axis, angle);
      return { q: out, axis, angle };
    }

    #project(pos) {
      const r = 2;
      // pointer coords are viewport-based; make them relative to the canvas (the
      // original assumes a full-screen canvas)
      const rect = this.canvas.getBoundingClientRect();
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      const s = Math.max(w, h) - 1;
      const x = (2 * (pos[0] - rect.left) - w - 1) / s;
      const y = (2 * (pos[1] - rect.top) - h - 1) / s;
      let z = 0;
      const xySq = x * x + y * y;
      const rSq = r * r;
      if (xySq <= rSq / 2.0) z = Math.sqrt(rSq - xySq);
      else z = rSq / Math.sqrt(xySq);
      return vec3.fromValues(-x, y, z);
    }
  }

  class InfiniteGridMenu {
    TARGET_FRAME_DURATION = 1000 / 60;
    SPHERE_RADIUS = 2;

    #time = 0;
    #deltaTime = 0;
    #deltaFrames = 0;
    #frames = 0;
    #raf = 0;
    #running = false;

    camera = {
      matrix: mat4.create(),
      near: 0.1,
      far: 40,
      fov: Math.PI / 4,
      aspect: 1,
      position: vec3.fromValues(0, 0, 3),
      up: vec3.fromValues(0, 1, 0),
      matrices: { view: mat4.create(), projection: mat4.create(), inversProjection: mat4.create() }
    };

    nearestVertexIndex = null;
    smoothRotationVelocity = 0;
    scaleFactor = 1.0;
    movementActive = false;

    constructor(canvas, items, onActiveItemChange, onMovementChange, onInit = null, scale = 1.0, layout = {}) {
      this.uniqueDiscs = !!layout.unique;
      this.discScale = layout.discScale || 0.25;
      this.capAngle = layout.cap || 0;          // degrees; > 0 clusters every disc on the camera-facing side
      this.ring = !!layout.ring;                // all discs on one tilted ring; release settles back into the ring
      this.tilt = (layout.tilt || 0) * Math.PI / 180;
      this.zoom = layout.zoom || 1;             // > 1 widens the view
      this.fade = layout.fade == null ? 1 : layout.fade;   // 1 = original edge fade, 0 = none
      this.canvas = canvas;
      this.items = items || [];
      this.onActiveItemChange = onActiveItemChange || (() => {});
      this.onMovementChange = onMovementChange || (() => {});
      this.scaleFactor = scale;
      this.camera.position[2] = 3 * scale;
      this.#init(onInit);
    }

    resize() {
      this.viewportSize = vec2.set(this.viewportSize || vec2.create(), this.canvas.clientWidth, this.canvas.clientHeight);
      const gl = this.gl;
      const needsResize = resizeCanvasToDisplaySize(gl.canvas);
      if (needsResize) gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      this.#updateProjectionMatrix(gl);
    }

    start() {
      if (this.#running) return;
      this.#running = true;
      this.#raf = requestAnimationFrame(t => { this.#time = t; this.run(t); });
    }

    stop() {
      this.#running = false;
      cancelAnimationFrame(this.#raf);
    }

    run(time = 0) {
      if (!this.#running) return;
      this.#deltaTime = Math.min(32, time - this.#time);
      this.#time = time;
      this.#deltaFrames = this.#deltaTime / this.TARGET_FRAME_DURATION;
      this.#frames += this.#deltaFrames;
      this.#animate(this.#deltaTime);
      this.#render();
      this.#raf = requestAnimationFrame(t => this.run(t));
    }

    #init(onInit) {
      this.gl = this.canvas.getContext('webgl2', { antialias: true, alpha: true });
      const gl = this.gl;
      if (!gl) throw new Error('No WebGL 2 context!');

      this.viewportSize = vec2.fromValues(this.canvas.clientWidth, this.canvas.clientHeight);
      this.drawBufferSize = vec2.clone(this.viewportSize);

      this.discProgram = createProgram(gl, [discVertShaderSource, discFragShaderSource], null, {
        aModelPosition: 0, aModelNormal: 1, aModelUvs: 2, aInstanceMatrix: 3
      });

      this.discLocations = {
        aModelPosition: gl.getAttribLocation(this.discProgram, 'aModelPosition'),
        aModelUvs: gl.getAttribLocation(this.discProgram, 'aModelUvs'),
        aInstanceMatrix: gl.getAttribLocation(this.discProgram, 'aInstanceMatrix'),
        uWorldMatrix: gl.getUniformLocation(this.discProgram, 'uWorldMatrix'),
        uViewMatrix: gl.getUniformLocation(this.discProgram, 'uViewMatrix'),
        uProjectionMatrix: gl.getUniformLocation(this.discProgram, 'uProjectionMatrix'),
        uCameraPosition: gl.getUniformLocation(this.discProgram, 'uCameraPosition'),
        uScaleFactor: gl.getUniformLocation(this.discProgram, 'uScaleFactor'),
        uRotationAxisVelocity: gl.getUniformLocation(this.discProgram, 'uRotationAxisVelocity'),
        uFade: gl.getUniformLocation(this.discProgram, 'uFade'),
        uFlat: gl.getUniformLocation(this.discProgram, 'uFlat'),
        uTex: gl.getUniformLocation(this.discProgram, 'uTex'),
        uFrames: gl.getUniformLocation(this.discProgram, 'uFrames'),
        uItemCount: gl.getUniformLocation(this.discProgram, 'uItemCount'),
        uAtlasSize: gl.getUniformLocation(this.discProgram, 'uAtlasSize')
      };

      this.discGeo = new DiscGeometry(56, 1);
      this.discBuffers = this.discGeo.data;
      this.discVAO = makeVertexArray(
        gl,
        [
          [makeBuffer(gl, this.discBuffers.vertices, gl.STATIC_DRAW), this.discLocations.aModelPosition, 3],
          [makeBuffer(gl, this.discBuffers.uvs, gl.STATIC_DRAW), this.discLocations.aModelUvs, 2]
        ],
        this.discBuffers.indices
      );

      if (this.uniqueDiscs) {
        // one disc per item, spread evenly over the sphere (no repeats)
        this.instancePositions = this.ring
          ? ringPoints(Math.max(1, this.items.length), this.SPHERE_RADIUS, this.capAngle || 40)
          : spherePoints(Math.max(1, this.items.length), this.SPHERE_RADIUS, this.capAngle);
      } else {
        this.icoGeo = new IcosahedronGeometry();
        this.icoGeo.subdivide(1).spherize(this.SPHERE_RADIUS);
        this.instancePositions = this.icoGeo.vertices.map(v => v.position);
      }
      this.DISC_INSTANCE_COUNT = this.instancePositions.length;
      this.#initDiscInstances(this.DISC_INSTANCE_COUNT);

      this.worldMatrix = mat4.create();
      this.#initTexture();

      this.control = new ArcballControl(this.canvas, deltaTime => this.#onControlUpdate(deltaTime));
      if (this.ring) this.#initRingPoses();

      this.#updateCameraMatrix();
      this.#updateProjectionMatrix(gl);
      this.resize();

      if (onInit) onInit(this);
    }

    #initTexture() {
      const gl = this.gl;
      this.tex = createAndSetupTexture(gl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      const itemCount = Math.max(1, this.items.length);
      this.atlasSize = Math.ceil(Math.sqrt(itemCount));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const cellSize = Math.min(1024, Math.floor(gl.getParameter(gl.MAX_TEXTURE_SIZE) / this.atlasSize));
      canvas.width = this.atlasSize * cellSize;
      canvas.height = this.atlasSize * cellSize;

      Promise.all(
        this.items.map(item => new Promise(resolve => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);   // a missing image leaves its cell blank instead of stalling every texture
          img.src = item.image;
        }))
      ).then(images => {
        images.forEach((img, i) => {
          if (!img) return;
          const x = (i % this.atlasSize) * cellSize;
          const y = Math.floor(i / this.atlasSize) * cellSize;
          ctx.drawImage(img, x, y, cellSize, cellSize);
        });
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.generateMipmap(gl.TEXTURE_2D);
      });
    }

    #initDiscInstances(count) {
      const gl = this.gl;
      this.discInstances = { matricesArray: new Float32Array(count * 16), matrices: [], buffer: gl.createBuffer() };
      for (let i = 0; i < count; ++i) {
        const instanceMatrixArray = new Float32Array(this.discInstances.matricesArray.buffer, i * 16 * 4, 16);
        instanceMatrixArray.set(mat4.create());
        this.discInstances.matrices.push(instanceMatrixArray);
      }
      gl.bindVertexArray(this.discVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.discInstances.matricesArray.byteLength, gl.DYNAMIC_DRAW);
      const mat4AttribSlotCount = 4;
      const bytesPerMatrix = 16 * 4;
      for (let j = 0; j < mat4AttribSlotCount; ++j) {
        const loc = this.discLocations.aInstanceMatrix + j;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, bytesPerMatrix, j * 4 * 4);
        gl.vertexAttribDivisor(loc, 1);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindVertexArray(null);
    }

    #animate(deltaTime) {
      const gl = this.gl;
      this.control.update(deltaTime, this.TARGET_FRAME_DURATION);

      const src = this.ring && this.ringCur ? this.ringCur : this.instancePositions;
      let positions = src.map(p => vec3.transformQuat(vec3.create(), p, this.control.orientation));
      const scale = this.discScale;
      const SCALE_INTENSITY = 0.6;
      positions.forEach((p, ndx) => {
        const s = (Math.abs(p[2]) / this.SPHERE_RADIUS) * SCALE_INTENSITY + (1 - SCALE_INTENSITY);
        const finalScale = s * scale * (this.ring && this.ringSize ? this.ringSize[ndx] : 1);
        const matrix = mat4.create();
        if (this.ring) {
          const c = vec3.scale(vec3.create(), p, -(1 - finalScale));
          mat4.multiply(matrix, mat4.fromTranslation(mat4.create(), c), mat4.fromScaling(mat4.create(), [finalScale, finalScale, finalScale]));
          mat4.copy(this.discInstances.matrices[ndx], matrix);
          return;
        }
        mat4.multiply(matrix, matrix, mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), p)));
        mat4.multiply(matrix, matrix, mat4.targetTo(mat4.create(), [0, 0, 0], p, [0, 1, 0]));
        mat4.multiply(matrix, matrix, mat4.fromScaling(mat4.create(), [finalScale, finalScale, finalScale]));
        mat4.multiply(matrix, matrix, mat4.fromTranslation(mat4.create(), [0, 0, -this.SPHERE_RADIUS]));
        mat4.copy(this.discInstances.matrices[ndx], matrix);
      });

      gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.discInstances.matricesArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      this.smoothRotationVelocity = this.control.rotationVelocity;
    }

    #render() {
      const gl = this.gl;
      gl.useProgram(this.discProgram);
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.uniformMatrix4fv(this.discLocations.uWorldMatrix, false, this.worldMatrix);
      gl.uniformMatrix4fv(this.discLocations.uViewMatrix, false, this.camera.matrices.view);
      gl.uniformMatrix4fv(this.discLocations.uProjectionMatrix, false, this.camera.matrices.projection);
      gl.uniform3f(this.discLocations.uCameraPosition, this.camera.position[0], this.camera.position[1], this.camera.position[2]);
      gl.uniform4f(
        this.discLocations.uRotationAxisVelocity,
        this.control.rotationAxis[0], this.control.rotationAxis[1], this.control.rotationAxis[2],
        this.smoothRotationVelocity * 1.1
      );

      gl.uniform1i(this.discLocations.uItemCount, this.items.length);
      gl.uniform1f(this.discLocations.uFade, this.fade);
      gl.uniform1f(this.discLocations.uFlat, this.ring ? 1 : 0);
      gl.uniform1i(this.discLocations.uAtlasSize, this.atlasSize);
      gl.uniform1f(this.discLocations.uFrames, this.#frames);
      gl.uniform1f(this.discLocations.uScaleFactor, this.scaleFactor);
      gl.uniform1i(this.discLocations.uTex, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);

      gl.bindVertexArray(this.discVAO);
      gl.drawElementsInstanced(gl.TRIANGLES, this.discBuffers.indices.length, gl.UNSIGNED_SHORT, 0, this.DISC_INSTANCE_COUNT);
    }

    #updateCameraMatrix() {
      mat4.targetTo(this.camera.matrix, this.camera.position, [0, 0, 0], this.camera.up);
      mat4.invert(this.camera.matrices.view, this.camera.matrix);
    }

    #updateProjectionMatrix(gl) {
      this.camera.aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
      let height = this.SPHERE_RADIUS * 0.35;
      if (this.discScale !== 0.25) {
        // bigger discs sit closer to the centre; widen the view so the front disc
        // keeps the original on-screen size (~70% of the frame height)
        const restZ = 3 * this.scaleFactor;
        const frontZ = this.SPHERE_RADIUS * (1 - this.discScale);
        height = (this.discScale / 0.71) * restZ / (restZ - frontZ);
      }
      height *= this.zoom;
      const distance = this.camera.position[2];
      if (this.camera.aspect > 1) this.camera.fov = 2 * Math.atan(height / distance);
      else this.camera.fov = 2 * Math.atan(height / this.camera.aspect / distance);
      mat4.perspective(this.camera.matrices.projection, this.camera.fov, this.camera.aspect, this.camera.near, this.camera.far);
      mat4.invert(this.camera.matrices.inversProjection, this.camera.matrices.projection);
    }

    /* ring mode: the selected item sits in the centre (bigger), the others ring it.
       Dragging turns the ring; the item that settles at the top glides into the centre
       and the old centre takes its place. Clicking a ring disc selects it directly. */
    #initRingPoses() {
      const n = this.items.length;
      this.ringTilt = quat.setAxisAngle(quat.create(), [1, 0, 0], this.tilt);
      this.ringCenter = 0;
      this.ringOrder = [];
      for (let i = 1; i < n; i++) this.ringOrder.push(i);
      this.ringStep = (2 * Math.PI) / Math.max(1, n - 1);
      this.ringTheta = 0;
      this.ringDrag = null;
      this.ringCur = this.items.map((_, i) => vec3.clone(this.#ringSlot(i)));
      this.ringSize = this.items.map((_, i) => (i === this.ringCenter ? this.CENTER_SIZE : 1));

      const SPEED = 0.006;
      this.canvas.addEventListener('pointerdown', e => {
        this.ringDrag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, v: 0, moved: false };
      });
      window.addEventListener('pointermove', e => {
        const d = this.ringDrag;
        if (!d) return;
        const dx = e.clientX - d.x;
        d.x = e.clientX;
        if (Math.abs(e.clientX - d.x0) > 5) d.moved = true;
        this.ringTheta -= dx * SPEED;
        d.v = -dx * SPEED;
      });
      const release = e => {
        const d = this.ringDrag;
        if (!d) return;
        this.ringDrag = null;
        if (!d.moved && e && e.type === 'pointerup') { this.#pickAt(e.clientX, e.clientY); return; }
        const flick = Math.max(-this.ringStep, Math.min(this.ringStep, d.v * 10));
        const m = Math.round((this.ringTheta + flick) / this.ringStep);
        if (m !== 0) {
          // same picture, new bookkeeping: shift the order by m and take m steps off the angle
          const k = this.ringOrder.length, old = this.ringOrder.slice();
          for (let j = 0; j < k; j++) this.ringOrder[(((j + m) % k) + k) % k] = old[j];
          this.ringTheta -= m * this.ringStep;
          this.#swapIntoCenter(0);
        }
      };
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
    }

    CENTER_SIZE = 1.6;

    // target position (model space; discs render at -p) for an item given the current ring state
    #ringSlot(item) {
      const R = this.SPHERE_RADIUS;
      if (item === this.ringCenter) return vec3.fromValues(0, 0, -R);
      const k = this.ringOrder.indexOf(item);
      const t = (this.capAngle || 26) * Math.PI / 180;
      const phi = -Math.PI / 2 + this.ringTheta + k * this.ringStep;   // k = 0 sits at the top on screen
      return vec3.fromValues(Math.sin(t) * Math.cos(phi) * R, Math.sin(t) * Math.sin(phi) * R, -Math.cos(t) * R);
    }

    #swapIntoCenter(ringIndex) {
      const item = this.ringOrder[ringIndex];
      this.ringOrder[ringIndex] = this.ringCenter;
      this.ringCenter = item;
    }

    // click: select the ring disc under the pointer
    #pickAt(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const vp = mat4.multiply(mat4.create(), this.camera.matrices.projection, this.camera.matrices.view);
      let best = -1, bestD = Infinity;
      this.ringOrder.forEach((item, k) => {
        const p = vec3.transformQuat(vec3.create(), this.ringCur[item], this.ringTilt);
        // a disc's centre is drawn at -p pulled in by its own scale (see #animate)
        const s = (Math.abs(p[2]) / this.SPHERE_RADIUS) * 0.6 + 0.4;
        vec3.scale(p, p, -(1 - s * this.discScale * this.ringSize[item]));
        const w = vec3.transformMat4(vec3.create(), p, vp);
        const sx = rect.left + (w[0] * 0.5 + 0.5) * rect.width;
        const sy = rect.top + (0.5 - w[1] * 0.5) * rect.height;
        const d = Math.hypot(sx - clientX, sy - clientY);
        if (d < bestD) { bestD = d; best = k; }
      });
      if (best >= 0 && bestD < rect.height * 0.14) this.#swapIntoCenter(best);
    }

    #settleRing(timeScale) {
      if (!this.ringDrag) this.ringTheta += (0 - this.ringTheta) * Math.min(1, 0.14 * timeScale);
      const ease = Math.min(1, (this.ringDrag ? 0.4 : 0.12) * timeScale);
      let motion = 0;
      this.items.forEach((_, i) => {
        const target = this.#ringSlot(i);
        const cur = this.ringCur[i];
        motion = Math.max(motion, vec3.distance(cur, target));
        vec3.lerp(cur, cur, target, ease);
        vec3.scale(cur, vec3.normalize(cur, cur), this.SPHERE_RADIUS);   // glide over the sphere surface
        const sz = i === this.ringCenter ? this.CENTER_SIZE : 1;
        this.ringSize[i] += (sz - this.ringSize[i]) * ease;
      });
      // feed the original stretch + "moving" state (fades the caption during a swap)
      this.control.orientation = quat.clone(this.ringTilt);
      quat.identity(this.control.pointerRotation);
      this.control.snapTargetDirection = undefined;
      this.control.rotationAxis[0] = 0; this.control.rotationAxis[1] = 0; this.control.rotationAxis[2] = 1;
      this.control.rotationVelocity = Math.min(0.03, motion * 0.05);
      this.onActiveItemChange(this.ringCenter);
    }

    #onControlUpdate(deltaTime) {
      const timeScale = deltaTime / this.TARGET_FRAME_DURATION + 0.0001;
      let damping = 5 / timeScale;
      let cameraTargetZ = 3 * this.scaleFactor;

      const isMoving = this.control.isPointerDown || Math.abs(this.smoothRotationVelocity) > 0.01;
      if (isMoving !== this.movementActive) {
        this.movementActive = isMoving;
        this.onMovementChange(isMoving);
      }

      if (this.ring) {
        this.#settleRing(timeScale);
      } else if (!this.control.isPointerDown) {
        const nearestVertexIndex = this.#findNearestVertexIndex();
        const itemIndex = nearestVertexIndex % Math.max(1, this.items.length);
        this.onActiveItemChange(itemIndex);
        const snapDirection = vec3.normalize(vec3.create(), this.#getVertexWorldPosition(nearestVertexIndex));
        this.control.snapTargetDirection = snapDirection;
      } else {
        // pull the camera back while dragging (gentler with one disc per item, so the few discs stay readable)
        cameraTargetZ += (this.control.rotationVelocity * 80 + 2.5) * (this.uniqueDiscs ? 0.35 : 1);
        damping = 7 / timeScale;
      }

      this.camera.position[2] += (cameraTargetZ - this.camera.position[2]) / damping;
      this.#updateCameraMatrix();
    }

    #findNearestVertexIndex() {
      const n = this.control.snapDirection;
      const inversOrientation = quat.conjugate(quat.create(), this.control.orientation);
      const nt = vec3.transformQuat(vec3.create(), n, inversOrientation);
      let maxD = -1;
      let nearestVertexIndex;
      for (let i = 0; i < this.instancePositions.length; ++i) {
        const d = vec3.dot(nt, this.instancePositions[i]);
        if (d > maxD) { maxD = d; nearestVertexIndex = i; }
      }
      return nearestVertexIndex;
    }

    #getVertexWorldPosition(index) {
      const nearestVertexPos = this.instancePositions[index];
      return vec3.transformQuat(vec3.create(), nearestVertexPos, this.control.orientation);
    }
  }

  /* ---- DOM wrapper (replaces the React component) ---- */
  function mount(container, opts) {
    opts = opts || {};
    const items = opts.items || [];
    if (!items.length) return null;
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2')) { container.classList.add('im-unsupported'); return null; }

    container.classList.add('im-root');
    container.innerHTML =
      '<canvas class="im-canvas" aria-hidden="true"></canvas>' +
      '<div class="im-face">' +
        '<span class="im-num"></span>' +
        '<h3 class="im-title"></h3>' +
        '<p class="im-desc"></p>' +
      '</div>' +
      '<button type="button" class="im-action" aria-label="Open project">&#x2197;</button>';
    const canvas = container.querySelector('.im-canvas');
    const num = container.querySelector('.im-num');
    const title = container.querySelector('.im-title');
    const desc = container.querySelector('.im-desc');
    const btn = container.querySelector('.im-action');
    let active = -1;

    function setActive(i) {
      if (i === active) return;
      active = i;
      const it = items[i];
      num.textContent = it.num || '';
      title.textContent = it.title || '';
      desc.textContent = it.description || '';
      btn.setAttribute('aria-label', 'Learn more: ' + (it.title || ''));
    }
    function setMoving(m) { container.classList.toggle('im-moving', m); }

    let sketch;
    try {
      sketch = new InfiniteGridMenu(canvas, items, i => setActive(i % items.length), setMoving, null, opts.scale || 1,
        { unique: !!opts.unique, discScale: opts.discScale, cap: opts.cap, zoom: opts.zoom, fade: opts.fade, ring: opts.ring, tilt: opts.tilt });
    } catch (e) {
      container.classList.add('im-unsupported');
      return null;
    }
    setActive(0);

    btn.addEventListener('click', () => {
      const it = items[active];
      if (!it) return;
      if (opts.onOpen) opts.onOpen(it, active);
      else if (it.link) window.open(it.link, '_blank', 'noopener');
    });

    window.addEventListener('resize', () => sketch.resize());
    if ('ResizeObserver' in window) new ResizeObserver(() => sketch.resize()).observe(container);

    // only animate while on screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) { sketch.resize(); sketch.start(); } else sketch.stop(); });
      }, { rootMargin: '100px' }).observe(container);
    } else {
      sketch.start();
    }
    return sketch;
  }

  window.InfiniteMenu = { mount: mount };
})();
