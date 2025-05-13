import express from 'express';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = process.env.PINECONE_INDEX_NAME;
const INDEX_HOST = process.env.PINECONE_INDEX_HOST;
const NAMESPACE = process.env.PINECONE_NAMESPACE;
const EMBEDDING_MODEL = process.env.PINECONE_EMBEDDING_MODEL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Initialize Pinecone
const pinecone = new Pinecone({ apiKey: API_KEY });
const index = pinecone.index(INDEX_NAME, INDEX_HOST).namespace(NAMESPACE);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to handle search
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // 1. Generate sparse embedding for the query
    const embedResponse = await pinecone.inference.embed(
      EMBEDDING_MODEL,
      [query],
      { inputType: "query" }
    );

    // Get the first element from the data array in the response
    const embedResult = embedResponse.data[0];

    // 2. Query the Pinecone index with the embedded prompt
    const queryOptions = {
      topK: 5,
      includeMetadata: true,
    };

    // Add sparseVector from the embedding response
    if (embedResult && embedResult.sparseIndices && embedResult.sparseValues) {
      queryOptions.sparseVector = {
        indices: embedResult.sparseIndices,
        values: embedResult.sparseValues
      };
    }

    const queryResponse = await index.query(queryOptions);
    const matches = queryResponse.matches ?? [];

    // 3. Extract contextual data from top matches
    const contextSnippets = matches.map((match, i) => {
      const text = match.metadata?.text;
      return text ? { id: i + 1, text } : null;
    }).filter(Boolean);

    return res.json({ contexts: contextSnippets });
  } catch (error) {
    console.error('Error during search:', error);
    return res.status(500).json({ error: 'An error occurred during search' });
  }
});

// API endpoint to generate answers with Claude
app.post('/api/generate-answer', async (req, res) => {
  try {
    const { query, contexts } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // 4. Integrate the context snippets into the original prompt
    let contextSection = "";
    if (contexts && contexts.length > 0) {
      contextSection = "Retrieved Context:\n\n" + 
        contexts.map(ctx => `${ctx.id}. ${ctx.text}`).join("\n") + 
        "\n\n";
    }

    // Construct the final prompt with context prepended
    const finalPrompt = `${contextSection}Question: ${query}`;

    // 5. Send the final prompt to the LLM (Anthropic API)
    const claudeResponse = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: finalPrompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    // Extract Claude's response
    const finalAnswer = claudeResponse.data.content[0].text;

    return res.json({ answer: finalAnswer });
  } catch (error) {
    console.error('Error generating answer:', error);
    return res.status(500).json({ error: 'An error occurred while generating the answer' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});