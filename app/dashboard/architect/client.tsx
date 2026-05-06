// app/dashboard/architect/architect-client.tsx
"use client";
import { useState } from "react";

export default function ArchitectClient() {
  const [task, setTask] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(`Error ${res.status}: ${data.error ?? res.statusText}`);
        return;
      }
      setResult(JSON.stringify(data.result ?? data, null, 2));
    } catch (err: any) {
      setResult(`Network error: ${err?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const copyAsMarkdown = async () => {
    if (!result) return;
    const markdown = `# MAJH Architect Output\n\n**Task:** ${task || "(empty)"}\n**Generated:** ${new Date().toISOString()}\n\n\`\`\`json\n${result}\n\`\`\``;
    try {
      await navigator.clipboard.writeText(markdown);
      const btn = document.getElementById("copy-btn");
      if (btn) {
        const original = btn.textContent;
        btn.textContent = "Copied ✓";
        setTimeout(() => { btn.textContent = original; }, 1500);
      }
    } catch {
      alert("Copy failed — select the text manually");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-white">MAJH Architect OS</h1>
      
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="What do you want to know? Try: 'show me the schema', 'show me rls policies', 'count rows', or leave blank for everything"
        className="w-full h-32 border border-gray-700 bg-gray-900 text-gray-100 p-3 mb-4 rounded font-mono text-sm placeholder:text-gray-500"
      />
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={run}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold px-4 py-2 rounded transition"
        >
          {loading ? "Running..." : "Run"}
        </button>
        
        {result && (
          <button
            id="copy-btn"
            onClick={copyAsMarkdown}
            className="bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded transition"
          >
            Copy as Markdown
          </button>
        )}
      </div>

      {result && (
        <pre className="bg-gray-900 text-gray-100 border border-gray-700 p-4 rounded font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-[70vh] overflow-y-auto">
          {result}
        </pre>
      )}
    </div>
  );
}
