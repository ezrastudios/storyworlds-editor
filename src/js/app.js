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

const projectState = {
  name: 'Sin título',
  activeTool: 'select',
  selectedObject: null,
  assets: [],
  selectedCell: null
};

const camera = {
  x: 0,
  y: 0,
  zoom: 1
};

const grid = {
  width: 18,
  height: 18,
  tileWidth: 72,
  tileHeight: 36
};

const pointerState = {
  isDragging: false,
  didDrag: false,
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

    if (!response.ok) {
      throw new Error('No se pudo leer library.json');
    }

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

function screenToGrid(screenX, screenY) {
  const center = getCanvasCenter();
  const mapOffsetY = 40;
  const localX = (screenX - center.x) / camera.zoom;
  const localY = (screenY - center.y + mapOffsetY * camera.zoom) / camera.zoom;

  const col = Math.floor(localY / grid.tileHeight + localX / grid.tileWidth);
  const row = Math.floor(localY / grid.tileHeight - localX / grid.tileWidth);

  if (col < 0 || row < 0 || col >= grid.width || row >= grid.height) {
    return null;
  }

  return { col, row };
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
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function getDistance(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

toolButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveTool(button.dataset.tool);
  });
});

newProjectBtn.addEventListener('click', () => {
  projectState.name = 'Nuevo proyecto';
  projectState.selectedCell = null;
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

  if (Math.abs(movementX) > 2 || Math.abs(movementY) > 2) {
    pointerState.didDrag = true;
  }

  camera.x += movementX;
  camera.y += movementY;
  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;
  drawGrid();
});

worldCanvas.addEventListener('pointerup', (event) => {
  pointerState.pointers.delete(event.pointerId);

  if (pointerState.pointers.size < 2) {
    pointerState.pinchDistance = null;
  }

  if (!pointerState.didDrag) {
    const position = getPointerPosition(event);
    const cell = screenToGrid(position.x, position.y);

    if (cell) {
      projectState.selectedCell = cell;
      selectObject(`Celda ${cell.col}, ${cell.row}`);
      setStatus(`celda ${cell.col}, ${cell.row} seleccionada`);
    } else {
      projectState.selectedCell = null;
      selectObject(null);
      setStatus('clic fuera del mapa');
    }

    drawGrid();
  }

  if (pointerState.pointers.size === 0) {
    pointerState.isDragging = false;
  }
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
loadAssetLibrary();
resizeCanvas();
