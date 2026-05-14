import { useState, useEffect } from 'react';
import api from '../services/api';
import { Bell, Check, X, Clock } from 'lucide-react';

export default function AccessRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = () => {
    api.get('/nominees/access-requests').then(res => setRequests(res.data.requests)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(loadRequests, []);

  const respond = async (id, response) => {
    const action = response === 'approve' ? 'approve access' : 'deny access';
    if (!window.confirm(`Are you sure you want to ${action}?`)) return;
    await api.post(`/nominees/access-requests/${id}/respond`, { response });
    loadRequests();
  };

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    denied: 'bg-red-100 text-red-700',
    auto_approved: 'bg-blue-100 text-blue-700',
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Bell className="w-6 h-6 text-emerald-600" /> Access Requests
      </h1>

      {requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No access requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900">{r.nominee_name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status] || 'bg-gray-100'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{r.nominee_email} {r.relationship && `• ${r.relationship}`}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>Requested: {new Date(r.requested_at).toLocaleString()}</span>
                    <span>Expires: {new Date(r.expires_at).toLocaleString()}</span>
                    {r.reminder_count > 0 && <span>Reminders sent: {r.reminder_count}</span>}
                  </div>
                </div>

                {r.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => respond(r.id, 'approve')}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700">
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button onClick={() => respond(r.id, 'deny')}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50">
                      <X className="w-4 h-4" /> Deny
                    </button>
                  </div>
                )}
              </div>

              {r.status === 'pending' && (
                <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  <Clock className="w-4 h-4" />
                  Auto-approve in {Math.max(0, Math.ceil((new Date(r.expires_at) - Date.now()) / (1000 * 60 * 60 * 24)))} days if no response
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
