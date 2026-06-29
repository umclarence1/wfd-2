import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data.settings),
  });

  useEffect(() => {
    if (settings) {
      setForm({
        siteName: settings.siteName || '',
        contactEmail: settings.contactEmail || '',
        contactPhone: settings.contactPhone || '',
        whatsapp: settings.whatsapp || '',
        maintenanceMode: settings.maintenanceMode || false,
        maintenanceMessage: settings.maintenanceMessage || '',
        announcementEnabled: settings.announcementBanner?.enabled || false,
        announcementText: settings.announcementBanner?.text || '',
        announcementLink: settings.announcementBanner?.link || '',
      });
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: (payload) => api.put('/admin/settings', payload).then((r) => r.data.settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast('Settings saved.', 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Save failed.', 'error'),
  });

  if (isLoading || !form) return <div className="admin-panel h-48 animate-pulse bg-slate-100" />;
  if (isError) return <div className="admin-panel text-sm text-red-600">Could not load settings.</div>;

  const handleSubmit = (e) => {
    e.preventDefault();
    saveSettings.mutate({
      siteName: form.siteName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      whatsapp: form.whatsapp,
      maintenanceMode: form.maintenanceMode,
      maintenanceMessage: form.maintenanceMessage,
      announcementBanner: {
        enabled: form.announcementEnabled,
        text: form.announcementText,
        link: form.announcementLink,
      },
    });
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader title="Settings" subtitle="Manage contact details, announcements, and maintenance mode." />

      <form onSubmit={handleSubmit} className="admin-panel space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Site Name</label>
          <input className="input-field" value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Contact Email</label>
            <input className="input-field" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Contact Phone</label>
            <input className="input-field" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">WhatsApp</label>
          <input className="input-field" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <input
              type="checkbox"
              checked={form.announcementEnabled}
              onChange={(e) => setForm({ ...form, announcementEnabled: e.target.checked })}
            />
            Show announcement banner
          </label>
          <input
            className="input-field mt-3"
            placeholder="Announcement text"
            value={form.announcementText}
            onChange={(e) => setForm({ ...form, announcementText: e.target.value })}
          />
          <input
            className="input-field mt-3"
            placeholder="Announcement link (optional)"
            value={form.announcementLink}
            onChange={(e) => setForm({ ...form, announcementLink: e.target.value })}
          />
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <input
              type="checkbox"
              checked={form.maintenanceMode}
              onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
            />
            Maintenance mode
          </label>
          <textarea
            className="input-field mt-3 min-h-24"
            value={form.maintenanceMessage}
            onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })}
          />
        </div>

        <button type="submit" disabled={saveSettings.isPending} className="btn-primary">
          {saveSettings.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
