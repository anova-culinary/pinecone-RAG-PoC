import { Pinecone } from '@pinecone-database/pinecone'
import 'dotenv/config'
import axios from 'axios'

const API_KEY = process.env.PINECONE_API_KEY
const INDEX_NAME = process.env.PINECONE_INDEX_NAME
const INDEX_HOST = process.env.PINECONE_INDEX_HOST
const NAMESPACE = process.env.PINECONE_NAMESPACE
const EMBEDDING_MODEL = process.env.PINECONE_EMBEDDING_MODEL
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const pinecone = new Pinecone({ apiKey: API_KEY })
const index = pinecone.index(INDEX_NAME, INDEX_HOST).namespace(NAMESPACE)

const userPrompt = process.argv[2] || "How to cook with steam?"
if (!userPrompt) {
  console.error('No user prompt provided.')
  process.exit(1)
}

(async () => {
  try {
    // 1. Generate sparse embedding for the query (input_type "query")
    const embedResponse = await pinecone.inference.embed(
      EMBEDDING_MODEL,
      [userPrompt],
      { inputType: "query" }
    )
    // Log the structure of the embedding response to understand the format
    // console.log('Embedding Response:', JSON.stringify(embedResponse, null, 2))

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

    // console.log('Query options:', JSON.stringify(queryOptions, null, 2));
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
      contextSection = "Context:\n" + contextSnippets.join("\n") + "\n\n"
    }

    console.log(contextSection)
    console.log("↑ Added context pulled from Anova documents ↑\n")

    console.log("User's question:\n", userPrompt, "\n")

    console.log("Generating final answer from Claude AI...")

    // Construct the final prompt with context prepended
    const finalPrompt = `${contextSection}Question: ${userPrompt}`

    // Output the final prompt (this would be sent to the LLM for answer generation)
    // console.log("Final Prompt for LLM:\n", finalPrompt, "\n")

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
    console.log("\nFinal Generated Answer:\n", finalAnswer, "\n")

  } catch (err) {
    console.error("Error during RAG prompt construction:", err)
  }
})()