import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { Plus, ArrowLeft, Search } from 'lucide-react';

export default function CategoryView() {
  const { category } = useParams();
  const [entries, setEntries] = useState([]);
  const [schema, setSchema] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/vault/entries/${category}`),
      api.get(`/vault/categories/${category}/schema`),
    ]).then(([entRes, schemaRes]) => {
      setEntries(entRes.data.entries);
      setSchema(schemaRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [category]);

  const filtered = entries.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-gray-200 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-2xl font-bold text-gray-900">{schema?.label || category}</h1>
          <span className="text-sm text-gray-400">({entries.length} entries)</span>
        </div>
        <Link to={`/category/${category}/new`}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> Add Entry
        </Link>
      </div>

      {entries.length > 3 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400 mb-4">No entries yet</p>
          <Link to={`/category/${category}/new`} className="text-emerald-600 font-medium hover:underline">
            Add your first entry →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <Link key={entry.id} to={`/category/${category}/${entry.id}`}
              className="block bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-emerald-200 transition">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{entry.title}</h3>
                <span className="text-xs text-gray-400">{new Date(entry.updated_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
