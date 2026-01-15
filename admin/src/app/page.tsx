import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">PayFriends Admin CMS</h1>
      
      <div className="admin-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Quick Navigation</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link 
            href="/users" 
            className="admin-btn admin-btn-secondary block text-center py-4"
          >
            Users
          </Link>
          <Link 
            href="/loans" 
            className="admin-btn admin-btn-secondary block text-center py-4"
          >
            Loans
          </Link>
          <Link 
            href="/grouptabs" 
            className="admin-btn admin-btn-secondary block text-center py-4"
          >
            GroupTabs
          </Link>
          <Link 
            href="/payments" 
            className="admin-btn admin-btn-secondary block text-center py-4"
          >
            Payment Reports
          </Link>
        </div>
      </div>

      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold mb-4">Admin Tools</h2>
        <div className="grid grid-cols-3 gap-4">
          <Link 
            href="/tools/debugger" 
            className="admin-btn admin-btn-secondary block text-center py-4"
          >
            Calc Debugger
          </Link>
          <Link 
            href="/tools/config" 
            className="admin-btn admin-btn-secondary block text-center py-4"
          >
            Remote Config
          </Link>
          <Link 
            href="/tools/audit" 
            className="admin-btn admin-btn-secondary block text-center py-4"
          >
            Audit Log
          </Link>
        </div>
      </div>

      <div className="mt-8 text-sm text-gray-500">
        <p>Admin CMS MVP v0.1 - Internal use only</p>
        <p className="mt-1">Financial entities (Loans, GroupTabs, Payments) are read-only.</p>
      </div>
    </div>
  );
}
