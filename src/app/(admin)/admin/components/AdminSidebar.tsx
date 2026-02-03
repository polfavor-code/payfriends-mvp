'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Users', href: '/admin/users' },
  { name: 'Loans', href: '/admin/loans' },
  { name: 'GroupTabs', href: '/admin/grouptabs' },
  { name: 'Payment Reports', href: '/admin/payments' },
];

const adminTools = [
  { name: 'Calculator', href: '/admin/tools/calculator' },
  { name: 'Remote Config', href: '/admin/tools/config' },
  { name: 'Audit Log', href: '/admin/tools/audit' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col bg-gray-900 border-r border-gray-800">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-gray-800">
        <Link href="/admin" className="flex items-center no-underline">
          <span className="text-xl font-bold text-white">PayFriends</span>
          <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors no-underline',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              )}
            >
              {item.name}
            </Link>
          );
        })}

        {/* Admin Tools Section */}
        <div className="pt-6">
          <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Admin Tools
          </div>
          <div className="mt-2 space-y-1">
            {adminTools.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors no-underline',
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-800">
        <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-400 no-underline">
          ← Back to App
        </Link>
      </div>
    </div>
  );
}
