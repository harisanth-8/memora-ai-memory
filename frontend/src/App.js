import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a valid PDF file.');
        setFile(null);
        return;
      }
      setError('');
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Direct call to our running Express backend pipeline
      const response = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResult(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to connect to the document pipeline.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 antialiased">
      {/* Header Accent */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
          Memora AI
        </h1>
        <p className="text-sm text-slate-400 mt-2 tracking-wide uppercase">
          Document Ingestion Core Pipeline
        </p>
      </div>

      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <form onSubmit={handleUpload} className="space-y-6">
          {/* Dropzone/Picker */}
          <div className="border-2 border-dashed border-slate-700 hover:border-teal-500 rounded-xl p-8 text-center cursor-pointer transition-colors relative group">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center space-y-3">
              <Upload className="w-10 h-10 text-slate-400 group-hover:text-teal-400 transition-colors" />
              <div className="text-slate-300 font-medium">
                {file ? file.name : 'Select or drag your Semester PDF here'}
              </div>
              <p className="text-xs text-slate-500">Supports standard PDF formats</p>
            </div>
          </div>

          {/* Action Trigger */}
          {file && !loading && (
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-slate-950 font-bold rounded-xl shadow-lg shadow-teal-500/10 active:scale-[0.99] transition-all flex items-center justify-center space-x-2"
            >
              <FileText className="w-5 h-5" />
              <span>Process Document</span>
            </button>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="w-full py-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl flex items-center justify-center space-x-3">
              <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
              <span className="font-medium animate-pulse">Parsing text and calculating semantic chunks...</span>
            </div>
          )}
        </form>

        {/* Dynamic Alerts */}
        {error && (
          <div className="mt-6 flex items-start space-x-3 bg-rose-950/40 border border-rose-800/60 p-4 rounded-xl text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Pipeline Output Showcase */}
        {result && (
          <div className="mt-6 border-t border-slate-800 pt-6 space-y-4 animate-fadeIn">
            <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 p-3 rounded-xl text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>{result.message}</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-400 space-y-2">
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-500">Document ID:</span>
                <span className="text-teal-400 font-bold">{result.filename}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-500">Total Chunks Created:</span>
                <span className="text-cyan-400 font-bold text-sm">{result.totalChunks} Chunks</span>
              </div>
            </div>

            {/* Ingestion Chunk Preview Pane */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-400 tracking-wider uppercase pl-1">
                Ingestion Engine Chunk Preview
              </h3>
              <div className="space-y-3">
                {result.chunksPreview?.map((chunk, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl text-xs leading-relaxed text-slate-300">
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                      Chunk Block #{idx + 1}
                    </div>
                    {chunk}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;