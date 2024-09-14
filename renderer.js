
const { storeGet, storeSet, connectDatabase, getCollections, queryDocuments, createDocument, updateDocument, deleteDocument: deleteDocumentAPI } = window.electronAPI;

let store;
let stormiDB;
let editor;
let selectedCollection = null;
let currentPage = 1;
let totalResults = 0;
const pageSize = 5;
let connections = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM content loaded');
    await loadSavedConnections();
    
    initConnectionSetup();
    initJsonEditor();
    initEventListeners();

    const savedConnectionString = await window.electronAPI.storeGet('connectionString');
    console.log('Saved connection string:', savedConnectionString);
    if (savedConnectionString) {
        document.getElementById('connection-string').value = savedConnectionString;
    }
});


async function loadSavedConnections() {
    connections = await storeGet('connections') || [];
    console.log('Loaded connections:', connections);
    updateConnectionsDropdown();
}

function updateConnectionsDropdown() {
    const savedConnectionsSelect = document.getElementById('saved-connections');
    savedConnectionsSelect.innerHTML = '<option value="">Select a saved connection</option>';
    connections.forEach((conn, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = conn.name;
        savedConnectionsSelect.appendChild(option);
    });
}

function initConnectionSetup() {
    console.log('Initializing connection setup');
    const savedConnectionsSelect = document.getElementById('saved-connections');
    const connectionName = document.getElementById('connection-name');
    const connectionString = document.getElementById('connection-string');
    const saveConnectionBtn = document.getElementById('save-connection');
    const deleteConnectionBtn = document.getElementById('delete-connection');
    const connectDatabaseBtn = document.getElementById('connect-database');

    savedConnectionsSelect.addEventListener('change', (event) => {
        const selectedIndex = event.target.value;
        if (selectedIndex !== '') {
            const selectedConnection = connections[selectedIndex];
            connectionName.value = selectedConnection.name;
            connectionString.value = selectedConnection.connectionString;
        } else {
            connectionName.value = '';
            connectionString.value = '';
        }
    });

    saveConnectionBtn.addEventListener('click', async () => {
        console.log('Save connection button clicked');
        if (connectionName.value && connectionString.value) {
            connections.push({
                name: connectionName.value,
                connectionString: connectionString.value
            });
            await storeSet('connections', connections);
            updateConnectionsDropdown();
            connectionName.value = '';
            connectionString.value = '';
            alert('Connection saved successfully!');
        } else {
            console.log('Connection name or string is empty');
            alert('Please enter both a connection name and a connection string before saving.');
        }
    });

    deleteConnectionBtn.addEventListener('click', async () => {
        const selectedIndex = savedConnectionsSelect.value;
        if (selectedIndex !== '') {
            if (confirm('Are you sure you want to delete this connection?')) {
                connections.splice(selectedIndex, 1);
                await storeSet('connections', connections);
                updateConnectionsDropdown();
                connectionName.value = '';
                connectionString.value = '';
                alert('Connection deleted successfully!');
            }
        } else {
            alert('Please select a connection to delete.');
        }
    });

    connectDatabaseBtn.addEventListener('click', async () => {
        console.log('Connect to database button clicked');
        try {
            const connectionStringValue = connectionString.value;
            console.log('Connecting with string:', connectionStringValue);
            if (!connectionStringValue) {
                throw new Error('Connection string is empty');
            }
            const result = await connectDatabase(connectionStringValue);
            if (result.success) {
                console.log('StormiDB initialized');
                document.getElementById('database-explorer').classList.remove('hidden');
                await initCollections();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to connect to the database:', error);
            alert('Failed to connect to the database. Error: ' + error.message);
        }
    });
}

async function initCollections() {
    try {
        const result = await getCollections();
        if (result.success) {
            const collections = result.collections;
            const collectionsList = document.getElementById('collections');
            collectionsList.innerHTML = '';
            collections.forEach(collection => {
                const li = document.createElement('li');
                li.className = 'cursor-pointer p-4 hover:bg-gray-100 border-b last:border-b-0 transition duration-300';
                li.textContent = collection;
                li.onclick = () => selectCollection(collection);
                collectionsList.appendChild(li);
            });
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Failed to fetch collections:', error);
        alert('Failed to fetch collections. Error: ' + error.message);
    }
}

async function handleQuery() {
    console.log('Handling query for collection:', selectedCollection);
    if (!selectedCollection) {
        console.log('No collection selected');
        return;
    }

    try {
        const query = editor.get();
        console.log('Query:', query);
        const options = {
            limit: pageSize,
            offset: (currentPage - 1) * pageSize
        };
        console.log('Query options:', options);
        const result = await queryDocuments(selectedCollection, query, options);
        if (result.success) {
            console.log('Query results:', result.results);
            displayResults(result.results);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Failed to query documents:', error);
        alert('Failed to execute query. Error: ' + error.message);
    }
}

function initJsonEditor() {
    const container = document.getElementById('jsoneditor');
    const options = {
        mode: 'code',
        modes: ['code'],
        enableSort: false,
        enableTransform: false,
        statusBar: false,
        search: false,
        mainMenuBar: false,
        navigationBar: false,
        onError: function (err) {
            alert(err.toString());
        }
    };
    editor = new JSONEditor(container, options);
    editor.set({});
}

function initEventListeners() {
    document.getElementById('execute-query').addEventListener('click', handleQuery);
    document.getElementById('prev-page').addEventListener('click', () => handlePageChange(currentPage - 1));
    document.getElementById('next-page').addEventListener('click', () => handlePageChange(currentPage + 1));
    document.getElementById('add-new-document').addEventListener('click', addNewDocument);
}

function selectCollection(collection) {
    console.log('Collection selected:', collection);
    selectedCollection = collection;
    document.getElementById('selected-collection').textContent = collection;
    document.getElementById('query-section').classList.remove('hidden');
    document.getElementById('results-section').classList.add('hidden');
    currentPage = 1;
    editor.set({});
}

function displayResults(results) {
    console.log('Displaying results:', results);
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';
    
    results.forEach((result, index) => {
        const resultContainer = document.createElement('div');
        resultContainer.className = 'bg-white p-4 rounded-lg shadow-md mb-4';
        
        const resultEditorContainer = document.createElement('div');
        resultEditorContainer.className = 'result-editor';
        resultContainer.appendChild(resultEditorContainer);

        const resultEditor = new JSONEditor(resultEditorContainer, {
            mode: 'view',
            modes: ['view'],
            enableSort: false,
            enableTransform: false,
            statusBar: false,
            search: false,
            mainMenuBar: false,
            navigationBar: false,
            onError: function (err) {
                alert(err.toString());
            }
        });
        resultEditor.set(result);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'mt-4 flex justify-end space-x-2';

        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.className = 'bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition duration-300';
        editButton.onclick = () => enableEditMode(resultEditor, buttonContainer);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition duration-300';
        deleteButton.onclick = () => deleteDocument(result.id);

        buttonContainer.appendChild(editButton);
        buttonContainer.appendChild(deleteButton);
        resultContainer.appendChild(buttonContainer);
        resultsContainer.appendChild(resultContainer);
    });

    totalResults = results.length; // This should be updated with the total count from the server
    updatePagination();
    document.getElementById('results-section').classList.remove('hidden');
}

function enableEditMode(resultEditor, buttonContainer) {
    resultEditor.setMode('code');
    
    buttonContainer.innerHTML = '';
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition duration-300 mr-2';
    saveButton.onclick = () => saveEdit(resultEditor, buttonContainer);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition duration-300';
    cancelButton.onclick = () => cancelEdit(resultEditor, buttonContainer);

    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(cancelButton);
}

async function addNewDocument() {
    const modalBackground = document.createElement('div');
    modalBackground.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
    
    const modal = document.createElement('div');
    modal.className = 'bg-white p-6 rounded-lg w-3/4 max-w-3xl';
    
    const title = document.createElement('h3');
    title.textContent = 'Add New Document';
    title.className = 'text-xl font-semibold mb-4';
    
    const editorContainer = document.createElement('div');
    editorContainer.className = 'mb-4 h-96';
    
    const newDocumentEditor = new JSONEditor(editorContainer, {
        mode: 'code',
        modes: ['code'],
        enableSort: false,
        enableTransform: false,
        statusBar: false,
        search: false,
        mainMenuBar: false,
        navigationBar: false,
        onError: function (err) {
            alert(err.toString());
        }
    });
    newDocumentEditor.set({});
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-end space-x-2';
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition duration-300';
    saveButton.onclick = async () => {
        try {
            const newDocument = newDocumentEditor.get();
            const result = await createDocument(selectedCollection, newDocument);
            if (result.success) {
                alert('New document added successfully!');
                modalBackground.remove();
                handleQuery();  // Refresh the results
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to add new document:', error);
            alert('Failed to add new document. Error: ' + error.message);
        }
    };
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition duration-300';
    cancelButton.onclick = () => modalBackground.remove();
    
    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(cancelButton);
    
    modal.appendChild(title);
    modal.appendChild(editorContainer);
    modal.appendChild(buttonContainer);
    modalBackground.appendChild(modal);
    document.body.appendChild(modalBackground);
}

async function saveEdit(resultEditor, buttonContainer) {
    try {
        const editedData = resultEditor.get();
        const id = editedData.id;
        const result = await updateDocument(selectedCollection, id, editedData);
        if (result.success) {
            alert('Document updated successfully!');
            resultEditor.setMode('view');
            resetEditButtons(resultEditor, buttonContainer);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Failed to update document:', error);
        alert('Failed to update document. Error: ' + error.message);
    }
}

async function deleteDocument(id) {
    if (confirm('Are you sure you want to delete this document?')) {
        try {
            const result = await deleteDocumentAPI(selectedCollection, id);  // Use the renamed function
            if (result.success) {
                alert('Document deleted successfully!');
                handleQuery();  // Refresh the results
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to delete document:', error);
            alert('Failed to delete document. Error: ' + error.message);
        }
    }
}

function cancelEdit(resultEditor, buttonContainer) {
    resultEditor.setMode('view');
    resetEditButtons(resultEditor, buttonContainer);
}

function resetEditButtons(resultEditor, buttonContainer) {
    buttonContainer.innerHTML = '';
    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.className = 'bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition duration-300 mr-2';
    editButton.onclick = () => enableEditMode(resultEditor, buttonContainer);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition duration-300';
    deleteButton.onclick = () => deleteDocument(resultEditor.get().id);

    buttonContainer.appendChild(editButton);
    buttonContainer.appendChild(deleteButton);
}


function handlePageChange(newPage) {
    currentPage = newPage;
    handleQuery();
}

function updatePagination() {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage * pageSize >= totalResults;
    pageInfo.textContent = `Page ${currentPage} of ${Math.ceil(totalResults / pageSize)}`;
}

