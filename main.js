const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
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
  mainWindow.webContents.openDevTools();
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

ipcMain.handle('export-query', async (event, collection, query) => {
  try {
      const { filePath, canceled } = await dialog.showSaveDialog({
          title: 'Save Export File',
          defaultPath: path.join(app.getPath('documents'), `${collection}_export.jsonl`),
          filters: [{ name: 'JSON Lines', extensions: ['jsonl'] }]
      });

      if (canceled) {
          return { success: false, error: 'Export cancelled' };
      }

      const pageSize = 100; // Adjust based on your needs
      let page = 1;
      let totalProcessed = 0;
      let hasMore = true;

      const writeStream = fs.createWriteStream(filePath);

      const totalCount = await stormiDB.countDocuments(collection, query);
      while (hasMore) {
          const results = await stormiDB.find(collection, query, { limit: pageSize, offset: (page - 1) * pageSize });
          
          for (const doc of results) {
              writeStream.write(JSON.stringify(doc) + '\n');
              totalProcessed++;
              event.sender.send('export-progress', {totalProcessed, totalCount});
          }

          hasMore = results.length === pageSize;
          page++;
      }

      writeStream.end();

      return { success: true, filePath };
  } catch (error) {
      console.error('Export failed:', error);
      return { success: false, error: error.message };
  }
});

ipcMain.handle('show-open-dialog', (event, options) => {
  return dialog.showOpenDialog(options);
});

ipcMain.handle('read-file', (event, filePath) => {
  return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf-8', (err, data) => {
          if (err) {
              reject(err);
          } else {
              resolve(data);
          }
      });
  });
});

ipcMain.handle('update-document', async (event, collection, id, data, options = {}) => {
  try {
      console.log('update', collection, id, data, options)
      await stormiDB.update(collection, id, data, options);
      return { success: true };
  } catch (error) {
      console.error('Failed to update document:', error);
      return { success: false, error: error.message };
  }
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

ipcMain.handle('delete-document', async (event, collection, id) => {
  try {
    await stormiDB.delete(collection, id);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete document:', error);
    return { success: false, error: error.message };
  }
});
