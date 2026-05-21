'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Trash2, Key, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [keys, setKeys] = useState<string[]>([]);
  const [newKey, setNewKey] = useState('');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Only fetch if we have a password, otherwise wait for user to enter it
    if (password) fetchKeys();
  }, [password]);

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${password}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setMessage('');
      } else {
        setMessage('Unauthorized. Please check your admin password.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddKey = () => {
    if (newKey.trim() && !keys.includes(newKey.trim())) {
      setKeys([...keys, newKey.trim()]);
      setNewKey('');
    }
  };

  const handleRemoveKey = (indexToRemove: number) => {
    setKeys(keys.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({ keys }),
      });
      
      if (res.ok) {
        setMessage('Settings saved successfully!');
      } else {
        setMessage('Failed to save. Unauthorized.');
      }
    } catch (e) {
      setMessage('Network error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="text-blue-500" />
            System Settings
          </h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password to view/edit..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-xs text-gray-500">Default is "infinite" unless set in Vercel env vars.</p>
          </div>

          <div className="border-t border-gray-800 pt-6 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Key size={20} className="text-emerald-500" />
              API Key Pool
            </h2>
            
            <div className="space-y-3">
              {keys.map((k, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-800 p-3 rounded-xl border border-gray-700">
                  <div className="font-mono text-sm text-gray-300">
                    {k.substring(0, 15)}...{k.substring(k.length - 4)}
                  </div>
                  <button onClick={() => handleRemoveKey(idx)} className="text-red-400 hover:text-red-300 p-1">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              
              {keys.length === 0 && (
                <div className="text-sm text-gray-500 italic py-2">No keys added yet. System will fallback to ENV vars.</div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
                placeholder="Paste new Gemini API key..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button 
                onClick={handleAddKey}
                className="bg-gray-700 hover:bg-gray-600 px-6 rounded-xl font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div className={`text-sm ${message.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>
              {message}
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || !password}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
