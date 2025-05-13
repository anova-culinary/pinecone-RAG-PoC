import { Pinecone } from '@pinecone-database/pinecone'
import 'dotenv/config'
import axios from 'axios'
import readlineSync from 'readline-sync'

const API_KEY = process.env.PINECONE_API_KEY
const INDEX_NAME = process.env.PINECONE_INDEX_NAME
const INDEX_HOST = process.env.PINECONE_INDEX_HOST
const NAMESPACE = process.env.PINECONE_NAMESPACE
const EMBEDDING_MODEL = process.env.PINECONE_EMBEDDING_MODEL
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const pinecone = new Pinecone({ apiKey: API_KEY })
const index = pinecone.index(INDEX_NAME, INDEX_HOST).namespace(NAMESPACE)

async function performSearch(userPrompt) {
  try {
    // 1. Generate sparse embedding for the query (input_type "query")
    const embedResponse = await pinecone.inference.embed(
      EMBEDDING_MODEL,
      [userPrompt],
      { inputType: "query" }
    )

    // Get the first element from the data array in the response
    const embedResult = embedResponse.data[0]

    // 2. Query the Pinecone index with the embedded prompt
    const queryOptions = {
      topK: 5,                 // number of top matches to retrieve
      includeMetadata: true,   // include metadata (e.g., text) of the matches
    };

    // Add sparseVector from the embedding response
    if (embedResult && embedResult.sparseIndices && embedResult.sparseValues) {
      queryOptions.sparseVector = {
        indices: embedResult.sparseIndices,
        values: embedResult.sparseValues
      };
    }

    const queryResponse = await index.query(queryOptions);
    const matches = queryResponse.matches ?? []

    // 3. Extract contextual data from top matches
    const contextSnippets = matches.map((match, i) => {
      // Assume each match's metadata contains a 'text' field with the document content or excerpt
      const text = match.metadata?.text
      return text ? `${i+1}. ${text}` : null
    }).filter(Boolean) // filter out any nulls in case of missing text

    // 4. Integrate the context snippets into the original prompt
    let contextSection = ""
    if (contextSnippets.length > 0) {
      contextSection = "\nRetrieved Context:\n\n" + contextSnippets.join("\n") + "\n\n"
    }

    console.log(contextSection)
    console.log("↑ Added context pulled from Anova documents ↑\n")

    console.log("Your question:\n", "  " + userPrompt, "\n")

    // Pause and wait for user to press Enter
    readlineSync.question('Press Enter to continue and generate answer from Claude...');

    console.log("\nGenerating final answer from Claude AI...")

    // Construct the final prompt with context prepended
    const finalPrompt = `${contextSection}Question: ${userPrompt}`

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

    // Extract the Claude's response
    const finalAnswer = claudeResponse.data.content[0].text;

    console.log("\n-----------------------")
    console.log("Final Generated Answer:")
    console.log("-----------------------\n")

    console.log(finalAnswer, "\n")
    console.log("-----------------------")

  } catch (err) {
    console.error("Error during RAG prompt construction:", err)
  }
}

async function startInteractiveSearch() {
  let continueSearching = true;

  while (continueSearching) {
    // Get user's question
    const userPrompt = readlineSync.question('\nEnter your question (or type "exit" to quit): ');

    // Check if user wants to exit
    if (userPrompt.toLowerCase() === 'exit') {
      continueSearching = false;
      break;
    }

    // Perform the search with the user's question
    await performSearch(userPrompt);

    // Ask if user wants to search again
    const continueResponse = readlineSync.question('\nDo you want to ask another question? (y/n): ');
    continueSearching = continueResponse.toLowerCase() === 'y' || continueResponse.toLowerCase() === 'yes';
  }
}

// Start the interactive search
startInteractiveSearch();