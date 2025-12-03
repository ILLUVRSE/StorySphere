"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { BACKEND_URL } from '../lib/config';

interface ScriptViewerProps {
  jobId: string;
  onClose: () => void;
}

interface Scene {
  id: number;
  description: string;
  duration: number;
  camera: string;
}

interface Script {
  title: string;
  scenes: Scene[];
}

export default function ScriptViewer({ jobId, onClose }: ScriptViewerProps) {
  const [script, setScript] = React.useState<Script | null>(null);
  const [rawJson, setRawJson] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [regenerating, setRegenerating] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    async function fetchScript() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/jobs/${jobId}/script`);
        if (!res.ok) {
          throw new Error('Script not found or failed to load');
        }
        const data = await res.json();
        setScript(data);
        setRawJson(JSON.stringify(data, null, 2));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchScript();
  }, [jobId, BACKEND_URL]);

  const handleDownload = () => {
    const blob = new Blob([rawJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${jobId}-script.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawJson);
    alert('Copied to clipboard');
  };

  const handleRegenerate = async () => {
    if (!confirm('Are you sure you want to regenerate this job? This will create a new job with the same parameters.')) return;

    setRegenerating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/jobs/${jobId}/regenerate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to regenerate');
      const data = await res.json();
      router.push(`/jobs/${data.jobId}`);
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setRegenerating(false);
    }
  };

  if (!loading && error) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-lg w-full text-black dark:text-white">
                <h3 className="text-xl font-bold mb-4 text-red-500">Error</h3>
                <p>{error}</p>
                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">Close</button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-serif font-bold">Script Viewer</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-3xl leading-none">&times;</button>
        </div>

        {loading ? (
            <div className="p-10 text-center">Loading script...</div>
        ) : (
            <div className="flex-1 overflow-auto pr-2">
                <div className="mb-6 flex gap-2 flex-wrap">
                    <button onClick={handleDownload} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Download JSON</button>
                    <button onClick={handleCopy} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm">Copy Raw</button>
                    <button onClick={handleRegenerate} disabled={regenerating} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50">
                        {regenerating ? 'Regenerating...' : 'Regenerate Job'}
                    </button>
                </div>

                {script && (
                    <div className="mb-6">
                        <h3 className="text-xl font-bold mb-2">{script.title}</h3>
                        <div className="space-y-4">
                            {script.scenes && script.scenes.map((scene, idx) => (
                                <div key={idx} className="border border-gray-200 dark:border-gray-700 p-3 rounded bg-gray-50 dark:bg-gray-800/50">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold text-teal-700 dark:text-teal-400">Scene {scene.id}</span>
                                        <span className="text-xs text-gray-500">{scene.duration}s</span>
                                    </div>
                                    <p className="text-sm mb-2">{scene.description}</p>
                                    <div className="text-xs text-gray-500 italic">Camera: {scene.camera}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <details>
                    <summary className="cursor-pointer font-medium mb-2 text-gray-600 dark:text-gray-400 hover:text-teal-600 select-none">Show Raw JSON</summary>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-xs overflow-auto max-h-60 border border-gray-200 dark:border-gray-700">
                        {rawJson}
                    </pre>
                </details>
            </div>
        )}

        <div className="mt-6 flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
             <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">Close</button>
        </div>
      </div>
    </div>
  );
}
