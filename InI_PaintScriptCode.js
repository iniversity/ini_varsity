<!-- Include Three.js and OrbitControls -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://threejs.org/examples/js/controls/OrbitControls.js"></script>
<script>
  // Get DOM elements
  const canvas = document.getElementById("paint-canvas");
  const ctx = canvas.getContext("2d");
  const toolSelector = document.getElementById("tool-selector");
  const colorPicker = document.getElementById("color-picker");
  const brushSizeInput = document.getElementById("brush-size");
  const brushOpacityInput = document.getElementById("brush-opacity");
  const clearBtn = document.getElementById("clear-btn");
  const show3dBtn = document.getElementById("show3d-btn");

  // Canvas resizing function
  function resizeCanvas() {
    // Save current drawing if needed
    let imageData = null;
    if(canvas.width && canvas.height) {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    canvas.width = canvas.parentElement.clientWidth - 20; // padding compensation
    canvas.height = canvas.parentElement.clientHeight - 60; // control bar compensation

    // Fill background white
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if(imageData) {
      ctx.putImageData(imageData, 0, 0);
    }
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // Global drawing variables
  let drawing = false;
  let startX = 0;
  let startY = 0;
  let savedImage = null; // For shape preview

  // Helper: Get mouse/touch position relative to canvas
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    if(e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  // Helper: Get current brush settings (including computed color with opacity)
  function getBrushSettings() {
    const size = brushSizeInput.value;
    const opacity = brushOpacityInput.value;
    let color = colorPicker.value;
    // If eraser, use white with full opacity
    if(toolSelector.value === "eraser") {
      color = "#ffffff";
      return { size: size, color: "rgba(255,255,255,1)" };
    }
    // Convert hex to rgb
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return { size: size, color: "rgba(" + r + "," + g + "," + b + "," + opacity + ")" };
  }

  // Free drawing and eraser
  function freeDraw(pos) {
    const settings = getBrushSettings();
    ctx.lineWidth = settings.size;
    ctx.lineCap = "round";
    ctx.strokeStyle = settings.color;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  // Shape drawing: line, rectangle, circle
  function drawPreviewShape(currentPos) {
    if(!savedImage) return;
    // Restore saved state
    ctx.putImageData(savedImage, 0, 0);
    const settings = getBrushSettings();
    ctx.lineWidth = settings.size;
    ctx.lineCap = "round";
    ctx.strokeStyle = settings.color;
    const tool = toolSelector.value;
    if(tool === "line") {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
      ctx.closePath();
    } else if(tool === "rectangle") {
      ctx.beginPath();
      ctx.rect(startX, startY, currentPos.x - startX, currentPos.y - startY);
      ctx.stroke();
      ctx.closePath();
    } else if(tool === "circle") {
      ctx.beginPath();
      const radius = Math.sqrt(Math.pow(currentPos.x - startX, 2) + Math.pow(currentPos.y - startY, 2));
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.closePath();
    }
  }

  // Mouse/touch event handlers
  function handleStart(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;
    if(toolSelector.value === "free" || toolSelector.value === "eraser") {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
    } else {
      // For shapes, save current canvas state
      savedImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  }

  function handleMove(e) {
    if(!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const tool = toolSelector.value;
    if(tool === "free" || tool === "eraser") {
      freeDraw(pos);
    } else {
      drawPreviewShape(pos);
    }
  }

  function handleEnd(e) {
    if(!drawing) return;
    e.preventDefault();
    if(toolSelector.value !== "free" && toolSelector.value !== "eraser") {
      const pos = getPos(e);
      drawPreviewShape(pos);
      savedImage = null;
    }
    drawing = false;
    // Begin a new path for the next drawing
    ctx.beginPath();
  }

  // Add event listeners for mouse
  canvas.addEventListener("mousedown", handleStart);
  canvas.addEventListener("mousemove", handleMove);
  canvas.addEventListener("mouseup", handleEnd);
  canvas.addEventListener("mouseout", handleEnd);

  // Add event listeners for touch
  canvas.addEventListener("touchstart", handleStart);
  canvas.addEventListener("touchmove", handleMove);
  canvas.addEventListener("touchend", handleEnd);

  // Clear canvas button
  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // If Three.js texture exists, update it.
    if (planeMaterial) {
      planeMaterial.map.needsUpdate = true;
    }
  });

  // --- Three.js 3D View Setup ---
  let scene, camera, renderer, controls, plane, planeMaterial;
  let threeInitialized = false;
  function initThree() {
    const threeContainer = document.getElementById("three-container");
    // Scene and Camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      75,
      threeContainer.clientWidth / threeContainer.clientHeight,
      0.1,
      1000
    );
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
    threeContainer.appendChild(renderer.domElement);
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
    // Create texture from the canvas (2D drawing)
    const texture = new THREE.CanvasTexture(canvas);
    planeMaterial = new THREE.MeshBasicMaterial({ map: texture });
    // Create plane geometry using canvas aspect ratio
    const aspect = canvas.height / canvas.width;
    const geometry = new THREE.PlaneGeometry(5, 5 * aspect);
    plane = new THREE.Mesh(geometry, planeMaterial);
    scene.add(plane);
    // Position camera
    camera.position.z = 7;
    // OrbitControls for user interaction
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    // Resize listener for Three.js viewport
    window.addEventListener("resize", onWindowResizeThree);
    threeInitialized = true;
    animateThree();
  }
  function onWindowResizeThree() {
    const threeContainer = document.getElementById("three-container");
    camera.aspect = threeContainer.clientWidth / threeContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
  }
  function animateThree() {
    requestAnimationFrame(animateThree);
    controls.update();
    renderer.render(scene, camera);
  }
  // Button to toggle 3D view update
  show3dBtn.addEventListener("click", () => {
    if (!threeInitialized) {
      initThree();
    } else {
      // Update texture if already initialized
      if (planeMaterial && planeMaterial.map) {
        planeMaterial.map.needsUpdate = true;
      }
    }
  });
</script>