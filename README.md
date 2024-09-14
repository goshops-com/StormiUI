# StormiDB Explorer

StormiDB Explorer is an Electron-based desktop application that provides a user-friendly interface for interacting with StormiDB (<https://github.com/goshops-com/StormiDB>) databases. It allows users to manage multiple database connections, explore collections, and perform CRUD operations on documents.

## Features

- Multiple database connection management
- Collection explorer
- Document viewer and editor
- Query execution with JSON syntax
- Create, Read, Update, and Delete operations on documents
- Pagination support for large result sets

## Prerequisites

- Node.js (v14 or later recommended)
- npm (usually comes with Node.js)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/stormidb-explorer.git
   cd stormidb-explorer
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Running the Application

To start the application, run:

```
npm start
```

## Usage

1. **Managing Connections**:
   - Enter a connection name and connection string in the provided fields.
   - Click "Save Connection" to store the connection.
   - Use the dropdown to select saved connections.
   - Click "Delete" to remove a saved connection.

2. **Connecting to a Database**:
   - Select a saved connection or enter a new connection string.
   - Click "Connect to Database" to establish a connection.

3. **Exploring Collections**:
   - Once connected, you'll see a list of collections in the left sidebar.
   - Click on a collection to select it.

4. **Querying Documents**:
   - With a collection selected, enter your query in the JSON editor.
   - Click "Execute Query" to run the query and see results.

5. **Managing Documents**:
   - Use the "Add New Document" button to create new documents.
   - Edit existing documents by clicking the "Edit" button next to a document.
   - Delete documents using the "Delete" button next to a document.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.