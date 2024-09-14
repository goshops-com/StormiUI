const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  connectDatabase: (connectionString) => ipcRenderer.invoke('connect-database', connectionString),
  getCollections: () => ipcRenderer.invoke('get-collections'),
  queryDocuments: (collection, query, options) => ipcRenderer.invoke('query-documents', collection, query, options),
  createDocument: (collection, document) => ipcRenderer.invoke('create-document', collection, document),
  updateDocument: (collection, id, document) => ipcRenderer.invoke('update-document', collection, id, document),
  deleteDocument: (collection, id) => ipcRenderer.invoke('delete-document', collection, id)
});