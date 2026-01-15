import { getRemoteConfigs } from '@/lib/db-supabase';
import { formatDateTime } from '@/lib/utils';
import { ConfigForm } from './ConfigForm';

export const dynamic = 'force-dynamic';

export default async function RemoteConfigPage() {
  const configs = await getRemoteConfigs();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Remote Config</h1>
        <span className="text-sm text-gray-500">Feature Flags + Wizard Copy</span>
      </div>

      {/* Add New Config */}
      <div className="admin-card p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Add / Update Config</h2>
        <ConfigForm />
      </div>

      {/* Existing Configs */}
      <div className="admin-card p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Current Configuration</h2>
        
        {configs.length === 0 ? (
          <p className="text-sm text-gray-500">No configuration values set.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Type</th>
                <th>Description</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr key={config.key}>
                  <td className="font-mono text-sm">{config.key}</td>
                  <td>
                    {config.type === 'boolean' ? (
                      <span className={`badge ${config.value === 'true' ? 'badge-active' : 'badge-disabled'}`}>
                        {config.value}
                      </span>
                    ) : (
                      <span className="text-sm">{config.value.substring(0, 50)}{config.value.length > 50 ? '...' : ''}</span>
                    )}
                  </td>
                  <td className="text-xs text-gray-400">{config.type}</td>
                  <td className="text-sm text-gray-400">{config.description}</td>
                  <td className="text-xs text-gray-500">{formatDateTime(config.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Documentation */}
      <div className="mt-6 admin-card p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Usage Notes</h2>
        <div className="text-sm text-gray-400 space-y-2">
          <p><strong>Feature Flags (boolean):</strong> Enable/disable features across the app.</p>
          <p><strong>Wizard Copy (string):</strong> Override labels and helper text in the loan wizard.</p>
          <p className="text-xs text-gray-500 mt-4">
            Note: Wizard logic remains hardcoded. Only copy/labels are configurable.
          </p>
        </div>

        <h3 className="text-sm font-semibold text-gray-400 mt-4 mb-2">Example Keys</h3>
        <ul className="text-xs text-gray-500 space-y-1 font-mono">
          <li>feature.grouptabs.enabled - boolean</li>
          <li>feature.installments.enabled - boolean</li>
          <li>wizard.step1.title - string</li>
          <li>wizard.step1.helper - string</li>
        </ul>
      </div>
    </div>
  );
}
