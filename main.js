const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { StormiDB, AzureBlobStorage } = require('stormidb');

let store;
let stormiDB;

async function createWindow() {
  // Dynamically import electron-store
  const Store = await import('electron-store');
  store = new Store.default();

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('store-get', async (event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', async (event, key, value) => {
  store.set(key, value);
});

ipcMain.handle('connect-database', async (event, connectionString) => {
  try {
    const storage = new AzureBlobStorage(connectionString);
    stormiDB = new StormiDB(storage);
    return { success: true };
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-collections', async () => {
  try {
    const collections = await stormiDB.getCollections();
    return { success: true, collections };
  } catch (error) {
    console.error('Failed to get collections:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('query-documents', async (event, collection, query, options) => {
  try {
    const results = await stormiDB.find(collection, query, options);
    return { success: true, results };
  } catch (error) {
    console.error('Failed to query documents:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-document', async (event, collection, document) => {
  try {
    const id = await stormiDB.create(collection, document);
    return { success: true, id };
  } catch (error) {
    console.error('Failed to create document:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-document', async (event, collection, id, document) => {
  try {
    await stormiDB.update(collection, id, document);
    return { success: true };
  } catch (error) {
    console.error('Failed to update document:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-document', async (event, collection, id) => {
  try {
    await stormiDB.delete(collection, id);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete document:', error);
    return { success: false, error: error.message };
  }
});
