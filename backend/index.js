const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { PdfReader } = require('pdfreader');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize the Google Gen AI SDK using your .env key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads/')) {
      fs.mkdirSync('uploads/');
    }
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage: storage });

function chunkText(text, maxLength = 1000, overlap = 200) {
  const chunks = [];
  let currentIndex = 0;
  while (currentIndex < text.length) {
    let chunk = text.substring(currentIndex, currentIndex + maxLength);
    chunks.push(chunk.trim());
    currentIndex += (maxLength - overlap);
  }
  return chunks;
}

const extractTextFromPdf = (filePath) => {
  return new Promise((resolve, reject) => {
    let fullText = '';
    new PdfReader().parseFileItems(filePath, (err, item) => {
      if (err) reject(err);
      else if (!item) resolve(fullText);
      else if (item.text) fullText += item.text + ' ';
    });
  });
};

app.get('/api/health', (req, res) => {
  res.json({ status: "Server is running perfectly!" });
});

/**
 * CORE PIPELINE TASK: Upload, Parse, Chunk, and EMBED
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    console.log(`\n--- Starting Pipeline for: ${req.file.originalname} ---`);

    // 1 & 2. Extract Text
    const rawText = await extractTextFromPdf(req.file.path);
    if (!rawText || rawText.trim().length === 0) {
      throw new Error("Could not extract any readable text from this PDF.");
    }

    // 3. Chunk Text
    const textChunks = chunkText(rawText, 1000, 200);
    console.log(`[Success] Generated ${textChunks.length} text chunks.`);

    // 4. Generate Embeddings via Gemini API
    console.log("Sending chunks to Gemini Embedding Engine...");
    
    const sampleChunk = textChunks[0];
    
    // We use 'gemini-embedding-2' which is optimized for the new GenAI SDK
    const embeddingResponse = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: sampleChunk,
    });

    // Extract values safely from the array response structure
    const vector = embeddingResponse.embeddings[0].values;
    console.log(`[Success] Received embedding vector for Chunk #1!`);
    console.log(`Vector Dimensions: ${vector.length} numbers (e.g., [${vector.slice(0, 3)}...])`);

    res.json({
      message: "File processed and vector embeddings calculated successfully!",
      filename: req.file.originalname,
      totalChunks: textChunks.length,
      vectorDimensions: vector.length,
      sampleVectorPreview: vector.slice(0, 5),
      chunksPreview: textChunks.slice(0, 2)
    });
    
  } catch (error) {
    console.error("Pipeline Error:", error);
    res.status(500).json({ error: `Failed to process document: ${error.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Memora core engine running on http://localhost:${PORT}`);
});