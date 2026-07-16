const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { PdfReader } = require('pdfreader');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const VAULT_FILE = 'vector_vault.json';

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads/')) fs.mkdirSync('uploads/');
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

// Helper to read/write to our local database file
function saveToVault(newRecords) {
  let currentVault = [];
  if (fs.existsSync(VAULT_FILE)) {
    try {
      currentVault = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf-8'));
    } catch (e) {
      currentVault = [];
    }
  }
  const updatedVault = [...currentVault, ...newRecords];
  fs.writeFileSync(VAULT_FILE, JSON.stringify(updatedVault, null, 2));
}

app.get('/api/health', (req, res) => {
  res.json({ status: "Server is running perfectly!" });
});

/**
 * CORE PIPELINE TASK: Upload, Parse, Chunk, Embed, and SAVE to Database
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    console.log(`\n--- Ingestion Pipeline Active: ${req.file.originalname} ---`);

    const rawText = await extractTextFromPdf(req.file.path);
    if (!rawText || rawText.trim().length === 0) {
      throw new Error("Could not extract any readable text from this PDF.");
    }

    const textChunks = chunkText(rawText, 1000, 200);
    console.log(`[1/3] Sliced text into ${textChunks.length} chunks.`);

    console.log("[2/3] Generating embeddings via Gemini API...");
    const databaseRecords = [];

    // Loop through ALL chunks and generate a vector for each one
    // We add a tiny delay to respect free-tier rate limits gracefully
    for (let i = 0; i < textChunks.length; i++) {
      const chunkTextData = textChunks[i];
      
      const embeddingResponse = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: chunkTextData,
      });

      const vector = embeddingResponse.embeddings[0].values;

      // Pack the text, the vector numbers, and the metadata together
      databaseRecords.push({
        id: `${Date.now()}-${i}`,
        filename: req.file.originalname,
        chunkIndex: i,
        text: chunkTextData,
        embedding: vector
      });

      // Simple artificial delay to avoid hammering the free tier api limits too quickly
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[3/3] Committing ${databaseRecords.length} records to local vector vault...`);
    saveToVault(databaseRecords);

    res.json({
      message: "File completely ingested and committed to vector database storage!",
      filename: req.file.originalname,
      totalChunks: textChunks.length,
      savedStatus: true,
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