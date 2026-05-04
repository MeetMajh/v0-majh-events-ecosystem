"use client";

import { useState } from "react";

export default function Architect() {
  const [task, setTask] = useState("");
  const [result, setResult] = useState("");

  const run = async () => {
    const res = await fetch("/api/ai/run", {
      method: "POST",
      body: JSON.stringify({ task })
    });

    const data = await res.json();
    setResult(JSON.stringify(data.result, null, 2));
  };

  return (
    <div className="p-6">
      <h1>Architect OS</h1>

      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        className="w-full h-40 border"
      />

      <button onClick={run}>Run</button>

      <pre>{result}</pre>
    </div>
  );
}
