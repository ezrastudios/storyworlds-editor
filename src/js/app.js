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
  assets: []
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

toolButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveTool(button.dataset.tool);
  });
});

newProjectBtn.addEventListener('click', () => {
  projectState.name = 'Nuevo proyecto';
  selectObject(null);
  projectMessage.textContent = 'Proyecto: Nuevo proyecto';
  setStatus('nuevo proyecto creado');
});

saveProjectBtn.addEventListener('click', () => {
  const savedProject = {
    name: projectState.name,
    activeTool: projectState.activeTool,
    selectedObject: projectState.selectedObject,
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
  selectObject(parsedProject.selectedObject ?? null);
  setActiveTool(parsedProject.activeTool ?? 'select');
  projectMessage.textContent = `Proyecto: ${projectState.name}`;
  setStatus('proyecto abierto desde este navegador');
});

resetViewBtn.addEventListener('click', () => {
  setStatus('vista centrada');
});

createSceneBtn.addEventListener('click', () => {
  selectObject('Escena nueva');
  setStatus('escena creada como marcador inicial');
});

worldCanvas.addEventListener('click', () => {
  const label = toolNames[projectState.activeTool] ?? projectState.activeTool;
  selectObject(`${label} de prueba`);
  setStatus(`clic en lienzo con ${label.toLowerCase()}`);
});

setActiveTool('select');
selectObject(null);
loadAssetLibrary();
