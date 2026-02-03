import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AdminSidebar } from './components/AdminSidebar';

export const metadata = {
  title: 'PayFriends Admin CMS',
  description: 'Internal admin tool for PayFriends operations',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Require authentication
  if (!user) {
    redirect('/login?redirect=/admin');
  }

  // Require admin role
  if (!user.isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="flex h-screen bg-admin-bg text-admin-text">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
