'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime } from '@/lib/utils';

interface AdminNote {
  id: number;
  entity_type: string;
  entity_id: string;
  note: string;
  admin_id: string;
  created_at: string;
}

interface AdminNotesSectionProps {
  entityType: string;
  entityId: string;
  existingNotes: AdminNote[];
}

export function AdminNotesSection({ entityType, entityId, existingNotes }: AdminNotesSectionProps) {
  const router = useRouter();
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          note: newNote.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add note');
      }

      setNewNote('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-card p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Internal Admin Notes</h2>
      
      {/* Add Note Form */}
      <form onSubmit={handleAddNote} className="mb-4">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note... (append-only)"
          className="admin-input mb-2"
          rows={3}
        />
        {error && (
          <div className="text-red-400 text-sm mb-2">{error}</div>
        )}
        <button 
          type="submit" 
          disabled={loading || !newNote.trim()}
          className="admin-btn admin-btn-primary"
        >
          {loading ? 'Adding...' : 'Add Note'}
        </button>
      </form>

      {/* Existing Notes */}
      <div className="space-y-3">
        {existingNotes.length === 0 ? (
          <p className="text-sm text-gray-500">No notes yet.</p>
        ) : (
          existingNotes.map((note) => (
            <div key={note.id} className="bg-gray-800/50 rounded p-3">
              <p className="text-sm whitespace-pre-wrap">{note.note}</p>
              <div className="mt-2 text-xs text-gray-500">
                {note.admin_id} &middot; {formatDateTime(note.created_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
