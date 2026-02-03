import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getMessagesByUserId } from '@/lib/supabase/db';
import { FAQContent } from './FAQContent';

export default async function FAQPage() {
  const user = await getCurrentUser();
  const messages = user ? await getMessagesByUserId(user.id, { unreadOnly: true }) : [];
  const unreadCount = messages.length;

  return (
    <div className="min-h-screen flex flex-col bg-pf-bg text-pf-text">
      <main className="flex-1 max-w-[1200px] mx-auto px-4 py-8 w-full">
        {/* Header - different based on auth state */}
        {user ? (
          <Header user={user} unreadCount={unreadCount} />
        ) : (
          <header className="flex items-center justify-between mb-6 pb-4 border-b border-pf-card-border">
            <Link href="/" className="flex items-center gap-3 no-underline">
              <span className="text-2xl font-semibold text-pf-text">PayFriends.app</span>
            </Link>
            <div className="flex gap-3">
              <Link href="/login" className="btn-secondary text-sm">
                Login
              </Link>
              <Link href="/login?signup=true" className="btn-primary text-sm">
                Sign Up
              </Link>
            </div>
          </header>
        )}

        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-[28px] font-semibold m-0">FAQ</h1>
          {user && (
            <Link href="/dashboard" className="text-pf-accent text-sm hover:underline">
              ← Back to dashboard
            </Link>
          )}
        </div>

        {/* FAQ card */}
        <div className="bg-pf-card border border-pf-card-border rounded-2xl p-6 mb-12">
          <p className="text-pf-muted text-sm mb-6 leading-relaxed">
            Find answers to common questions about PayFriends.
          </p>

          <FAQContent />

          {!user && (
            <div className="text-center mt-8 pt-6 border-t border-pf-card-border">
              <p className="text-pf-muted mb-4">Ready to get started?</p>
              <Link href="/login?signup=true" className="btn-primary">
                Create Free Account
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
