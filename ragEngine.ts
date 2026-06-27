export interface DocumentChunk {
  id: string;
  docId: string;
  fileName: string;
  pageNumber: number;
  text: string;
  embedding?: number[];
}

export type APIProvider = 'nvidia' | 'gemini';

export interface APIConfig {
  provider: APIProvider;
  apiKey: string;
  chatModel: string;
  embedModel: string;
}

export const PROVIDER_DEFAULTS: Record<APIProvider, { chatModel: string; embedModel: string; baseUrl: string }> = {
  nvidia: {
    chatModel: 'meta/llama-3.3-70b-instruct',
    embedModel: 'nvidia/llama-nemotron-embed-1b-v2',
    baseUrl: '/api-nvidia/v1',
  },
  gemini: {
    chatModel: 'gemini-2.5-flash',
    embedModel: 'text-embedding-004',
    baseUrl: '/api-gemini',
  },
};

// Chunk text into overlapping windows
export function chunkText(
  text: string, 
  fileName: string, 
  docId: string, 
  pageNumber: number,
  chunkSize = 800, 
  overlap = 200
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  if (!text) return chunks;

  let startIndex = 0;
  let chunkCount = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    let chunkText = text.substring(startIndex, endIndex);
    
    // Add page details to the chunk
    chunks.push({
      id: `${docId}-ch-${chunkCount++}`,
      docId,
      fileName,
      pageNumber,
      text: chunkText
    });

    startIndex += (chunkSize - overlap);
  }

  return chunks;
}

// Simple cosine similarity between two vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Stop words for local keyword search fallback
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cant', 'cannot', 'could', 'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have',
  'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here', 'heres', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is', 'isnt',
  'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'shannt', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such',
  'than', 'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres',
  'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent',
  'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which', 'while', 'who', 'whos', 'whom',
  'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve',
  'your', 'yours', 'yourself', 'yourselves'
]);

// Simple keyword search fallback (term frequency overlap)
export function keywordSearch(query: string, chunks: DocumentChunk[], topK = 4): DocumentChunk[] {
  const queryTerms = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(term => term.length > 2 && !STOP_WORDS.has(term));

  if (queryTerms.length === 0) {
    // If no searchable terms, just return first K
    return chunks.slice(0, topK);
  }

  const scoredChunks = chunks.map(chunk => {
    const chunkTextLower = chunk.text.toLowerCase();
    let score = 0;
    
    queryTerms.forEach(term => {
      // Calculate how many times term appears in the chunk
      const regex = new RegExp('\\b' + term + '\\b', 'g');
      const matches = chunkTextLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    });

    return { chunk, score };
  });

  return scoredChunks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => item.chunk);
}

// Generate embeddings via Nvidia API
async function getNvidiaEmbeddings(texts: string[], config: APIConfig): Promise<number[][]> {
  const response = await fetch(`${PROVIDER_DEFAULTS.nvidia.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.embedModel || PROVIDER_DEFAULTS.nvidia.embedModel,
      input: texts,
      input_type: 'passage', // Default for documents
      encoding_format: 'float'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Nvidia embedding error: ${response.status} - ${errText}`);
  }

  const json = await response.json();
  return json.data.map((item: any) => item.embedding);
}

// Generate query embedding via Nvidia API
async function getNvidiaQueryEmbedding(text: string, config: APIConfig): Promise<number[]> {
  const response = await fetch(`${PROVIDER_DEFAULTS.nvidia.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.embedModel || PROVIDER_DEFAULTS.nvidia.embedModel,
      input: [text],
      input_type: 'query', // Specific for search query
      encoding_format: 'float'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Nvidia query embedding error: ${response.status} - ${errText}`);
  }

  const json = await response.json();
  return json.data[0].embedding;
}

// Generate embeddings via Gemini API
async function getGeminiEmbeddings(texts: string[], config: APIConfig): Promise<number[][]> {
  const model = config.embedModel || PROVIDER_DEFAULTS.gemini.embedModel;

  // Since Gemini requires batching or individual calls, we do them in chunks
  // or a batch request to batchEmbedContents
  const requests = texts.map(text => ({
    model: `models/${model}`,
    content: { parts: [{ text }] }
  }));

  const response = await fetch(`${PROVIDER_DEFAULTS.gemini.baseUrl}/v1beta/models/${model}:batchEmbedContents?key=${config.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini embedding error: ${response.status} - ${errText}`);
  }

  const json = await response.json();
  return json.embeddings.map((item: any) => item.values);
}

// Generate query embedding via Gemini API
async function getGeminiQueryEmbedding(text: string, config: APIConfig): Promise<number[]> {
  const model = config.embedModel || PROVIDER_DEFAULTS.gemini.embedModel;
  const response = await fetch(`${PROVIDER_DEFAULTS.gemini.baseUrl}/v1beta/models/${model}:embedContent?key=${config.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini query embedding error: ${response.status} - ${errText}`);
  }

  const json = await response.json();
  return json.embedding.values;
}

// Generate embeddings for document chunks
export async function embedChunks(
  chunks: DocumentChunk[], 
  config: APIConfig,
  onProgress?: (index: number, total: number) => void
): Promise<DocumentChunk[]> {
  if (chunks.length === 0) return [];
  
  // Embed in batches to prevent API rate limits or payload constraints
  const batchSize = config.provider === 'nvidia' ? 16 : 8; // Nvidia allows larger batches usually
  const embeddedChunks: DocumentChunk[] = [...chunks];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.text);
    
    try {
      let embeddings: number[][] = [];
      if (config.provider === 'nvidia') {
        embeddings = await getNvidiaEmbeddings(texts, config);
      } else {
        embeddings = await getGeminiEmbeddings(texts, config);
      }

      for (let j = 0; j < batch.length; j++) {
        embeddedChunks[i + j].embedding = embeddings[j];
      }

      if (onProgress) {
        onProgress(Math.min(i + batchSize, chunks.length), chunks.length);
      }
    } catch (error) {
      console.error(`Error embedding batch ${i}:`, error);
      throw error;
    }
  }

  return embeddedChunks;
}

// Retrieve relevant chunks for a query
export async function retrieveRelevantChunks(
  query: string, 
  chunks: DocumentChunk[], 
  config: APIConfig | null, 
  topK = 4
): Promise<DocumentChunk[]> {
  // If no config or no API key, fallback to local keyword search
  if (!config || !config.apiKey || chunks.length === 0 || !chunks[0].embedding) {
    return keywordSearch(query, chunks, topK);
  }

  try {
    let queryEmbedding: number[] = [];
    if (config.provider === 'nvidia') {
      queryEmbedding = await getNvidiaQueryEmbedding(query, config);
    } else {
      queryEmbedding = await getGeminiQueryEmbedding(query, config);
    }

    // Compute similarity scores
    const scoredChunks = chunks.map(chunk => {
      let score = 0;
      if (chunk.embedding) {
        score = cosineSimilarity(queryEmbedding, chunk.embedding);
      }
      return { chunk, score };
    });

    // Sort by score descending and take top K
    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => item.chunk);
  } catch (error) {
    console.warn("Embedding search failed, falling back to keyword search:", error);
    return keywordSearch(query, chunks, topK);
  }
}

// Call chat model for response generation
export async function generateRAGAnswer(
  query: string, 
  contextChunks: DocumentChunk[], 
  config: APIConfig,
  chatHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<string> {
  if (!config || !config.apiKey) {
    throw new Error("API Key is required to ask questions.");
  }

  // Format context for LLM
  const contextString = contextChunks.map((chunk, idx) => {
    return `[Source ${idx + 1}] (File: ${chunk.fileName}, Page: ${chunk.pageNumber}):\n"${chunk.text}"`;
  }).join('\n\n---\n\n');

  const systemPrompt = `You are an elegant and precise PDF Research Assistant. 
You will be provided with context snippets retrieved from documents uploaded by the user.
Your job is to answer the user's question accurately using ONLY the provided document context.

CRITICAL INSTRUCTIONS:
1. Ground every statement in the provided context. If a fact comes from a source, you MUST cite it using the format [Source X] at the end of the sentence or clause (e.g. "[Source 1]" or "[Source 2]").
2. Do not combine citations (e.g. write "[Source 1] [Source 2]" rather than "[Source 1, 2]" or "[Source 1-2]").
3. If the context does not contain enough information to answer the question, politely explain that you cannot answer based on the uploaded documents. Do not make up information or use external knowledge.
4. Output your answer using clean Markdown. Use headers, bolding, lists, and tables where appropriate to present a classy, structured response.

Retrieved Document Context:
${contextString || "[No documents uploaded or no matching context found]"}
`;

  if (config.provider === 'nvidia') {
    const model = config.chatModel || PROVIDER_DEFAULTS.nvidia.chatModel;
    
    // Format history for OpenAI format
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: query }
    ];

    const response = await fetch(`${PROVIDER_DEFAULTS.nvidia.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Nvidia chat error: ${response.status} - ${errText}`);
    }

    const json = await response.json();
    return json.choices[0].message.content;
  } else {
    // Gemini API structure
    const model = config.chatModel || PROVIDER_DEFAULTS.gemini.chatModel;
    
    // For Gemini, we combine system prompt + history + current query into contents
    // Gemini 1.5+ supports systemInstructions as a top-level parameter
    const contents = [
      ...chatHistory.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      })),
      { role: 'user', parts: [{ text: query }] }
    ];

    const response = await fetch(`${PROVIDER_DEFAULTS.gemini.baseUrl}/v1beta/models/${model}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini chat error: ${response.status} - ${errText}`);
    }

    const json = await response.json();
    return json.candidates[0].content.parts[0].text;
  }
}
