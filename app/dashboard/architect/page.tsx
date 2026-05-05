"use client";

import { useState } from "react";

export default function Architect() {
  const [task, setTask] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/ai/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ task })
      });

      const data = await res.json();
      setResult(JSON.stringify(data.result, null, 2));
    } catch (err) {
      setResult("Error running architect");
    }

    setLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">MAJH Architect OS</h1>

      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="What do you want to build?"
        className="w-full h-40 border p-2 mb-4"
      />

      <button
        onClick={run}
        className="bg-black text-white px-4 py-2"
      >
        {loading ? "Running..." : "Run"}
      </button>

      <pre className="mt-4 bg-gray-100 p-4 whitespace-pre-wrap">
        {result}
      </pre>
    </div>
  );
}
