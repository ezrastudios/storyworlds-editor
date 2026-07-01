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
const exportProjectBtn = document.querySelector('#exportProjectBtn');
const importProjectBtn = document.querySelector('#importProjectBtn');
const importProjectInput = document.querySelector('#importProjectInput');
const importAssetBtn = document.querySelector('#importAssetBtn');
const importAssetInput = document.querySelector('#importAssetInput');
const assetNameInput = document.querySelector('#assetNameInput');
const assetCategoryInput = document.querySelector('#assetCategoryInput');
const assetPreview = document.querySelector('#assetPreview');
const assetLibraryList = document.querySelector('#assetLibraryList');
const resetViewBtn = document.querySelector('#resetViewBtn');
const createSceneBtn = document.querySelector('#createSceneBtn');
const worldCanvas = document.querySelector('#worldCanvas');
const isoCanvas = document.querySelector('#isoCanvas');
const ctx = isoCanvas.getContext('2d');

const DB_NAME = 'storyworlds-editor';
const DB_VERSION = 1;
const ASSET_STORE = 'assets';

const toolNames = {
  select: 'Seleccionar',
  tree: 'Árbol',
  house: 'Casa',
  plant: 'Vegetación',
  rock: 'Roca',
  path: 'Camino',
  water: 'Agua',
  erase: 'Borrar'
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
  selectedAssetId: null,
  assets: [],
  baseAssets: [],
  localAssets: [],
  selectedCell: null,
  previewCell: null,
  placedObjects: [],
  assetCycle: {}
};

const camera = { x: 0, y: 0, zoom: 1 };
const grid = { width: 18, height: 18, tileWidth: 72, tileHeight: 36 };
const assetImages = new Map();

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

function normalizeAssetId(value) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getReadableName(assetId) {
  return assetId
    .replace(/[_\-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function openAssetDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveLocalAsset(asset) {
  const db = await openAssetDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE, 'readwrite');
    transaction.objectStore(ASSET_STORE).put(asset);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getLocalAssets() {
  const db = await openAssetDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE, 'readonly');
    const request = transaction.objectStore(ASSET_STORE).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function cacheImage(asset) {
  const src = asset.src || asset.file;
  if (!src || assetImages.has(asset.id)) return Promise.resolve();

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      assetImages.set(asset.id, image);
      drawGrid();
      resolve();
    };
    image.onerror = () => {
      console.warn(`No se pudo cargar el asset ${asset.id}`);
      resolve();
    };
    image.src = src;
  });
}

function getAssetById(assetId) {
  return projectState.assets.find((asset) => asset.id === assetId) ?? null;
}

function getAssetsByCategory(category) {
  return projectState.assets.filter((asset) => asset.category === category);
}

function isImageAsset(asset) {
  return Boolean(asset?.src || asset?.file || asset?.kind === 'local-image' || asset?.kind === 'svg' || asset?.type === 'image');
}

async function loadAssetLibrary() {
  try {
    const response = await fetch('src/data/library.json');
    if (!response.ok) throw new Error('No se pudo leer library.json');
    const library = await response.json();
    projectState.baseAssets = library.assets ?? [];
  } catch (error) {
    projectState.baseAssets = [];
    console.warn(error);
  }

  try {
    projectState.localAssets = await getLocalAssets();
  } catch (error) {
    projectState.localAssets = [];
    console.warn(error);
  }

  projectState.assets = [...projectState.baseAssets, ...projectState.localAssets];
  assetCountLabel.textContent = `${projectState.assets.length} assets`;
  await Promise.all(projectState.assets.filter(isImageAsset).map(cacheImage));
  renderLocalAssetLibrary();
  setStatus('biblioteca cargada');
}

function renderLocalAssetLibrary() {
  assetLibraryList.innerHTML = '';

  if (!projectState.localAssets.length) {
    assetLibraryList.innerHTML = '<p class="empty-state">Aún no hay assets importados.</p>';
    return;
  }

  projectState.localAssets.forEach((asset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'asset-card';
    button.classList.toggle('active', projectState.selectedAssetId === asset.id);
    button.dataset.assetId = asset.id;

    const image = document.createElement('img');
    image.src = asset.src;
    image.alt = asset.name;

    const label = document.createElement('span');
    label.textContent = asset.id;

    button.append(image, label);
    button.addEventListener('click', () => selectLibraryAsset(asset.id));
    assetLibraryList.append(button);
  });
}

function selectLibraryAsset(assetId) {
  const asset = getAssetById(assetId);
  if (!asset) return;

  projectState.selectedAssetId = asset.id;
  assetPreview.innerHTML = `<img src="${asset.src}" alt="${asset.name}" />`;

  if (toolNames[asset.category]) {
    setActiveTool(asset.category);
  } else if (asset.category !== 'bridge') {
    setActiveTool('select');
  }

  selectObject(`Asset: ${asset.name}`);
  renderLocalAssetLibrary();
  setStatus(`asset seleccionado: ${asset.name}`);
}

async function importLocalAsset(file) {
  if (!file) return;

  const id = normalizeAssetId(assetNameInput.value || file.name.replace(/\.[^.]+$/, ''));
  if (!id) {
    setStatus('escribe un nombre válido para el asset');
    return;
  }

  const category = assetCategoryInput.value;
  const src = await readFileAsDataURL(file);
  const asset = {
    id,
    name: getReadableName(id),
    category,
    type: 'image',
    kind: 'local-image',
    src,
    drawWidth: category === 'house' ? 118 : 82,
    drawHeight: category === 'house' ? 96 : 82,
    anchorY: category === 'house' ? 88 : 70,
    importedAt: new Date().toISOString()
  };

  await saveLocalAsset(asset);
  await cacheImage(asset);
  await loadAssetLibrary();
  selectLibraryAsset(asset.id);
  setStatus(`asset importado: ${asset.id}`);
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

function setPreviewFromPoint(point) {
  projectState.previewCell = screenToGrid(point.x, point.y);
  drawGrid();
}

function drawDiamond(x, y, width, height, fill, stroke, lineWidth = 1) {
  ctx.beginPath();
  ctx.moveTo(x, y - height / 2);
  ctx.lineTo(x + width / 2, y);
  ctx.lineTo(x, y + height / 2);
  ctx.lineTo(x - width / 2, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function getObjectAtCell(cell) {
  return projectState.placedObjects.find((object) => object.col === cell.col && object.row === cell.row);
}

function getNextAssetForTool(tool) {
  if (projectState.selectedAssetId) {
    const selectedAsset = getAssetById(projectState.selectedAssetId);
    if (selectedAsset && (selectedAsset.category === tool || selectedAsset.category === 'bridge')) {
      return selectedAsset;
    }
  }

  const category = categoryByTool[tool];
  const availableAssets = getAssetsByCategory(category);
  if (!availableAssets.length) return null;
  const currentIndex = projectState.assetCycle[category] ?? 0;
  const asset = availableAssets[currentIndex % availableAssets.length];
  projectState.assetCycle[category] = currentIndex + 1;
  return asset;
}

function copyAssetVisualProperties(targetObject, asset) {
  targetObject.assetId = asset.id;
  targetObject.name = asset.name;
  targetObject.icon = asset.icon;
  targetObject.category = asset.category;
  targetObject.kind = asset.kind;
  targetObject.type = asset.type;
  targetObject.src = asset.src;
  targetObject.file = asset.file;
  targetObject.drawWidth = asset.drawWidth;
  targetObject.drawHeight = asset.drawHeight;
  targetObject.anchorY = asset.anchorY;
}

function placeObject(cell) {
  const asset = getNextAssetForTool(projectState.activeTool);
  if (!asset) {
    setStatus('no hay assets disponibles para esta herramienta');
    return;
  }

  const existingObject = getObjectAtCell(cell);
  if (existingObject) {
    copyAssetVisualProperties(existingObject, asset);
    selectObject(`${asset.name} en ${cell.col}, ${cell.row}`);
    setStatus(`objeto actualizado: ${asset.name}`);
  } else {
    const newObject = {
      id: crypto.randomUUID ? crypto.randomUUID() : `object_${Date.now()}`,
      col: cell.col,
      row: cell.row,
      rotation: 0,
      scale: 1
    };
    copyAssetVisualProperties(newObject, asset);
    projectState.placedObjects.push(newObject);
    selectObject(`${asset.name} en ${cell.col}, ${cell.row}`);
    setStatus(`objeto colocado: ${asset.name}`);
  }
}

function eraseObject(cell) {
  const objectIndex = projectState.placedObjects.findIndex((object) => object.col === cell.col && object.row === cell.row);
  if (objectIndex === -1) {
    selectObject(`Celda ${cell.col}, ${cell.row}`);
    setStatus('no hay objeto para borrar');
    return;
  }
  const [removedObject] = projectState.placedObjects.splice(objectIndex, 1);
  selectObject(null);
  setStatus(`objeto borrado: ${removedObject.name}`);
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

function drawImageAsset(object) {
  const image = assetImages.get(object.assetId);
  if (!image && object.src) {
    cacheImage(object);
  }

  if (!image) {
    drawMarkerShape(object);
    return;
  }

  const width = (object.drawWidth ?? 82) * camera.zoom * (object.scale ?? 1);
  const height = (object.drawHeight ?? 82) * camera.zoom * (object.scale ?? 1);
  const anchorY = (object.anchorY ?? height / camera.zoom / 2) * camera.zoom * (object.scale ?? 1);

  ctx.beginPath();
  ctx.ellipse(0, 9 * camera.zoom, width * 0.32, height * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(48, 43, 37, 0.16)';
  ctx.fill();
  ctx.drawImage(image, -width / 2, -anchorY, width, height);
}

function drawPlacedObjects() {
  const sortedObjects = [...projectState.placedObjects].sort((a, b) => (a.col + a.row) - (b.col + b.row));
  sortedObjects.forEach((object) => {
    const point = gridToScreen(object.col, object.row);
    ctx.save();
    ctx.translate(point.x, point.y);

    if (object.src || object.file || isImageAsset(getAssetById(object.assetId))) {
      drawImageAsset(object);
    } else {
      ctx.translate(0, -17 * camera.zoom);
      drawMarkerShape(object);
    }

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
      const isPreview = projectState.previewCell?.col === col && projectState.previewCell?.row === row;
      const tint = (col + row) % 2 === 0 ? '#a8b589' : '#aebc91';
      const previewStroke = projectState.activeTool === 'erase' ? '#a55645' : '#302b25';
      const previewFill = projectState.activeTool === 'erase' ? '#e5c1b8' : '#c8d6aa';

      drawDiamond(
        point.x,
        point.y,
        grid.tileWidth * camera.zoom,
        grid.tileHeight * camera.zoom,
        isPreview ? previewFill : isSelected ? '#d9c594' : tint,
        isPreview ? previewStroke : isSelected ? '#6d8060' : 'rgba(75, 63, 45, 0.16)',
        isPreview ? Math.max(2, 2 * camera.zoom) : 1
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

function createProjectDocument() {
  const timestamp = new Date().toISOString();
  return {
    format: 'SWE',
    version: 1,
    project: { name: projectState.name, updatedAt: timestamp },
    editor: {
      activeTool: projectState.activeTool,
      selectedCell: projectState.selectedCell,
      selectedObject: projectState.selectedObject,
      selectedAssetId: projectState.selectedAssetId
    },
    grid: {
      type: 'isometric',
      width: grid.width,
      height: grid.height,
      tileWidth: grid.tileWidth,
      tileHeight: grid.tileHeight
    },
    camera: { ...camera },
    assetCycle: { ...projectState.assetCycle },
    objects: projectState.placedObjects.map((object) => ({ ...object }))
  };
}

function applyProjectDocument(documentData) {
  if (documentData?.format !== 'SWE' || documentData?.version !== 1) {
    throw new Error('Archivo SWE no válido o versión no compatible.');
  }

  projectState.name = documentData.project?.name ?? 'Proyecto importado';
  projectState.selectedCell = documentData.editor?.selectedCell ?? null;
  projectState.previewCell = null;
  projectState.selectedAssetId = documentData.editor?.selectedAssetId ?? null;
  projectState.placedObjects = documentData.objects ?? [];
  projectState.assetCycle = documentData.assetCycle ?? {};

  camera.x = documentData.camera?.x ?? 0;
  camera.y = documentData.camera?.y ?? 0;
  camera.zoom = documentData.camera?.zoom ?? 1;

  projectState.placedObjects.forEach((object) => {
    if (object.src) cacheImage(object);
  });

  selectObject(documentData.editor?.selectedObject ?? null);
  setActiveTool(documentData.editor?.activeTool ?? 'select');
  projectMessage.textContent = `Proyecto: ${projectState.name}`;
  renderLocalAssetLibrary();
  drawGrid();
}

function getSafeFileName(name) {
  return (name || 'story-world')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'story-world';
}

function exportProjectFile() {
  const projectDocument = createProjectDocument();
  const fileContent = JSON.stringify(projectDocument, null, 2);
  const blob = new Blob([fileContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${getSafeFileName(projectState.name)}.swe`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus('archivo .swe exportado');
}

function importProjectFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const documentData = JSON.parse(reader.result);
      applyProjectDocument(documentData);
      setStatus(`archivo importado: ${file.name}`);
    } catch (error) {
      console.error(error);
      setStatus('no se pudo importar el archivo');
    }
  };
  reader.readAsText(file);
}

toolButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveTool(button.dataset.tool));
});

newProjectBtn.addEventListener('click', () => {
  projectState.name = 'Nuevo proyecto';
  projectState.selectedCell = null;
  projectState.previewCell = null;
  projectState.placedObjects = [];
  projectState.assetCycle = {};
  selectObject(null);
  projectMessage.textContent = 'Proyecto: Nuevo proyecto';
  setStatus('nuevo proyecto creado');
  drawGrid();
});

saveProjectBtn.addEventListener('click', () => {
  localStorage.setItem('storyworlds.project', JSON.stringify(createProjectDocument()));
  projectMessage.textContent = 'Proyecto: guardado local';
  setStatus('proyecto guardado en este navegador');
});

openProjectBtn.addEventListener('click', () => {
  const savedProject = localStorage.getItem('storyworlds.project');
  if (!savedProject) {
    setStatus('no hay proyecto guardado todavía');
    return;
  }
  try {
    applyProjectDocument(JSON.parse(savedProject));
    setStatus('proyecto abierto desde este navegador');
  } catch (error) {
    console.error(error);
    setStatus('no se pudo abrir el proyecto guardado');
  }
});

exportProjectBtn.addEventListener('click', exportProjectFile);
importProjectBtn.addEventListener('click', () => importProjectInput.click());
importProjectInput.addEventListener('change', () => {
  importProjectFile(importProjectInput.files?.[0]);
  importProjectInput.value = '';
});

importAssetBtn.addEventListener('click', () => importAssetInput.click());
importAssetInput.addEventListener('change', async () => {
  try {
    await importLocalAsset(importAssetInput.files?.[0]);
  } catch (error) {
    console.error(error);
    setStatus('no se pudo importar el asset');
  } finally {
    importAssetInput.value = '';
  }
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

worldCanvas.addEventListener('pointermove', (event) => {
  const position = getPointerPosition(event);

  if (!pointerState.isDragging) {
    setPreviewFromPoint(position);
    return;
  }

  pointerState.pointers.set(event.pointerId, position);

  if (pointerState.pointers.size === 2) {
    const points = [...pointerState.pointers.values()];
    const distance = getDistance(points[0], points[1]);
    if (pointerState.pinchDistance) {
      camera.zoom = clampZoom(pointerState.pinchZoom * (distance / pointerState.pinchDistance));
      pointerState.didDrag = true;
      projectState.previewCell = null;
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
    projectState.previewCell = null;
    drawGrid();
  } else {
    setPreviewFromPoint(position);
  }

  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;
});

worldCanvas.addEventListener('pointerdown', (event) => {
  worldCanvas.setPointerCapture(event.pointerId);
  const position = getPointerPosition(event);
  pointerState.pointers.set(event.pointerId, position);
  pointerState.isDragging = true;
  pointerState.didDrag = false;
  pointerState.startX = event.clientX;
  pointerState.startY = event.clientY;
  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;
  setPreviewFromPoint(position);

  if (pointerState.pointers.size === 2) {
    const points = [...pointerState.pointers.values()];
    pointerState.pinchDistance = getDistance(points[0], points[1]);
    pointerState.pinchZoom = camera.zoom;
  }
});

worldCanvas.addEventListener('pointerup', (event) => {
  pointerState.pointers.delete(event.pointerId);
  if (pointerState.pointers.size < 2) pointerState.pinchDistance = null;

  const totalMove = Math.hypot(event.clientX - pointerState.startX, event.clientY - pointerState.startY);
  const isTap = totalMove <= 14 && !pointerState.didDrag;

  if (isTap) {
    const position = getPointerPosition(event);
    const cell = projectState.previewCell ?? screenToGrid(position.x, position.y);

    if (cell) {
      projectState.selectedCell = cell;
      if (projectState.activeTool === 'select') {
        const existingObject = getObjectAtCell(cell);
        selectObject(existingObject ? existingObject.name : `Celda ${cell.col}, ${cell.row}`);
        setStatus(existingObject ? `objeto seleccionado: ${existingObject.name}` : `celda ${cell.col}, ${cell.row} seleccionada`);
      } else if (projectState.activeTool === 'erase') {
        eraseObject(cell);
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

worldCanvas.addEventListener('pointerleave', () => {
  if (!pointerState.isDragging) {
    projectState.previewCell = null;
    drawGrid();
  }
});

worldCanvas.addEventListener('pointercancel', (event) => {
  pointerState.pointers.delete(event.pointerId);
  pointerState.isDragging = false;
  pointerState.pinchDistance = null;
  projectState.previewCell = null;
  drawGrid();
});

worldCanvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const direction = event.deltaY > 0 ? -0.08 : 0.08;
  camera.zoom = clampZoom(camera.zoom + direction);
  projectState.previewCell = null;
  drawGrid();
}, { passive: false });

window.addEventListener('resize', resizeCanvas);

setActiveTool('select');
selectObject(null);
loadAssetLibrary().then(() => drawGrid());
resizeCanvas();
