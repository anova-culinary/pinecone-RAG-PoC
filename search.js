import { Pinecone } from '@pinecone-database/pinecone'
import 'dotenv/config'

const API_KEY = process.env.PINECONE_API_KEY
const INDEX_NAME = process.env.PINECONE_INDEX_NAME
const INDEX_HOST = process.env.PINECONE_INDEX_HOST
const NAMESPACE = process.env.PINECONE_NAMESPACE
const EMBEDDING_MODEL = process.env.PINECONE_EMBEDDING_MODEL

const pinecone = new Pinecone({ apiKey: API_KEY })
const index = pinecone.index(INDEX_NAME, INDEX_HOST).namespace(NAMESPACE)

const userPrompt = process.argv[2] || "What are the health benefits of eating apples?"
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
    // The embedResponse is an array take the first element as our query vector
    const sparseEmbedding = embedResponse[0]
    // sparseEmbedding should contain the sparse vector representation (indices and values)

    // 2. Query the Pinecone index with the embedded prompt to get top relevant documents
    const queryRequest = {
      topK: 5,                 // number of top matches to retrieve
      includeMetadata: true,   // include metadata (e.g., text) of the matches
      namespace: NAMESPACE,    // optional namespace if used
      sparseVector: sparseEmbedding  // use the sparse embedding for the query
    }
    const queryResponse = await index.query({ queryRequest })
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
    // Construct the final prompt with context prepended
    const finalPrompt = `${contextSection}Question: ${userPrompt}\nAnswer:`

    // Output the final prompt (this would be sent to the LLM for answer generation)
    console.log("Final Prompt for LLM:\n", finalPrompt)
  } catch (err) {
    console.error("Error during RAG prompt construction:", err)
  }
})()
