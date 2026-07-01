const app = document.querySelector('.app-shell');
const toolButtons = [...document.querySelectorAll('.tool[data-tool]')];

const activeToolLabel = document.querySelector('#activeToolLabel');
const selectedObjectLabel = document.querySelector('#selectedObjectLabel');
const assetCountLabel = document.querySelector('#assetCountLabel');
const statusMessage = document.querySelector('#statusMessage');
const toolMessage = document.querySelector('#toolMessage');
const projectMessage = document.querySelector('#projectMessage');

const newProjectBtn = document.querySelector('#newProjectBtn');
const saveProjectBtn = document.querySelector('#saveProjectBtn');
const openProjectBtn = document.querySelector('#openProjectBtn');
const resetViewBtn = document.querySelector('#resetViewBtn');
const createSceneBtn = document.querySelector('#createSceneBtn');
const worldCanvas = document.querySelector('#worldCanvas');
const isoCanvas = document.querySelector('#isoCanvas');
const ctx = isoCanvas.getContext('2d');

const toolNames = {
  select: 'Seleccionar',
  tree: 'Árbol',
  house: 'Casa',
  plant: 'Vegetación',
  rock: 'Roca',
  path: 'Camino',
  water: 'Agua'
};

const categoryByTool = {
  tree: 'tree',
  house: 'house',
  plant: 'plant',
  rock: 'rock',
  path: 'path',
  water: 'water'
};

const markerColors = {
  tree: '#5f7f4d',
  house: '#b76f4f',
  plant: '#8aa768',
  rock: '#8d877d',
  path: '#b99b6d',
  water: '#70aeb8',
  bridge: '#826648'
};

const projectState = {
  name: 'Sin título',
  activeTool: 'select',
  selectedObject: null,
  assets: [],
  selectedCell: null,
  placedObjects: [],
  assetCycle: {}
};

const camera = { x: 0, y: 0, zoom: 1 };
const grid = { width: 18, height: 18, tileWidth: 72, tileHeight: 36 };

const pointerState = {
  isDragging: false,
  didDrag: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  pointers: new Map(),
  pinchDistance: null,
  pinchZoom: 1
};

function setStatus(message) {
  statusMessage.textContent = `Estado: ${message}`;
}

function setActiveTool(tool) {
  projectState.activeTool = tool;
  app.dataset.activeTool = tool;

  toolButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === tool);
  });

  const label = toolNames[tool] ?? tool;
  activeToolLabel.textContent = label;
  toolMessage.textContent = `Herramienta: ${label}`;
  setStatus(`herramienta ${label.toLowerCase()} activa`);
}

function selectObject(objectName) {
  projectState.selectedObject = objectName;
  selectedObjectLabel.textContent = objectName ?? 'Ninguno';
}

async function loadAssetLibrary() {
  try {
    const response = await fetch('src/data/library.json');
    if (!response.ok) throw new Error('No se pudo leer library.json');
    const library = await response.json();
    projectState.assets = library.assets ?? [];
    assetCountLabel.textContent = `${projectState.assets.length} assets`;
    setStatus('biblioteca cargada');
  } catch (error) {
    projectState.assets = [];
    assetCountLabel.textContent = 'No disponible';
    setStatus('biblioteca pendiente');
    console.warn(error);
  }
}

function clampZoom(value) {
  return Math.max(0.55, Math.min(2.2, value));
}

function getCanvasCenter() {
  return {
    x: isoCanvas.width / window.devicePixelRatio / 2 + camera.x,
    y: isoCanvas.height / window.devicePixelRatio / 2 + camera.y
  };
}

function gridToScreen(col, row) {
  const center = getCanvasCenter();
  const mapOffsetY = 40;
  return {
    x: center.x + (col - row) * (grid.tileWidth / 2) * camera.zoom,
    y: center.y + (col + row) * (grid.tileHeight / 2) * camera.zoom - mapOffsetY * camera.zoom
  };
}

function pointIsInsideDiamond(point, center) {
  const halfWidth = (grid.tileWidth * camera.zoom) / 2;
  const halfHeight = (grid.tileHeight * camera.zoom) / 2;
  const normalizedDistance = Math.abs(point.x - center.x) / halfWidth + Math.abs(point.y - center.y) / halfHeight;
  return normalizedDistance <= 1;
}

function screenToGrid(screenX, screenY) {
  const point = { x: screenX, y: screenY };
  let bestCell = null;
  let bestDistance = Infinity;

  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const center = gridToScreen(col, row);

      if (!pointIsInsideDiamond(point, center)) continue;

      const distance = Math.hypot(point.x - center.x, point.y - center.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCell = { col, row };
      }
    }
  }

  return bestCell;
}

function drawDiamond(x, y, width, height, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x, y - height / 2);
  ctx.lineTo(x + width / 2, y);
  ctx.lineTo(x, y + height / 2);
  ctx.lineTo(x - width / 2, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function getAssetsByCategory(category) {
  return projectState.assets.filter((asset) => asset.category === category);
}

function getObjectAtCell(cell) {
  return projectState.placedObjects.find((object) => object.col === cell.col && object.row === cell.row);
}

function getNextAssetForTool(tool) {
  const category = categoryByTool[tool];
  const availableAssets = getAssetsByCategory(category);
  if (!availableAssets.length) return null;
  const currentIndex = projectState.assetCycle[category] ?? 0;
  const asset = availableAssets[currentIndex % availableAssets.length];
  projectState.assetCycle[category] = currentIndex + 1;
  return asset;
}

function placeObject(cell) {
  const asset = getNextAssetForTool(projectState.activeTool);
  if (!asset) {
    setStatus('no hay assets disponibles para esta herramienta');
    return;
  }

  const existingObject = getObjectAtCell(cell);
  if (existingObject) {
    existingObject.assetId = asset.id;
    existingObject.name = asset.name;
    existingObject.icon = asset.icon;
    existingObject.category = asset.category;
    selectObject(`${asset.name} en ${cell.col}, ${cell.row}`);
    setStatus(`objeto actualizado: ${asset.name}`);
  } else {
    projectState.placedObjects.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `object_${Date.now()}`,
      assetId: asset.id,
      name: asset.name,
      icon: asset.icon,
      category: asset.category,
      col: cell.col,
      row: cell.row,
      rotation: 0,
      scale: 1
    });
    selectObject(`${asset.name} en ${cell.col}, ${cell.row}`);
    setStatus(`objeto colocado: ${asset.name}`);
  }
}

function drawMarkerShape(object) {
  const color = markerColors[object.category] ?? '#6d8060';
  const radius = Math.max(12, 15 * camera.zoom);

  ctx.beginPath();
  ctx.ellipse(0, 14 * camera.zoom, radius * 1.1, radius * 0.38, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(48, 43, 37, 0.2)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, -4 * camera.zoom, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#fffaf1';
  ctx.fill();
  ctx.lineWidth = Math.max(2, 2 * camera.zoom);
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = `${Math.max(14, 17 * camera.zoom)}px system-ui, Apple Color Emoji, Segoe UI Emoji`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(object.icon ?? '●', 0, -4 * camera.zoom);
}

function drawPlacedObjects() {
  const sortedObjects = [...projectState.placedObjects].sort((a, b) => (a.col + a.row) - (b.col + b.row));
  sortedObjects.forEach((object) => {
    const point = gridToScreen(object.col, object.row);
    ctx.save();
    ctx.translate(point.x, point.y - 17 * camera.zoom);
    drawMarkerShape(object);
    ctx.restore();
  });
}

function drawGrid() {
  ctx.clearRect(0, 0, isoCanvas.width, isoCanvas.height);
  ctx.save();
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const canvasWidth = isoCanvas.width / window.devicePixelRatio;
  const canvasHeight = isoCanvas.height / window.devicePixelRatio;
  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  skyGradient.addColorStop(0, '#dce8e2');
  skyGradient.addColorStop(0.48, '#dce8e2');
  skyGradient.addColorStop(1, '#c6d1ad');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const point = gridToScreen(col, row);
      const isSelected = projectState.selectedCell?.col === col && projectState.selectedCell?.row === row;
      const tint = (col + row) % 2 === 0 ? '#a8b589' : '#aebc91';
      drawDiamond(
        point.x,
        point.y,
        grid.tileWidth * camera.zoom,
        grid.tileHeight * camera.zoom,
        isSelected ? '#d9c594' : tint,
        isSelected ? '#6d8060' : 'rgba(75, 63, 45, 0.16)'
      );
    }
  }

  drawPlacedObjects();
  ctx.restore();
}

function resizeCanvas() {
  const rect = worldCanvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  isoCanvas.width = Math.floor(rect.width * pixelRatio);
  isoCanvas.height = Math.floor(rect.height * pixelRatio);
  isoCanvas.style.width = `${rect.width}px`;
  isoCanvas.style.height = `${rect.height}px`;
  drawGrid();
}

function getPointerPosition(event) {
  const rect = isoCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function getDistance(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

toolButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveTool(button.dataset.tool));
});

newProjectBtn.addEventListener('click', () => {
  projectState.name = 'Nuevo proyecto';
  projectState.selectedCell = null;
  projectState.placedObjects = [];
  projectState.assetCycle = {};
  selectObject(null);
  projectMessage.textContent = 'Proyecto: Nuevo proyecto';
  setStatus('nuevo proyecto creado');
  drawGrid();
});

saveProjectBtn.addEventListener('click', () => {
  const savedProject = {
    name: projectState.name,
    activeTool: projectState.activeTool,
    selectedObject: projectState.selectedObject,
    selectedCell: projectState.selectedCell,
    placedObjects: projectState.placedObjects,
    assetCycle: projectState.assetCycle,
    camera,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('storyworlds.project', JSON.stringify(savedProject));
  projectMessage.textContent = 'Proyecto: guardado local';
  setStatus('proyecto guardado en este navegador');
});

openProjectBtn.addEventListener('click', () => {
  const savedProject = localStorage.getItem('storyworlds.project');
  if (!savedProject) {
    setStatus('no hay proyecto guardado todavía');
    return;
  }
  const parsedProject = JSON.parse(savedProject);
  projectState.name = parsedProject.name ?? 'Proyecto abierto';
  projectState.selectedCell = parsedProject.selectedCell ?? null;
  projectState.placedObjects = parsedProject.placedObjects ?? [];
  projectState.assetCycle = parsedProject.assetCycle ?? {};
  camera.x = parsedProject.camera?.x ?? 0;
  camera.y = parsedProject.camera?.y ?? 0;
  camera.zoom = parsedProject.camera?.zoom ?? 1;
  selectObject(parsedProject.selectedObject ?? null);
  setActiveTool(parsedProject.activeTool ?? 'select');
  projectMessage.textContent = `Proyecto: ${projectState.name}`;
  setStatus('proyecto abierto desde este navegador');
  drawGrid();
});

resetViewBtn.addEventListener('click', () => {
  camera.x = 0;
  camera.y = 0;
  camera.zoom = 1;
  drawGrid();
  setStatus('vista centrada');
});

createSceneBtn.addEventListener('click', () => {
  selectObject('Escena nueva');
  setStatus('escena creada como marcador inicial');
});

worldCanvas.addEventListener('pointerdown', (event) => {
  worldCanvas.setPointerCapture(event.pointerId);
  pointerState.pointers.set(event.pointerId, getPointerPosition(event));
  pointerState.isDragging = true;
  pointerState.didDrag = false;
  pointerState.startX = event.clientX;
  pointerState.startY = event.clientY;
  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;

  if (pointerState.pointers.size === 2) {
    const points = [...pointerState.pointers.values()];
    pointerState.pinchDistance = getDistance(points[0], points[1]);
    pointerState.pinchZoom = camera.zoom;
  }
});

worldCanvas.addEventListener('pointermove', (event) => {
  if (!pointerState.isDragging) return;
  pointerState.pointers.set(event.pointerId, getPointerPosition(event));

  if (pointerState.pointers.size === 2) {
    const points = [...pointerState.pointers.values()];
    const distance = getDistance(points[0], points[1]);
    if (pointerState.pinchDistance) {
      camera.zoom = clampZoom(pointerState.pinchZoom * (distance / pointerState.pinchDistance));
      pointerState.didDrag = true;
      drawGrid();
    }
    return;
  }

  const movementX = event.clientX - pointerState.lastX;
  const movementY = event.clientY - pointerState.lastY;
  const totalMove = Math.hypot(event.clientX - pointerState.startX, event.clientY - pointerState.startY);

  if (totalMove > 14) pointerState.didDrag = true;
  if (pointerState.didDrag) {
    camera.x += movementX;
    camera.y += movementY;
    drawGrid();
  }

  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;
});

worldCanvas.addEventListener('pointerup', (event) => {
  pointerState.pointers.delete(event.pointerId);
  if (pointerState.pointers.size < 2) pointerState.pinchDistance = null;

  const totalMove = Math.hypot(event.clientX - pointerState.startX, event.clientY - pointerState.startY);
  const isTap = totalMove <= 14 && !pointerState.didDrag;

  if (isTap) {
    const position = getPointerPosition(event);
    const cell = screenToGrid(position.x, position.y);

    if (cell) {
      projectState.selectedCell = cell;
      if (projectState.activeTool === 'select') {
        const existingObject = getObjectAtCell(cell);
        selectObject(existingObject ? existingObject.name : `Celda ${cell.col}, ${cell.row}`);
        setStatus(existingObject ? `objeto seleccionado: ${existingObject.name}` : `celda ${cell.col}, ${cell.row} seleccionada`);
      } else {
        placeObject(cell);
      }
    } else {
      projectState.selectedCell = null;
      selectObject(null);
      setStatus('clic fuera del mapa');
    }
    drawGrid();
  }

  if (pointerState.pointers.size === 0) pointerState.isDragging = false;
});

worldCanvas.addEventListener('pointercancel', (event) => {
  pointerState.pointers.delete(event.pointerId);
  pointerState.isDragging = false;
  pointerState.pinchDistance = null;
});

worldCanvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const direction = event.deltaY > 0 ? -0.08 : 0.08;
  camera.zoom = clampZoom(camera.zoom + direction);
  drawGrid();
}, { passive: false });

window.addEventListener('resize', resizeCanvas);

setActiveTool('select');
selectObject(null);
loadAssetLibrary().then(() => drawGrid());
resizeCanvas();
