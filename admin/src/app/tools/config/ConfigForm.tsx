'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ConfigForm() {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [type, setType] = useState('string');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, type, description }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save config');
      }

      setSuccess(true);
      setKey('');
      setValue('');
      setDescription('');
      router.refresh();

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Key</label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g., feature.grouptabs.enabled"
            className="admin-input"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="admin-input"
          >
            <option value="boolean">Boolean (Feature Flag)</option>
            <option value="string">String (Wizard Copy)</option>
            <option value="json">JSON</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Value</label>
        {type === 'boolean' ? (
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="admin-input"
          >
            <option value="">Select...</option>
            <option value="true">true (enabled)</option>
            <option value="false">false (disabled)</option>
          </select>
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Value"
            className="admin-input"
          />
        )}
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this config control?"
          className="admin-input"
        />
      </div>

      {error && (
        <div className="text-red-400 text-sm">{error}</div>
      )}

      {success && (
        <div className="text-green-400 text-sm">Configuration saved successfully!</div>
      )}

      <button
        type="submit"
        disabled={loading || !key.trim() || !value.trim()}
        className="admin-btn admin-btn-primary"
      >
        {loading ? 'Saving...' : 'Save Configuration'}
      </button>
    </form>
  );
}
