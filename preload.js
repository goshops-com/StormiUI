const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  connectDatabase: (connectionString) => ipcRenderer.invoke('connect-database', connectionString),
  getCollections: () => ipcRenderer.invoke('get-collections'),
  queryDocuments: (collection, query, options) => ipcRenderer.invoke('query-documents', collection, query, options),
  createDocument: (collection, document) => ipcRenderer.invoke('create-document', collection, document),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  updateDocument: (collection, id, data, options) => ipcRenderer.invoke('update-document', collection, id, data, options),
  deleteDocument: (collection, id) => ipcRenderer.invoke('delete-document', collection, id),
  exportQuery: (collection, query, progressCallback) => {
    ipcRenderer.on('export-progress', (event, obj) => {
        progressCallback(obj.totalProcessed, obj.totalCount);
    });
    return ipcRenderer.invoke('export-query', collection, query);
  }
});