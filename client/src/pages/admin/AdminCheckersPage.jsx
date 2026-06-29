import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api, { ensureCsrfToken } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminStatCard from '../../components/admin/AdminStatCard';
import { GraduationCap, Plus, Upload } from 'lucide-react';
import { formatDate } from '../../utils/validation';

const emptyManualForm = {
  checkerType: 'BECE',
  serialNumber: '',
  pin: '',
  year: new Date().getFullYear().toString(),
};

function formatUploadReport(report) {
  if (!report) return 'Upload complete.';
  const parts = [`${report.uploaded ?? 0} added`];
  if (report.duplicatesSkipped) parts.push(`${report.duplicatesSkipped} duplicates skipped`);
  if (report.invalidRows) parts.push(`${report.invalidRows} invalid rows`);
  return parts.join(', ') + '.';
}

export default function AdminCheckersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualForm);

  const invalidateStockQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-checkers'] });
    queryClient.invalidateQueries({ queryKey: ['admin-checker-stats'] });
    queryClient.invalidateQueries({ queryKey: ['packages-all'] });
    queryClient.invalidateQueries({ queryKey: ['packages'] });
    queryClient.invalidateQueries({ queryKey: ['admin-packages'] });
  };

  const { data: stats } = useQuery({
    queryKey: ['admin-checker-stats'],
    queryFn: () => api.get('/admin/checkers/stats').then((r) => r.data.stats),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-checkers', type, status, search],
    queryFn: () =>
      api
        .get('/admin/checkers', {
          params: {
            type: type || undefined,
            status: status || undefined,
            search: search || undefined,
            limit: 50,
          },
        })
        .then((r) => r.data),
  });

  const uploadCheckers = useMutation({
    mutationFn: async (file) => {
      const token = await ensureCsrfToken();
      const formData = new FormData();
      formData.append('file', file);
      const baseURL = api.defaults.baseURL || '/api';
      return axios.post(`${baseURL}/admin/checkers/upload`, formData, {
        withCredentials: true,
        headers: { 'X-CSRF-Token': token, 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res) => {
      invalidateStockQueries();
      const report = res.data.report;
      toast(formatUploadReport(report), report?.uploaded ? 'success' : 'error');
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (err) => toast(err.response?.data?.message || 'Upload failed.', 'error'),
  });

  const addChecker = useMutation({
    mutationFn: (payload) => api.post('/admin/checkers', payload).then((r) => r.data.checker),
    onSuccess: () => {
      invalidateStockQueries();
      setManualForm(emptyManualForm);
      setShowManualForm(false);
      toast('Checker added to stock.', 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Could not add checker.', 'error'),
  });

  const deleteChecker = useMutation({
    mutationFn: (id) => api.delete(`/admin/checkers/${id}`),
    onSuccess: () => {
      invalidateStockQueries();
      toast('Checker removed.', 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Delete failed.', 'error'),
  });

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualForm.serialNumber.trim() || !manualForm.pin.trim() || !manualForm.year.trim()) {
      toast('Serial number, PIN, and year are required.', 'error');
      return;
    }
    addChecker.mutate({
      checkerType: manualForm.checkerType,
      serialNumber: manualForm.serialNumber.trim(),
      pin: manualForm.pin.trim(),
      year: manualForm.year.trim(),
    });
  };

  const checkers = data?.checkers || [];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Results Checkers"
        subtitle="Upload BECE and WASSCE checkers. Stock updates automatically on the website."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminStatCard
          label="BECE In Stock"
          value={stats?.bece?.unused ?? 0}
          icon={GraduationCap}
          tone="emerald"
        />
        <AdminStatCard
          label="WASSCE In Stock"
          value={stats?.wassce?.unused ?? 0}
          icon={GraduationCap}
          tone="blue"
        />
      </div>

      <div className="admin-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900">Upload checker stock</h3>
          <button
            type="button"
            onClick={() => setShowManualForm((v) => !v)}
            className="btn-secondary inline-flex !py-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            {showManualForm ? 'Cancel' : 'Add one manually'}
          </button>
        </div>

        <p className="text-sm text-slate-600">
          Upload an Excel file (.xlsx, .xls) or CSV with columns:{' '}
          <span className="font-semibold">Checker Type</span>,{' '}
          <span className="font-semibold">Serial Number</span>,{' '}
          <span className="font-semibold">PIN</span>,{' '}
          <span className="font-semibold">Year</span>. Checker type must be BECE or WASSCE.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-semibold text-slate-700">Excel / CSV file</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="input-field" />
          </div>
          <button
            type="button"
            disabled={uploadCheckers.isPending}
            onClick={() => {
              const file = fileRef.current?.files?.[0];
              if (!file) {
                toast('Choose a file first.', 'error');
                return;
              }
              uploadCheckers.mutate(file);
            }}
            className="btn-primary inline-flex shrink-0"
          >
            <Upload className="h-4 w-4" />
            {uploadCheckers.isPending ? 'Uploading...' : 'Upload to database'}
          </button>
        </div>

        {showManualForm && (
          <form onSubmit={handleManualSubmit} className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Type</label>
              <select
                className="input-field"
                value={manualForm.checkerType}
                onChange={(e) => setManualForm({ ...manualForm, checkerType: e.target.value })}
              >
                <option value="BECE">BECE</option>
                <option value="WASSCE">WASSCE</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Serial Number</label>
              <input
                className="input-field"
                value={manualForm.serialNumber}
                onChange={(e) => setManualForm({ ...manualForm, serialNumber: e.target.value })}
                placeholder="e.g. BECE2026000001"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">PIN</label>
              <input
                className="input-field"
                value={manualForm.pin}
                onChange={(e) => setManualForm({ ...manualForm, pin: e.target.value })}
                placeholder="PIN"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Year</label>
              <input
                className="input-field"
                value={manualForm.year}
                onChange={(e) => setManualForm({ ...manualForm, year: e.target.value })}
                placeholder="e.g. 2026"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <button type="submit" disabled={addChecker.isPending} className="btn-primary">
                {addChecker.isPending ? 'Saving...' : 'Save checker'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="admin-panel flex flex-wrap gap-3">
        <input
          className="input-field max-w-xs"
          placeholder="Search serial number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input-field max-w-xs" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="BECE">BECE</option>
          <option value="WASSCE">WASSCE</option>
        </select>
        <select className="input-field max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="unused">In stock (unused)</option>
          <option value="used">Used / sold</option>
        </select>
      </div>

      {isLoading && <div className="admin-panel h-40 animate-pulse bg-slate-100" />}
      {isError && <div className="admin-panel text-sm text-red-600">Could not load checkers.</div>}

      {!isLoading && !isError && (
        <div className="admin-panel overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Serial</th>
                <th>PIN</th>
                <th>Year</th>
                <th>Status</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {checkers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No checkers in the database. Upload stock to enable sales.
                  </td>
                </tr>
              ) : (
                checkers.map((checker) => (
                  <tr key={checker._id}>
                    <td className="font-semibold text-slate-900">{checker.checkerType}</td>
                    <td>{checker.serialNumber}</td>
                    <td>{checker.status === 'used' ? '••••••' : checker.pin}</td>
                    <td>{checker.year}</td>
                    <td>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          checker.status === 'unused'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {checker.status === 'unused' ? 'in stock' : 'used'}
                      </span>
                    </td>
                    <td>{formatDate(checker.createdAt)}</td>
                    <td>
                      {checker.status === 'unused' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Delete this checker from stock?')) deleteChecker.mutate(checker._id);
                          }}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
