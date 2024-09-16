
const { storeGet, storeSet, connectDatabase, getCollections, queryDocuments, createDocument, updateDocument, deleteDocument: deleteDocumentAPI, exportQuery } = window.electronAPI;

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
    initQueryEditor();
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
                li.className = 'cursor-pointer p-4 hover:bg-gray-100 border-b last:border-b-0 transition duration-300 flex items-center';
                
                // Create the icon
                const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                icon.setAttribute('class', 'h-5 w-5 mr-3 text-gray-500');
                icon.setAttribute('fill', 'none');
                icon.setAttribute('viewBox', '0 0 24 24');
                icon.setAttribute('stroke', 'currentColor');
                icon.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                `;
                
                // Create a span for the collection name
                const span = document.createElement('span');
                span.textContent = collection;
                
                // Append icon and span to the li element
                li.appendChild(icon);
                li.appendChild(span);
                
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

function initImportButton() {
    const importButton = document.getElementById('import-data');
    if (importButton) {
        importButton.addEventListener('click', handleImport);
    }
}

async function handleImport() {
    if (!selectedCollection) {
        alert('Please select a collection first.');
        return;
    }

    try {
        const { canceled, filePaths } = await window.electronAPI.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'JSONL', extensions: ['jsonl'] }]
        });

        if (canceled || filePaths.length === 0) {
            return;
        }

        const filePath = filePaths[0];
        let fileContent;
        try {
            fileContent = await window.electronAPI.readFile(filePath);
        } catch (error) {
            console.error('Error reading file:', error);
            alert(`Failed to read the file: ${error.message}`);
            return;
        }

        const lines = fileContent.split('\n').filter(line => line.trim() !== '');

        let processed = 0;
        const total = lines.length;

        // Show import modal
        const importModal = document.getElementById('import-modal');
        const importStatus = document.getElementById('import-status');
        const importProgress = document.getElementById('import-progress');
        importModal.style.display = 'block';
        importStatus.textContent = 'Starting import...';
        importProgress.value = 0;

        for (const line of lines) {
            try {
                const data = JSON.parse(line);
                const id = data.id || data._id;
                if (!id) {
                    console.error('Skipping document without id:', data);
                    continue;
                }
                await window.electronAPI.updateDocument(selectedCollection, id, data, { upsert: true });
                processed++;
                updateImportProgress(processed, total);
            } catch (error) {
                console.error('Error processing line:', line, error);
            }
        }

        importModal.style.display = 'none';
        alert(`Import completed. Processed ${processed} out of ${total} documents.`);
        handleRegularQuery(); // Refresh the results
    } catch (error) {
        console.error('Import failed:', error);
        alert(`Import failed: ${error.message}`);
    }
}

function updateImportProgress(processed, total) {
    const importStatus = document.getElementById('import-status');
    const importProgress = document.getElementById('import-progress');

    const percentage = (processed / total) * 100;
    importStatus.textContent = `Imported ${processed} of ${total} documents`;
    importProgress.value = percentage;
}

function parseQuery(queryString) {
    // Remove whitespace and add quotes to property names
    const formattedQuery = queryString.replace(/(\w+)(?=\s*:)/g, '"$1"')
        .replace(/'/g, '"'); // Replace single quotes with double quotes

    try {
        // Attempt to parse the formatted query
        return JSON.parse(formattedQuery);
    } catch (error) {
        console.error('Error parsing query:', error);
        throw new Error('Invalid query format. Please check your syntax.');
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
    // Manually set the height of the editor
    const aceEditor = editor.aceEditor;
    if (aceEditor) {
        aceEditor.setOptions({
            maxLines: 2,
            minLines: 2
        });
    }
}

function initEventListeners() {
    
    document.getElementById('prev-page').addEventListener('click', () => handlePageChange(currentPage - 1));
    document.getElementById('next-page').addEventListener('click', () => handlePageChange(currentPage + 1));
    document.getElementById('add-new-document').addEventListener('click', addNewDocument);
    document.getElementById('export-query').addEventListener('click', handleExport);
    document.getElementById('execute-query').addEventListener('click', handleRegularQuery);
    document.getElementById('analyze-query').addEventListener('click', handleAnalyzeQuery);
    document.getElementById('import-data').addEventListener('click', handleImport);
}

async function handleRegularQuery() {
    if (!selectedCollection || !queryEditor) {
        console.error('No collection selected or query editor not initialized');
        return;
    }

    try {
        const rawQuery = queryEditor.getText();
        const parsedQuery = parseQuery(rawQuery);
        const options = {
            limit: pageSize,
            offset: (currentPage - 1) * pageSize
        };
        const result = await queryDocuments(selectedCollection, parsedQuery, options);
        if (result.success) {
            displayQueryResults(result.results);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Failed to execute query:', error);
        alert('Failed to execute query. Error: ' + error.message);
    }
}

async function handleAnalyzeQuery() {
    if (!selectedCollection) {
        console.log('No collection selected');
        return;
    }

    try {
        const rawQuery = queryEditor.getText();
        const parsedQuery = parseQuery(rawQuery);
        const options = { analyze: true };
        const result = await queryDocuments(selectedCollection, parsedQuery, options);
        if (result.success) {
            displayAnalysisResults(result.results);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Failed to analyze query:', error);
        alert('Failed to analyze query. Error: ' + error.message);
    }
}

async function handleExport() {
    if (!selectedCollection) {
        alert('Please select a collection first.');
        return;
    }

    const rawQuery = queryEditor.getText();
    let parsedQuery;
    try {
        parsedQuery = parseQuery(rawQuery);
    } catch (error) {
        alert('Invalid query format. Please check your syntax.');
        return;
    }

    const exportModal = document.getElementById('export-modal');
    const exportStatus = document.getElementById('export-status');
    const exportProgress = document.getElementById('export-progress');

    exportModal.style.display = 'block';
    exportStatus.textContent = 'Starting export...';
    exportProgress.value = 0;

    try {
        const result = await electronAPI.exportQuery(selectedCollection, parsedQuery, updateExportProgress);
        if (result.success) {
            alert(`Export completed successfully. File saved at: ${result.filePath}`);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Failed to export query results:', error);
        alert('Failed to export query results. Error: ' + error.message);
    } finally {
        exportModal.style.display = 'none';
    }
}


function updateExportProgress(processed, total) {
    const exportStatus = document.getElementById('export-status');
    const exportProgress = document.getElementById('export-progress');

    const percentage = (processed / total) * 100;
    exportStatus.textContent = `Exported ${processed} of ${total} documents`;
    exportProgress.value = percentage;
}

function selectCollection(collection) {
    console.log('Collection selected:', collection);
    selectedCollection = collection;
    document.getElementById('selected-collection').textContent = collection;
    document.getElementById('query-section').classList.remove('hidden');
    document.getElementById('results-section').classList.add('hidden');
    currentPage = 1;
    if (queryEditor) {
        queryEditor.set({});
    } else {
        console.error('Query Editor not initialized');
    }
}

function displayQueryResults(results) {
    const resultsContainer = document.getElementById('results');
    const resultsSectionElement = document.getElementById('results-section');
    const paginationElement = document.getElementById('pagination');
    
    if (!resultsContainer || !resultsSectionElement || !paginationElement) {
        console.error('Required DOM elements are missing');
        return;
    }

    resultsContainer.innerHTML = '';
    
    results.forEach((result) => {
        const resultContainer = document.createElement('div');
        resultContainer.className = 'bg-white p-4 rounded-lg shadow-md mb-4';
        
        const editorContainer = document.createElement('div');
        editorContainer.style.height = '200px';  // Set a fixed height for result editors
        resultContainer.appendChild(editorContainer);
        
        const resultEditor = createResultEditor(editorContainer, result);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'mt-4 flex justify-end space-x-2';

        const editButton = createButton('Edit', () => enableEditMode(resultEditor, buttonContainer), 'bg-yellow-500 text-white hover:bg-yellow-600', 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z');
        const deleteButton = createButton('Delete', () => deleteDocument(result.id), 'bg-red-500 text-white hover:bg-red-600', 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16');

        buttonContainer.appendChild(editButton);
        buttonContainer.appendChild(deleteButton);
        resultContainer.appendChild(buttonContainer);
        resultsContainer.appendChild(resultContainer);
    });

    totalResults = results.length; // This should be updated with the total count from the server
    updatePagination();
    resultsSectionElement.classList.remove('hidden');
    paginationElement.classList.remove('hidden');
}


function createButton(text, onClick, className, iconPath) {
    const button = document.createElement('button');
    button.className = `btn-icon ${className}`;
    
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('stroke', 'currentColor');
    icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}" />`;
    
    button.appendChild(icon);
    button.appendChild(document.createTextNode(text));
    button.onclick = onClick;
    return button;
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
    modalBackground.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    const modal = document.createElement('div');
    modal.className = 'bg-white p-6 rounded-lg w-3/4 max-w-3xl';
    
    const title = document.createElement('h3');
    title.textContent = 'Add New Document';
    title.className = 'text-xl font-semibold mb-4';
    
    const editorContainer = document.createElement('div');
    editorContainer.className = 'mb-4';
    editorContainer.style.height = '400px'; // Fixed height for the editor
    
    const newDocumentEditor = new JSONEditor(editorContainer, {
        mode: 'code',
        modes: ['code', 'tree'],
        onError: function (err) {
            alert(err.toString());
        }
    });
    newDocumentEditor.set({});
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-end space-x-2 mt-4';
    
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
                handleRegularQuery();  // Refresh the results
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
                handleRegularQuery();  // Refresh the results
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
    handleRegularQuery();
}

async function handleQuery(analyze = false) {
    console.log('Handling query for collection:', selectedCollection);
    if (!selectedCollection) {
        console.log('No collection selected');
        return;
    }

    try {
        const rawQuery = editor.getText();
        console.log('Raw query:', rawQuery);
        
        const parsedQuery = parseQuery(rawQuery);
        console.log('Parsed query:', parsedQuery);

        const options = {
            limit: pageSize,
            offset: (currentPage - 1) * pageSize,
            analyze: analyze
        };
        console.log('Query options:', options);
        const result = await queryDocuments(selectedCollection, parsedQuery, options);
        if (result.success) {
            console.log('Query results:', result.results);
            if (analyze) {
                displayAnalysisResults(result.results);
            } else {
                displayResults(result.results);
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Failed to execute query:', error);
        alert('Failed to execute query. Error: ' + error.message);
    }
}

let queryEditor;

function initQueryEditor() {
    const container = document.getElementById('jsoneditor');
    const options = {
        mode: 'code',
        modes: ['code'],
        statusBar: false,
        search: false,
        mainMenuBar: false,
        navigationBar: false,
        onError: function (err) {
            alert(err.toString());
        }
    };
    queryEditor = new JSONEditor(container, options);
    queryEditor.set({});

    // Manually set the height of the editor
    const aceEditor = queryEditor.aceEditor;
    if (aceEditor) {
        aceEditor.setOptions({
            maxLines: 2,
            minLines: 2
        });
    }
}

function createResultEditor(container, data) {
    const options = {
        mode: 'tree',
        modes: ['tree', 'code'],
        statusBar: false,
        search: true,
        mainMenuBar: false,
        navigationBar: false,
        onError: function (err) {
            alert(err.toString());
        }
    };
    const editor = new JSONEditor(container, options);
    editor.set(data);
    return editor;
}

function displayResults(results) {
    console.log('Displaying results:', results);
    const resultsContainer = document.getElementById('results');
    const resultsSectionElement = document.getElementById('results-section');
    
    if (!resultsContainer || !resultsSectionElement) {
        console.error('Required DOM elements are missing');
        return;
    }

    resultsContainer.innerHTML = '';
    
    results.forEach((result) => {
        const resultContainer = document.createElement('div');
        resultContainer.className = 'bg-white p-4 rounded-lg shadow-md mb-4';
        
        const resultEditor = new JSONEditor(resultContainer, {
            mode: 'view',
            modes: ['view', 'code'],
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

        const editButton = createButton('Edit', () => enableEditMode(resultEditor, buttonContainer), 'bg-yellow-500 text-white hover:bg-yellow-600');
        const deleteButton = createButton('Delete', () => deleteDocument(result.id), 'bg-red-500 text-white hover:bg-red-600');

        buttonContainer.appendChild(editButton);
        buttonContainer.appendChild(deleteButton);
        resultContainer.appendChild(buttonContainer);
        resultsContainer.appendChild(resultContainer);
    });

    totalResults = results.length; // This should be updated with the total count from the server
    updatePagination();
    resultsSectionElement.classList.remove('hidden');
}

function displayAnalysisResults(analysisData) {
    const resultsContainer = document.getElementById('results');
    const resultsSectionElement = document.getElementById('results-section');
    const paginationElement = document.getElementById('pagination');
    
    if (!resultsContainer || !resultsSectionElement || !paginationElement) {
        console.error('Required DOM elements are missing');
        return;
    }

    resultsContainer.innerHTML = '';

    const analysisContainer = document.createElement('div');
    analysisContainer.className = 'bg-white p-4 rounded-lg shadow-md mb-4';

    const title = document.createElement('h3');
    title.textContent = 'Query Analysis';
    title.className = 'text-lg font-semibold mb-2';
    analysisContainer.appendChild(title);

    const analysisContent = document.createElement('pre');
    analysisContent.textContent = JSON.stringify(analysisData, null, 2);
    analysisContent.className = 'bg-gray-100 p-2 rounded overflow-x-auto';
    analysisContainer.appendChild(analysisContent);

    resultsContainer.appendChild(analysisContainer);

    resultsSectionElement.classList.remove('hidden');
    paginationElement.classList.add('hidden');
}

function updatePagination() {
    const paginationElement = document.getElementById('pagination');
    if (!paginationElement) {
        console.error('Pagination element is missing');
        return;
    }

    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    if (!prevButton || !nextButton || !pageInfo) {
        console.error('Pagination sub-elements are missing');
        return;
    }

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage * pageSize >= totalResults;
    pageInfo.textContent = `Page ${currentPage} of ${Math.ceil(totalResults / pageSize)}`;
    paginationElement.classList.remove('hidden');
}

