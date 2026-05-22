'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Save, Trash2, Key, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

type KeyObj = {
  id: string;
  provider: 'gemini' | 'openai' | 'anthropic';
  name: string;
  key: string;
};

export default function SettingsPage() {
  const [keys, setKeys] = useState<KeyObj[]>([]);
  const [newProvider, setNewProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini');
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    checkAuthAndFetchKeys();
  }, []);

  const checkAuthAndFetchKeys = async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      if (!authRes.ok) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setMessage('');
      } else {
        setMessage('Failed to fetch keys.');
      }
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  };

  const handleAddKey = () => {
    if (newKey.trim() && newName.trim()) {
      setKeys([...keys, {
        id: Math.random().toString(36).substring(7),
        provider: newProvider,
        name: newName.trim(),
        key: newKey.trim()
      }]);
      setNewKey('');
      setNewName('');
    }
  };

  const handleRemoveKey = (idToRemove: string) => {
    setKeys(keys.filter(k => k.id !== idToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
          
          <div className="border-t border-gray-800 pt-6 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Key size={20} className="text-emerald-500" />
              API Key Pool
            </h2>
            
            <div className="space-y-3">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between bg-gray-800 p-3 rounded-xl border border-gray-700">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white flex items-center gap-2">
                       {k.name} <span className="px-2 py-0.5 rounded-full bg-gray-700 text-[10px] text-gray-300 uppercase tracking-wider">{k.provider}</span>
                    </span>
                    <span className="font-mono text-xs text-gray-400">
                      {k.key.substring(0, 15)}...{k.key.substring(k.key.length - 4)}
                    </span>
                  </div>
                  <button onClick={() => handleRemoveKey(k.id)} className="text-red-400 hover:text-red-300 p-1">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              
              {keys.length === 0 && (
                <div className="text-sm text-gray-500 italic py-2">No keys added yet.</div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-gray-800">
              <div className="flex gap-2">
                <select 
                   value={newProvider} 
                   onChange={(e) => setNewProvider(e.target.value as any)}
                   className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-sm"
                >
                   <option value="gemini">Google Gemini</option>
                   <option value="openai">OpenAI (ChatGPT)</option>
                   <option value="anthropic">Anthropic (Claude)</option>
                </select>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Key Name (e.g. 'GPT-4 Paid')"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
                  placeholder="Paste API key..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                />
                <button 
                  onClick={handleAddKey}
                  className="bg-gray-700 hover:bg-gray-600 px-6 rounded-xl font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div className={`text-sm ${message.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>
              {message}
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
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
