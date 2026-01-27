<script>
    import { onMount, onDestroy } from 'svelte';
  
    let rafId;
    let addressInputListener;
    let addressKeyListener;
  
    // Utility to load scripts sequentially
    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const existing = Array.from(document.getElementsByTagName('script'))
          .find(s => s.src && s.src.endsWith(src.replace(/^\//, '')));
        if (existing) {
          if (existing.getAttribute('data-loaded') === 'true') return resolve();
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Failed to load ' + src)));
          return;
        }
  
        const s = document.createElement('script');
        s.src = src;
        s.async = false;
        s.onload = () => {
          s.setAttribute('data-loaded', 'true');
          resolve();
        };
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(s);
      });
    }
  
    onMount(async () => {
      try {
        await loadScript('/js/three.min.js');
        await loadScript('/js/bundle-20220526.js');
        await loadScript('/js/Detector.js');
        await loadScript('/js/OrbitControls.js');
        await loadScript('/js/THREEx.WindowResize.js');
        await loadScript('/js/countdown.min.js');
        await loadScript('/js/explain.js'); // EXPLAIN_MAP
  
        initAncientEarth();
      } catch (err) {
        console.error(err);
        const webglEl = document.getElementById('webgl');
        if (window.Detector && webglEl) {
          Detector.addGetWebGLMessage(webglEl);
        } else if (webglEl) {
          webglEl.innerHTML = '<div class="webgl-error">Failed to load resources. Check console for details.</div>';
        }
        // still attempt to wire the address UI if present
        setupAddressUI();
      }
    });
  
    onDestroy(() => {
      if (rafId) cancelAnimationFrame(rafId);
  
      // remove renderer
      if (window.__ancientEarthRenderer) {
        try {
          const r = window.__ancientEarthRenderer;
          if (r.domElement && r.domElement.parentNode) r.domElement.parentNode.removeChild(r.domElement);
          if (r.dispose) r.dispose();
        } catch (e) { /* ignore */ }
        delete window.__ancientEarthRenderer;
      }
  
      // remove camera/sphere refs
      delete window.__ancientEarthCamera;
      delete window.__ancientEarthSphere;
      delete window.__ancientEarthScene;
  
      // remove address UI listeners
      if (addressInputListener && document.getElementById('address-input-autocomplete')) {
        document.getElementById('address-input-autocomplete').removeEventListener('input', addressInputListener);
      }
      if (addressKeyListener) window.removeEventListener('keydown', addressKeyListener);
  
      // remove label and markerGroup
      if (labelDiv && labelDiv.parentNode) labelDiv.parentNode.removeChild(labelDiv);
      if (markerGroup && markerGroup.parent) {
        try {
          markerGroup.parent.remove(markerGroup);
        } catch (e) {}
      }
    });
  
    function initAncientEarth() {
      const webglEl = document.getElementById('webgl');
  
      if (!window.Detector || !Detector.webgl) {
        if (window.Detector) {
          Detector.addGetWebGLMessage(webglEl);
        } else {
          const el = document.createElement('div');
          el.className = 'webgl-error';
          el.textContent = 'WebGL not available in this browser.';
          webglEl.appendChild(el);
        }
        setupAddressUI();
        return;
      }
  
      var width  = window.innerWidth,
        height = window.innerHeight;
  
      // UI elements
      var yearsago = document.getElementById('years-ago');
  
      // Earth params
      var radius = 0.5,
        segments = 32,
        rotation = 11;
  
      var sphereGeometry = new THREE.SphereGeometry(radius, segments, segments);
  
      var noRotation = false;
      var simulationClicked = false;
      if (webglEl) {
        webglEl.addEventListener( 'mousedown', function() {
          simulationClicked = true;
        }, false);
      }
  
      var scene = new THREE.Scene();
  
      var camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
      camera.position.z = 4;
  
      // expose camera for label projection
      window.__ancientEarthCamera = camera;
  
      var renderer = new THREE.WebGLRenderer();
      renderer.setSize(width, height);
  
      // provide renderer reference for cleanup on destroy
      window.__ancientEarthRenderer = renderer;
  
      scene.add(new THREE.AmbientLight(0x666666));
  
      var light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(5,3,5);
      scene.add(light);
  
      var sphere;
      var DEFAULT_YEAR = 0;
      var startingYear = DEFAULT_YEAR;
      if (window.location.hash) {
        var parsed = parseInt(window.location.hash.slice(1));
        if (!isNaN(parsed)) startingYear = parsed;
      }
  
      yearsago.value = startingYear === 0 ? '0' : startingYear + ' million';
      updateSelectWithValue(startingYear);
      onYearsAgoChanged();
  
      var loadedCount = 0;
  
      var clouds = createClouds(radius, segments);
      clouds.rotation.y = rotation;
      scene.add(clouds)
  
      var stars = createStars(90, 64);
      scene.add(stars);
  
      var controls = new THREE.OrbitControls(camera, webglEl);
      controls.minDistance = 1;
      controls.maxDistance = 20;
      controls.noKeys = true;
      controls.rotateSpeed = 1.4;
  
      THREEx.WindowResize(renderer, camera);
  
      webglEl.appendChild(renderer.domElement);
  
      setupSelect();
      setupControls();
  
      // Setup address UI (so the bundle or our UI can find the DOM elements)
      setupAddressUI();
  
      render();
  
      setTimeout(function() {
        preloadTextures();
      }, 3000);
  
      // expose scene reference for debug/cleanup
      window.__ancientEarthScene = scene;
  
      // ---------- Address / Marker helpers (use bundle if it wires its own UI; these are safe fallback helpers) ----------
  
      function latLonToVector3(lat, lon, r = 0.5) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        const x = - (r * Math.sin(phi) * Math.cos(theta));
        const z = (r * Math.sin(phi) * Math.sin(theta));
        const y = (r * Math.cos(phi));
        return new THREE.Vector3(x, y, z);
      }
  
      let markerGroup = null; // THREE.Group
      function createMarker(lat, lon, labelText) {
        const sphereRef = window.__ancientEarthSphere;
        const sceneRef = window.__ancientEarthScene;
        if (!sphereRef || !sceneRef) {
          console.warn('AncientEarth marker: sphere or scene not ready');
          return;
        }
  
        if (!markerGroup) {
          markerGroup = new THREE.Group();
          sphereRef.add(markerGroup);
        }
  
        // remove previous marker(s) for single-marker behaviour
        while (markerGroup.children.length) {
          const c = markerGroup.children.pop();
          if (c.geometry) c.geometry.dispose();
          if (c.material) c.material.dispose();
        }
  
        const pos = latLonToVector3(lat, lon, sphereRef.geometry.parameters.radius + 0.0035);
  
        const markerGeom = new THREE.SphereGeometry(0.01, 8, 8);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
        const markerMesh = new THREE.Mesh(markerGeom, markerMat);
        markerMesh.position.copy(pos);
        markerMesh.userData = { lat, lon, label: labelText || '' };
  
        markerGroup.add(markerMesh);
  
        createHtmlLabel(markerMesh, labelText || '');
      }
  
      let labelDiv = null;
      let labelRaf = null;
      function createHtmlLabel(markerMesh, text) {
        if (labelDiv) {
          labelDiv.remove();
          labelDiv = null;
          if (labelRaf) cancelAnimationFrame(labelRaf);
        }
        labelDiv = document.createElement('div');
        labelDiv.style.position = 'absolute';
        labelDiv.style.color = '#fff';
        labelDiv.style.padding = '2px 6px';
        labelDiv.style.background = 'rgba(0,0,0,0.6)';
        labelDiv.style.borderRadius = '4px';
        labelDiv.style.whiteSpace = 'nowrap';
        labelDiv.style.zIndex = '2100000';
        labelDiv.innerText = text || '';
        document.body.appendChild(labelDiv);
  
        const updateLabel = () => {
          if (!markerMesh || !labelDiv || !window.__ancientEarthRenderer || !window.__ancientEarthCamera) return;
          const rendererRef = window.__ancientEarthRenderer;
          const cam = window.__ancientEarthCamera;
          const vector = markerMesh.getWorldPosition(new THREE.Vector3()).project(cam);
          const halfWidth = rendererRef.domElement.clientWidth / 2;
          const halfHeight = rendererRef.domElement.clientHeight / 2;
          const x = (vector.x * halfWidth) + halfWidth;
          const y = -(vector.y * halfHeight) + halfHeight;
          const rect = rendererRef.domElement.getBoundingClientRect();
          labelDiv.style.left = Math.round(x + rect.left + window.scrollX + 8) + 'px';
          labelDiv.style.top = Math.round(y + rect.top + window.scrollY - 12) + 'px';
          labelRaf = requestAnimationFrame(updateLabel);
        };
        labelRaf = requestAnimationFrame(updateLabel);
      }
  
      // Minimal debounce
      function debounce(fn, wait=300){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }
  
      // Wire the address input and suggestions
      function setupAddressUI() {
        const input = document.getElementById('address-input-autocomplete');
        const suggestions = document.getElementById('address-suggestions');
        if (!input || !suggestions) return;
  
        // ensure listeners not duplicated
        if (addressInputListener) input.removeEventListener('input', addressInputListener);
        addressInputListener = debounce(onAddressInput, 250);
        input.addEventListener('input', addressInputListener);
  
        // allow Enter to pick first suggestion
        const onKey = (e) => {
          if (e.key === 'Enter') {
            const first = suggestions.querySelector('div[data-lat]');
            if (first) {
              const lat = parseFloat(first.dataset.lat);
              const lon = parseFloat(first.dataset.lon);
              const label = first.textContent || input.value;
              createMarker(lat, lon, label);
              suggestions.innerHTML = '';
              input.value = label;
            }
          }
        };
        if (addressKeyListener) window.removeEventListener('keydown', addressKeyListener);
        addressKeyListener = onKey;
        window.addEventListener('keydown', onKey);
  
        // Expose a small API to the original bundle if it expects functions in global scope
        window.__ancientEarthCreateMarker = createMarker;
      }
  
      async function onAddressInput(e) {
        const q = (e.target.value || '').trim();
        const suggestions = document.getElementById('address-suggestions');
        if (!q) {
          if (suggestions) suggestions.innerHTML = '';
          return;
        }
        const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=6&q=' + encodeURIComponent(q);
        try {
          const res = await fetch(url, { headers:{ 'Accept-Language': 'en' }});
          if (!res.ok) throw new Error('geocode failed');
          const data = await res.json();
          if (!suggestions) return;
          suggestions.innerHTML = '';
          data.forEach(item => {
            const div = document.createElement('div');
            div.style.padding = '6px';
            div.style.cursor = 'pointer';
            div.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
            div.textContent = item.display_name;
            div.dataset.lat = item.lat;
            div.dataset.lon = item.lon;
            div.addEventListener('click', () => {
              const input = document.getElementById('address-input-autocomplete');
              if (input) input.value = item.display_name;
              suggestions.innerHTML = '';
              createMarker(parseFloat(item.lat), parseFloat(item.lon), item.display_name);
            });
            suggestions.appendChild(div);
          });
        } catch (err) {
          console.warn('geocode err', err);
          if (suggestions) suggestions.innerHTML = '<div style="padding:6px;color:#f88">Search failed</div>';
        }
      }
  
      // ---------- end Address helpers ----------
  
      function render() {
        controls.update();
  
        if (!noRotation) {
          if (simulationClicked) {
            if (sphere) sphere.rotation.y += 0.0005;
            clouds.rotation.y += 0.0005;
          } else {
            if (sphere) sphere.rotation.y += 0.001;
            clouds.rotation.y += 0.001;
          }
        }
  
        rafId = requestAnimationFrame(render);
        renderer.render(scene, camera);
      }
  
      function preloadTextures() {
        if (typeof EXPLAIN_MAP === 'undefined') return;
        for (var key in EXPLAIN_MAP) {
          if (!EXPLAIN_MAP.hasOwnProperty(key)) continue;
          var i = new Image()
          i.src = imagePathForYearsAgo(key);
        }
      }
  
      function updateSelectWithValue(howmany) {
        var howManyText = yearsago.value;
        var howLongElt = document.getElementById('how-long-ago');
        if (howLongElt) howLongElt.innerHTML = howManyText;
        var explanationElt = document.getElementById('explanation');
        if (explanationElt) explanationElt.innerHTML = (typeof EXPLAIN_MAP !== 'undefined' && EXPLAIN_MAP[parseInt(howmany)]) ? EXPLAIN_MAP[parseInt(howmany)] : '';
      }
  
      function onYearsAgoChanged() {
        var howmany = parseInt((yearsago.value + '').replace(/[^0-9]/g,''));
        if (isNaN(howmany)) howmany = 600;
        try {
          scene.remove(sphere);
        } catch(e){ /* ignore */ }
        var img = imagePathForYearsAgo(howmany);
        sphere = createSphere(radius, segments, img);
        // expose sphere for marker attachment
        window.__ancientEarthSphere = sphere;
        sphere.rotation.y = rotation;
        scene.add(sphere);
  
        updateSelectWithValue(howmany);
        try {
          window.location.replace('#' + howmany);
        } catch (e) { /* ignore */ }
      }
  
      function setupSelect() {
        yearsago.onchange = onYearsAgoChanged;
  
        var t = -1;
        document.addEventListener('keydown', function(e) {
          var now = new Date().getTime();
          if (now - t > 150) {
            var select = document.getElementById('years-ago');
            if (!select) return;
            if (e.keyCode == 37 || e.keyCode == 75) {
              select.selectedIndex = Math.max(select.selectedIndex - 1, 0);
              onYearsAgoChanged();
            } else if (e.keyCode == 39 || e.keyCode == 74) {
              select.selectedIndex =
                Math.min(select.selectedIndex + 1, select.length - 1);
              onYearsAgoChanged();
            }
            t = now;
          }
        }, false);
  
        var jumpToElt = document.getElementById('jump-to');
        if (jumpToElt) {
          jumpToElt.onchange = function(e) {
            yearsago.value = jumpToElt.value + ' million';
            onYearsAgoChanged();
          };
        }
      }
  
      function imagePathForYearsAgo(years) {
        return years == 0 ? 'images/scrape/000present.jpg' : 'images/scrape/'
            + ((years+'').length < 3 ? '0' + years : years) + 'Marect.jpg';
      }
  
      function createSphere(radius, segments, img) {
        var map = THREE.ImageUtils.loadTexture(img, undefined, function() {
          if (++loadedCount >= 2) {
            var loading = document.getElementById('loading');
            if (loading) loading.style.display = 'none';
          }
        });
        map.minFilter = THREE.LinearFilter;
        var mesh = new THREE.Mesh(
          sphereGeometry,
          new THREE.MeshPhongMaterial({
            map:         map,
            "color": 0xbbbbbb, "specular": 0x111111, "shininess": 1,
            bumpMap:     map,
            bumpScale:   0.02,
            specularMap: map,
          })
        );
        return mesh;
      }
  
      function setupControls() {
        var removeCloudsElt = document.getElementById('remove-clouds');
        if (removeCloudsElt) {
          removeCloudsElt.onclick = function() {
            scene.remove(clouds);
            removeCloudsElt.style.display = 'none';
          };
        }
        var stopRotationElt = document.getElementById('stop-rotation');
        if (stopRotationElt) {
          stopRotationElt.onclick = function() {
            noRotation = true;
            stopRotationElt.style.display = 'none';
          };
        }
      }
  
      function createClouds(radius, segments) {
        var map = THREE.ImageUtils.loadTexture('images/fair_clouds_4k.png', undefined, function() {
          if (++loadedCount >= 2) {
            var loading = document.getElementById('loading');
            if (loading) loading.style.display = 'none';
          }
        });
        return new THREE.Mesh(
          new THREE.SphereGeometry(radius + 0.003, segments, segments),
          new THREE.MeshPhongMaterial({
            map:         map,
            transparent: true,
            opacity: 1.0,
          })
        );
      }
  
      function createStars(radius, segments) {
        return new THREE.Mesh(
          new THREE.SphereGeometry(radius, segments, segments),
          new THREE.MeshBasicMaterial({
            map:  THREE.ImageUtils.loadTexture('images/galaxy_starfield.png'),
            side: THREE.BackSide
          })
        );
      }
  
      // expose a cleanup function in case external code wants to call it
      window.__ancientEarthCleanup = function() {
        if (rafId) cancelAnimationFrame(rafId);
        try {
          if (renderer && renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
          if (renderer && renderer.dispose) renderer.dispose();
        } catch (e) {}
        try {
          while(scene.children.length) scene.remove(scene.children[0]);
        } catch(e) {}
      };
    }
  </script>
  
  <style>
    :global(body) {
      margin: 0;
      overflow: hidden;
      background-color: #000;
      font-family: 'proxima-nova',Helvetica,sans-serif;
    }
    .tm  { position: absolute; top: 10px; right: 10px; }
    .webgl-error { font: 15px/30px monospace; text-align: center; color: #fff; margin: 50px; }
    .webgl-error a { color: #fff; }
    #webgl {
    }
    .top {
      z-index: 999990;
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 40px;
      background-color: black;
      border-bottom: 1px solid #404040;
      z-index: 999999;
      color: white;
      line-height: 2.5;
      text-align: center;
    }
  
    a {
      color: white;
    }
  
    .top-sub {
      position: absolute;
      top: 50px;
      left: 0;
      color: #aaa;
      text-align: center;
      width: 100%;
    }
  
    .title {
      font-family: 'Open Sans', Helvetica, sans-serif;
      font-size: 20px;
      font-weight: bold;
      position:absolute;
      bottom:20px;
      left: 20px ;
      color: white;
    }
  
    #years-ago {
      font-weight: bold;
    }
  
    #explanation {
      font-size: 14px;
      position:absolute;
      bottom: 80px;
      left: 20px ;
      width: 300px;
      line-height: 1.5;
      color: #eee;
    }
  
    #instructions {
      font-size: 12px;
      position: absolute;
      bottom: 20px;
      right: 30px;
      color: #eee;
    }
  
    #controls {
      font-size: 12px;
      position: absolute;
      top: 50px;
      right: 30px;
      color: #eee;
      text-align: right;
    }
  
    #controls .button {
      background-color: #202020;
      cursor: pointer;
      padding: 5px;
      border-radius: 5px;
      line-height: 2.5;
    }
  
    #controls span:hover {
      background-color: #303030;
    }
  
    .jump-to-container {
      margin-bottom: 3px;
    }
  
    #jump-to {
      color: #fff;
    }
  
    .social-container {
      position: absolute;
      top: 10px;
      right: 15px;
      font-size: 12px;
    }
  
    ul.share-buttons {
      list-style: none;
      padding: 0;
      margin: 0;
    }
  
    ul.share-buttons li {
      display: inline;
    }
  
    ul.share-buttons img {
      width: 20px;
      height: auto;
    }
  
    .links {
      position: absolute;
      top: 5px;
      left: 20px;
      font-size: 12px;
    }
  
    #loading {
      font-size: 30px;
      font-weight: bold;
      text-align: center;
      position: absolute;
      top: 45%;
      width: 100%;
      color: #fff;
    }
  
    @media screen and (max-width: 1024px) {
      .top, .top-sub, #explanation {
        font-size: 12px;
      }
  
      #instructions, .social-container, .links {
        display: none;
      }
  
      .main-heading {
        line-height: 3.5;
      }
    }
  
    /* address UI */
    #address-ui { pointer-events: auto; }
    #address-input-autocomplete { outline: none; }
  </style>
  
  <div class="top">
    <div class="links">
      <strong><a href="http://dinosaurpictures.org/" style="color:#B1B06B;">Related: Database of Prehistoric Creatures</a></strong>
    </div>
    <strong class="main-heading">
      What did Earth look like
      <select id="years-ago">
        <option>600 million</option>
        <option>560 million</option>
        <option>540 million</option>
        <option>500 million</option>
        <option>470 million</option>
        <option>450 million</option>
        <option>430 million</option>
        <option>400 million</option>
        <option>370 million</option>
        <option>340 million</option>
        <option>300 million</option>
        <option>280 million</option>
        <option>260 million</option>
        <option>240 million</option>
        <option>220 million</option>
        <option>200 million</option>
        <option>170 million</option>
        <option>150 million</option>
        <option>120 million</option>
        <option>105 million</option>
        <option>90 million</option>
        <option>65 million</option>
        <option>50 million</option>
        <option>35 million</option>
        <option>20 million</option>
        <option>0</option>
      </select>
      years ago?
    </strong>
    <div class="social-container" style="display:none;">
      <ul class="share-buttons"><li></li></ul>
    </div>
  </div>
  
  <div id="controls">
    <div class="jump-to-container">
      <span>Jump to... </span>
      <select id="jump-to" class="button">
        <option value="600">first multicellular life</option>
        <option value="540">first shells</option>
        <option value="470">first coral reefs</option>
        <option value="470">first vertebrates</option>
        <option value="430">first land plants</option>
        <option value="400">first land animals</option>
        <option value="400">first insects</option>
        <option value="300">first reptiles</option>
        <option value="220">first dinosaurs</option>
        <option value="120">first flowers</option>
        <option value="35">first primates</option>
        <option value="35">first grass</option>
        <option value="20">first hominids</option>
        <option value="600">Pannotia supercontinent</option>
        <option value="280">Pangea supercontinent</option>
        <option value="240">Triassic</option>
        <option value="170">Jurassic</option>
        <option value="105">Cretaceous</option>
        <option value="65">dinosaur extinction</option>
      </select>
    </div>
    <span id="remove-clouds" class="button">Remove clouds</span><br>
    <span id="stop-rotation" class="button">Stop rotation</span>
  </div>
  
  <div id="explanation"></div>
  <div id="instructions">Use the ← and → keys to step through time.</div>
  <div class="title">Earth, <span id="how-long-ago">600 million</span> years ago</div>
  
  <div id="loading">Loading...</div>
  
  <!-- Address UI (bundle or our fallback will use these elements) -->
  <div id="address-ui" style="position:absolute; top:56px; left:16px; z-index: 2000002; color:#fff; pointer-events:auto;">
    <div class="address-input-container" style="width:300px;">
      <input id="address-input-autocomplete" placeholder="Enter a city name to view it on the globe" style="width:100%; background:#202020; color:#fff; padding:6px; border-radius:5px; border:1px solid #444;" />
    </div>
    <div id="address-suggestions" style="margin-top:6px; background:rgba(0,0,0,0.6); border-radius:4px; max-height:200px; overflow:auto;"></div>
  </div>
  
  <div id="webgl"></div>