# Pinecone RAG with Claude

A proof-of-concept application that demonstrates Retrieval-Augmented Generation (RAG) using Pinecone vector database and Claude AI. This version includes both a CLI and a web-based interface.

## Features

- Document ingestion into Pinecone vector database
- Interactive search interface (CLI and web)
- Semantic search using Pinecone sparse vectors
- Integration with Claude AI for generating answers
- Web-based UI for easier interaction

## Setup

1. Clone this repository:
   ```
   git clone https://github.com/anova-culinary/pinecone-claude-rag.git
   cd pinecone-claude-rag
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with your API keys and configuration:
   ```
   cp env-example .env
   ```
   Then edit the `.env` file with your actual API keys and configuration values.

### Environment Variables

This project requires several environment variables to work properly. These are stored in a `.env` file in the root directory. For security reasons, this file is not included in the repository.

A sample `env-example` file is provided with placeholder values. You need to:

1. Create your own `.env` file: `cp env-example .env`
2. Update the values in your `.env` file with your actual credentials:

```
# Pinecone Configuration
PINECONE_API_KEY=           # Your Pinecone API key
PINECONE_INDEX_NAME=        # Name of your Pinecone index
PINECONE_INDEX_HOST=        # Host URL of your Pinecone index
PINECONE_NAMESPACE=         # Optional namespace in your Pinecone index
PINECONE_EMBEDDING_MODEL=   # The embedding model to use (default: sparse+sparse:hkunlp/instructor-base:thenlper/gte-small)

# Anthropic API Configuration
ANTHROPIC_API_KEY=          # Your Anthropic API key for Claude

# Optional: Server Configuration (for web interface)
PORT=3000                   # Port for the web server (default: 3000)
```

#### Getting API Keys

- **Pinecone API Key**: Sign up at [Pinecone](https://www.pinecone.io/) and create an API key from the dashboard.
- **Anthropic API Key**: Sign up for [Anthropic's Claude API](https://www.anthropic.com/api) to get an API key.

## Usage

### Ingest Documents

To ingest PDF documents into the Pinecone vector database:

```
node ingest.js /path/to/your/document.pdf
```

### Search Documents (CLI version)

To search the documents using the command-line interface:

```
node search.js
```

This will start an interactive search interface where you can:
1. Enter your question
2. View retrieved context from Pinecone
3. Press Enter to generate an answer from Claude
4. Choose to ask another question or exit

### Web Interface

To use the web-based interface:

```
npm start
```

This will start the server and you can access the application at `http://localhost:3000` (or the port you specified in your `.env` file).

With the web interface, you can:
1. Enter your question in the text area
2. Click the Search button (or press Enter)
3. View retrieved context on the left side
4. See Claude's generated answer on the right side
5. Ask additional questions as needed

For development with automatic reloading:

```
npm run dev
```

## How It Works

1. **Ingestion (ingest.js)**:
   - Reads PDF documents
   - Splits text into chunks
   - Generates sparse embeddings via Pinecone API
   - Stores embeddings and text in Pinecone

2. **Search**:
   - **CLI (search.js)**:
     - Takes user queries interactively via command line
     - Generates sparse embeddings for the query
     - Retrieves relevant document chunks from Pinecone
     - Sends context and query to Claude
     - Displays the AI-generated answer in the terminal
   
   - **Web Interface (server.js, app.js)**:
     - Provides a user-friendly web interface
     - Handles queries through a REST API
     - Server-side processing to keep API keys secure
     - Displays both context and answers in a clean UI

## Requirements

- Node.js
- Pinecone account with API access
- Claude API access (via Anthropic)
- Modern web browser (for web interface)