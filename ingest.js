import { Pinecone } from '@pinecone-database/pinecone'
import fs from 'fs';
import pdf from 'pdf-parse';  // PDF text extraction library:contentReference[oaicite:11]{index=11}

const API_KEY = "***REMOVED***"
const INDEX_NAME = "anova"
const INDEX_HOST = "https://anova-p8tdr5l.svc.aped-4627-b74a.pinecone.io"
const NAMESPACE = "oven"
const EMBEDDING_MODEL = 'pinecone-sparse-english-v0'

const pinecone = new Pinecone({ apiKey: API_KEY })
const index = pinecone.index(INDEX_NAME, INDEX_HOST).namespace(NAMESPACE);

const pdfPath = process.argv[2];
if (!fs.existsSync(pdfPath)) {
    console.error(`PDF file not found: ${pdfPath}`);
    process.exit(1);
}

try {
    // Read PDF file into a buffer
    const pdfBuffer = fs.readFileSync(pdfPath);
    // Parse PDF to extract text and metadata
    const data = await pdf(pdfBuffer);
    const numPages = data.numpages || 0;
    const fullText = data.text || "";
    console.log(`PDF loaded: ${numPages} pages. Extracting and chunking text...`);

    // Split text into chunks by empty lines (paragraphs/sections)
    const rawChunks = fullText
        .split(/\r?\n\s*\n/)    // split on blank lines (handles Windows/Linux newlines)
        .map(chunk => chunk.trim())   // trim whitespace around each chunk
        .filter(chunk => chunk.length > 0);  // remove any empty results

    // If needed, further split chunks that are excessively long (edge case for very large paragraphs)
    const chunks = [];
    const MAX_WORDS = 500;  // threshold to split long chunks (approx ~512 tokens)
    rawChunks.forEach(origChunk => {
        const words = origChunk.split(/\s+/);
        if (words.length > MAX_WORDS) {
            // If too long, split into two smaller chunks (at nearest sentence boundary if possible)
            const mid = Math.floor(words.length / 2);
            let splitIndex = mid;
            for (let i = mid; i < words.length; i++) {
                if (words[i].endsWith('.') || words[i].endsWith('?') || words[i].endsWith('!')) {
                    splitIndex = i + 1;
                    break;
                }
            }
            const chunkA = words.slice(0, splitIndex).join(' ');
            const chunkB = words.slice(splitIndex).join(' ');
            if (chunkA.trim().length > 0) chunks.push(chunkA.trim());
            if (chunkB.trim().length > 0) chunks.push(chunkB.trim());
        } else {
            chunks.push(origChunk);
        }
    });

    let chunkCount = 0;
    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
        const textChunk = chunks[i];
        // Determine page number for this chunk (simple heuristic: distribute chunks evenly or track via content)
        // For simplicity, we approximate page number based on chunk index and total pages.
        // (For accurate page tracking, use a PDF parser that preserves page breaks:contentReference[oaicite:13]{index=13}.)
        const pageNum = numPages > 0 ? Math.min(numPages, Math.floor((i / chunks.length) * numPages) + 1) : null;

        // Skip empty chunk if any (shouldn't happen after filtering)
        if (!textChunk || textChunk.trim() === "") continue;

        // Generate a unique ID for the vector (could be based on page and index)
        const vectorId = `page${pageNum || 'X'}-chunk${i}`;

        try {
            // Request sparse vector embedding from Pinecone Inference API
            const embedParams = { inputType: 'passage', truncate: 'END' };  // 'passage' for document text:contentReference[oaicite:14]{index=14}:contentReference[oaicite:15]{index=15}
            const embedResponse = await pinecone.inference.embed(EMBEDDING_MODEL, [textChunk], embedParams);
            if (!embedResponse) {
                console.warn(`Embedding failed for chunk ${i} (page ${pageNum}). Skipping...`);
                continue;
            }
            // Embedding response received

            // Pinecone returns the embedding. Extract sparse indices and values.
            // Need to extract values from data[0] based on the actual response structure
            if (!embedResponse.data || !embedResponse.data[0]) {
                console.warn(`No data field in embedding response for chunk ${i}. Skipping...`);
                continue;
            }

            const embedResult = embedResponse.data[0];
            const sparseIndices = embedResult.sparseIndices;
            const sparseValues = embedResult.sparseValues;

            if (!sparseIndices || !sparseValues) {
                console.warn(`No sparse vector data for chunk ${i}. Skipping...`);
                continue;
            }

            // Create record with sparse vector and metadata
            const record = {
                id: vectorId,
                values: [],  // no dense values since we're using a sparse-only vector
                sparseValues: { indices: sparseIndices, values: sparseValues },
                metadata: {
                    page: pageNum,
                    chunk: i,
                    text: textChunk
                }
            };
            vectors.push(record);
            chunkCount++;
        } catch (err) {
            console.error(`Error embedding chunk ${i} (page ${pageNum}):`, err);
            // Continue to next chunk on error
            continue;
        }
    }

    // Upsert all vectors in one batch (if any vectors were prepared)
    if (vectors.length > 0) {
        try {
            await index.upsert(vectors);
            console.log(`Successfully upserted ${vectors.length} vectors to Pinecone index "anova" (namespace "oven").`);
        } catch (upsertErr) {
            console.error("Failed to upsert vectors to Pinecone:", upsertErr);
        }
    } else {
        console.log("No vectors to upsert (no content extracted or all chunks empty).");
    }

} catch (error) {
    console.error("Unexpected error processing PDF:", error);
}
