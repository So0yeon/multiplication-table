class BlockWorld {
  constructor(containerId, onBlocksChanged) {
    this.container = document.getElementById(containerId);
    this.onBlocksChanged = onBlocksChanged;

    this.blocks = []; // Array of { mesh, x, y, z, type, color }
    this.gridSize = 12;
    this.gridY = 0;
    this.currentMode = 'view'; // 'view', 'build', 'paint', 'erase'
    this.selectedColor = '#5ce1e6';
    this.selectedItem = null; // Current shop item data { id, type, geometry, emoji }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.gridHelper = null;

    // Raycasting & Interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Ground plane for raycast
    this.previewMesh = null;
    this.objectsToIntersect = []; // Array of meshes representing blocks & grid base

    this.init();
  }

  init() {
    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0f0b26');

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
    this.camera.position.set(12, 12, 16);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    const d = 15;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Subtle blueish directional light from opposite side
    const dirLight2 = new THREE.DirectionalLight(0x5ce1e6, 0.3);
    dirLight2.position.set(-10, 5, -10);
    this.scene.add(dirLight2);

    // 5. Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground
    this.controls.minDistance = 3;
    this.controls.maxDistance = 40;
    this.controls.target.set(0, 1, 0);

    // 6. Base Grid & Platform
    this.createGridPlatform();

    // 7. Preview Mesh for placement
    this.createPreviewMesh();

    // 8. Event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));

    // Start Loop
    this.animate();
  }

  createGridPlatform() {
    // Grid Helper
    this.gridHelper = new THREE.GridHelper(this.gridSize, this.gridSize, 0x5ce1e6, 0xff7ebb);
    this.gridHelper.position.y = 0.01;
    this.scene.add(this.gridHelper);

    // Transparent invisible base plane for raycasting when no blocks are present
    const baseGeo = new THREE.BoxGeometry(this.gridSize, 0.2, this.gridSize);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1d1844,
      roughness: 0.8,
      metalness: 0.1
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.1;
    baseMesh.receiveShadow = true;
    this.scene.add(baseMesh);
    
    // Add grid base to raycast targets
    this.objectsToIntersect.push(baseMesh);
  }

  createPreviewMesh() {
    // Default preview: a glowing transparent red/cyan box
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x5ce1e6,
      transparent: true,
      opacity: 0.5,
      wireframe: false
    });
    this.previewMesh = new THREE.Mesh(geo, mat);
    this.previewMesh.visible = false;
    this.scene.add(this.previewMesh);
  }

  updatePreviewGeometry() {
    if (!this.selectedItem || !this.previewMesh) return;
    this.scene.remove(this.previewMesh);

    let geo;
    const type = this.selectedItem.type;

    if (type === 'sphere') geo = new THREE.SphereGeometry(0.5, 24, 24);
    else if (type === 'cone') geo = new THREE.ConeGeometry(0.5, 1, 24);
    else if (type === 'cylinder') geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    else geo = new THREE.BoxGeometry(1, 1, 1); // default box

    const mat = new THREE.MeshBasicMaterial({
      color: this.selectedColor,
      transparent: true,
      opacity: 0.4
    });

    this.previewMesh = new THREE.Mesh(geo, mat);
    this.previewMesh.visible = false;
    this.scene.add(this.previewMesh);
  }

  setMode(mode) {
    this.currentMode = mode;
    // Disable controls rotation in build/paint/erase modes, so clicks don't rotate scene
    if (mode === 'view') {
      this.controls.enabled = true;
      if (this.previewMesh) this.previewMesh.visible = false;
    } else {
      this.controls.enabled = true; // OrbitControls is smart enough, but let's keep it enabled so dragging still orbits
    }
  }

  setColor(color) {
    this.selectedColor = color;
    if (this.previewMesh && this.previewMesh.material) {
      this.previewMesh.material.color.set(color);
    }
  }

  setItem(item) {
    this.selectedItem = item;
    this.updatePreviewGeometry();
  }

  onWindowResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  onPointerMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / this.container.clientHeight) * 2 + 1;

    if (this.currentMode !== 'build') {
      if (this.previewMesh) this.previewMesh.visible = false;
      return;
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.objectsToIntersect, true);

    if (intersects.length > 0) {
      const intersect = intersects[0];

      // Calculate grid coordinate position on top of the face we intersected
      const position = new THREE.Vector3();
      position.copy(intersect.point).add(intersect.face.normal);
      
      // Snap to grid
      const snappedX = Math.floor(position.x) + 0.5;
      // Snapping height: snap to nearest unit (0.5 for a 1-unit block height)
      const snappedY = Math.max(0.5, Math.floor(position.y) + 0.5);
      const snappedZ = Math.floor(position.z) + 0.5;

      // Ensure block is within grid bounds
      const halfSize = this.gridSize / 2;
      if (Math.abs(snappedX) < halfSize && Math.abs(snappedZ) < halfSize && snappedY < 8) {
        this.previewMesh.position.set(snappedX, snappedY, snappedZ);
        this.previewMesh.visible = true;
      } else {
        this.previewMesh.visible = false;
      }
    } else {
      this.previewMesh.visible = false;
    }
  }

  onPointerDown(event) {
    // Only handle left click action
    if (event.button !== 0) return; 

    // If OrbitControls was actually used (rotated), don't trigger click action
    // We can do this by checking if the controls moved, but a simpler way is checking if mode is active
    if (this.currentMode === 'view') return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / this.container.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.objectsToIntersect, true);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const clickedMesh = intersect.object;

      if (this.currentMode === 'build') {
        if (!this.selectedItem) return;

        // Position grid snap
        const position = new THREE.Vector3();
        position.copy(intersect.point).add(intersect.face.normal);
        
        const snappedX = Math.floor(position.x) + 0.5;
        const snappedY = Math.max(0.5, Math.floor(position.y) + 0.5);
        const snappedZ = Math.floor(position.z) + 0.5;

        const halfSize = this.gridSize / 2;
        if (Math.abs(snappedX) < halfSize && Math.abs(snappedZ) < halfSize && snappedY < 8) {
          this.addBlock(snappedX, snappedY, snappedZ, this.selectedItem.type, this.selectedColor, this.selectedItem.emoji);
        }
      } else if (this.currentMode === 'paint') {
        // Paint block (ignore the base grid plate)
        const block = this.blocks.find(b => b.mesh === clickedMesh);
        if (block) {
          block.mesh.material.color.set(this.selectedColor);
          block.color = this.selectedColor;
          this.onBlocksChanged();
        }
      } else if (this.currentMode === 'erase') {
        // Erase block (ignore the base grid plate)
        const blockIndex = this.blocks.findIndex(b => b.mesh === clickedMesh);
        if (blockIndex !== -1) {
          const block = this.blocks[blockIndex];
          this.scene.remove(block.mesh);
          
          // Remove from raycasting list
          const intersectIndex = this.objectsToIntersect.indexOf(block.mesh);
          if (intersectIndex !== -1) this.objectsToIntersect.splice(intersectIndex, 1);

          this.blocks.splice(blockIndex, 1);
          this.onBlocksChanged();
        }
      }
    }
  }

  addBlock(x, y, z, type, color, emoji = null) {
    let geo;
    if (type === 'sphere') geo = new THREE.SphereGeometry(0.5, 24, 24);
    else if (type === 'cone') geo = new THREE.ConeGeometry(0.5, 1, 24);
    else if (type === 'cylinder') geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    else geo = new THREE.BoxGeometry(1, 1, 1); // default box

    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.4,
      metalness: 0.1
    });

    let mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // If item has an emoji (like a decoration), let's render a flat emoji sprite slightly floating above it or attached to it
    if (emoji) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.font = '96px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMaterial);
      
      // Position sprite on top of the block
      sprite.position.y = (type === 'sphere' || type === 'cone' || type === 'cylinder') ? 0.6 : 0.6;
      sprite.scale.set(0.9, 0.9, 1);
      mesh.add(sprite);
    }

    this.scene.add(mesh);
    this.objectsToIntersect.push(mesh);
    this.blocks.push({ mesh, x, y, z, type, color, emoji });

    this.onBlocksChanged();
  }

  clearAll() {
    this.blocks.forEach(b => {
      this.scene.remove(b.mesh);
    });
    this.blocks = [];
    this.objectsToIntersect = [this.objectsToIntersect[0]]; // Keep only the grid base plane
    this.onBlocksChanged();
  }

  // Load existing blocks from save data
  loadBlocks(savedBlocksList) {
    this.clearAll();
    savedBlocksList.forEach(b => {
      this.addBlock(b.x, b.y, b.z, b.type, b.color, b.emoji);
    });
  }

  // Get serialized block data for local storage
  getSaveData() {
    return this.blocks.map(b => ({
      x: b.x,
      y: b.y,
      z: b.z,
      type: b.type,
      color: b.color,
      emoji: b.emoji
    }));
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Save current 3D canvas render as image file
  saveAsImage() {
    // temporarily hide helpers
    this.gridHelper.visible = false;
    if (this.previewMesh) this.previewMesh.visible = false;
    
    // Render scene once
    this.renderer.render(this.scene, this.camera);

    const imgData = this.renderer.domElement.toDataURL("image/png");

    // restore helpers
    this.gridHelper.visible = true;

    // Download trigger
    const link = document.createElement('a');
    link.download = `my-3d-space-${Date.now()}.png`;
    link.href = imgData;
    link.click();
  }
}
window.BlockWorld = BlockWorld;
