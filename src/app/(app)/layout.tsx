import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getMessagesByUserId } from '@/lib/supabase/db';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Get unread message count
  const messages = await getMessagesByUserId(user.id, { unreadOnly: true });
  const unreadCount = messages.length;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container-pf flex-1">
        <Header user={user} unreadCount={unreadCount} />
        <main>{children}</main>
      </div>
      <Footer />
    </div>
  );
}
