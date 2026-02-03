import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/client';

async function getStats() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get counts
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    const { count: agreementCount } = await supabase
      .from('agreements')
      .select('*', { count: 'exact', head: true });
    
    const { count: tabCount } = await supabase
      .from('group_tabs')
      .select('*', { count: 'exact', head: true });
    
    return {
      users: userCount || 0,
      agreements: agreementCount || 0,
      groupTabs: tabCount || 0,
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return { users: 0, agreements: 0, groupTabs: 0 };
  }
}

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Users" value={stats.users} href="/admin/users" />
        <StatCard title="Total Agreements" value={stats.agreements} href="/admin/loans" />
        <StatCard title="Total GroupTabs" value={stats.groupTabs} href="/admin/grouptabs" />
      </div>

      {/* Quick links */}
      <div className="admin-card p-6">
        <h2 className="font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickLink href="/admin/users" label="Manage Users" />
          <QuickLink href="/admin/loans" label="View Loans" />
          <QuickLink href="/admin/grouptabs" label="View GroupTabs" />
          <QuickLink href="/admin/payments" label="Payment Reports" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, href }: { title: string; value: number; href: string }) {
  return (
    <Link href={href} className="admin-card p-6 hover:border-blue-500/50 transition-colors no-underline">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-3xl font-bold mt-2">{value.toLocaleString()}</p>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-4 py-3 bg-gray-800 rounded-lg text-sm text-center hover:bg-gray-700 transition-colors no-underline"
    >
      {label}
    </Link>
  );
}
