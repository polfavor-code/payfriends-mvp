import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getMessagesByUserId } from '@/lib/supabase/db';

export default async function FeaturesPage() {
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
          <h1 className="text-[28px] font-semibold m-0">Features</h1>
          {user && (
            <Link href="/dashboard" className="text-pf-accent text-sm hover:underline">
              ← Back to dashboard
            </Link>
          )}
        </div>

        {/* Hero card */}
        <section className="bg-gradient-to-br from-pf-accent/[0.16] to-[rgba(12,18,27,0.95)] rounded-[18px] p-7 border border-pf-accent/25 shadow-[0_24px_60px_rgba(0,0,0,0.7)] mb-7">
          <h2 className="text-[1.8rem] font-semibold m-0 mb-3">Everything PayFriends does for you</h2>
          <p className="m-0 text-[0.96rem] text-[#d2deec] max-w-[720px] leading-relaxed">
            PayFriends turns awkward money conversations into clear agreements that run on autopilot.
            Set up a plan once, then let us track the numbers, the reminders and the fairness for both sides.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 items-center">
            {user ? (
              <>
                <Link href="/calculate" className="btn-primary">
                  + New Loan Agreement
                </Link>
                <Link href="/dashboard" className="text-[0.9rem] text-pf-muted no-underline hover:text-pf-accent hover:underline">
                  Go back to your dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login?signup=true" className="btn-primary">
                  Get Started Free
                </Link>
                <Link href="/login" className="text-[0.9rem] text-pf-muted no-underline hover:text-pf-accent hover:underline">
                  Already have an account? Login
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Features grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <FeatureCard
            icon={
              <svg className="w-[26px] h-[26px] stroke-pf-accent fill-none stroke-[1.8]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="4" x2="9" y2="7"></line>
                <line x1="15" y1="4" x2="15" y2="7"></line>
                <polyline points="9 14 11 16 15 12"></polyline>
              </svg>
            }
            title="Clear repayment plans you both agree on"
            description="Set loan amounts, start dates and repayment schedules in a few clicks. Both sides see the same plan so expectations are clear from day one."
            tag="Clarity"
          />

          <FeatureCard
            icon={
              <svg className="w-[26px] h-[26px] stroke-pf-accent fill-none stroke-[1.8]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            }
            title="Smart reminders that never feel like chasing"
            description="PayFriends sends gentle reminders when payments are due so it never has to come from the lender personally. You keep the friendship, we handle the nudges."
            tag="Reminders"
          />

          <FeatureCard
            icon={
              <svg className="w-[26px] h-[26px] stroke-pf-accent fill-none stroke-[1.8]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="3" x2="12" y2="9"></line>
                <path d="M5 9l7-7 7 7"></path>
                <path d="M16 12h5l-2 5h-3z"></path>
                <path d="M3 12h5l2 5H7z"></path>
                <line x1="12" y1="9" x2="12" y2="21"></line>
              </svg>
            }
            title="Fair interest for early, late or different payments"
            description="When someone pays early, late or a different amount, we recalculate the interest automatically so both sides stay treated fairly."
            tag="Fairness"
          />

          <FeatureCard
            icon={
              <svg className="w-[26px] h-[26px] stroke-pf-accent fill-none stroke-[1.8]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6"></path>
                <path d="M2.5 22v-6h6"></path>
                <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8"></path>
                <path d="M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16"></path>
              </svg>
            }
            title="Future instalments adjust automatically"
            description="If a payment changes, the system updates the remaining schedule for you. No spreadsheets or manual math, just a clean new plan ready to go."
            tag="Automation"
          />

          <FeatureCard
            icon={
              <svg className="w-[26px] h-[26px] stroke-pf-accent fill-none stroke-[1.8]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            }
            title="Live outstanding balance to the cent"
            description="See at any moment who owes what, including interest and upcoming payments. The balance updates in real time after every payment that is logged."
            tag="Live balance"
          />

          <FeatureCard
            icon={
              <svg className="w-[26px] h-[26px] stroke-pf-accent fill-none stroke-[1.8]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            }
            title="Support when someone is struggling to pay"
            description="If life gets in the way, you can easily suggest a new plan with smaller or fewer payments. PayFriends helps you keep things fair without breaking the relationship."
            tag="Flexible plans"
          />

          <FeatureCard
            icon={
              <svg className="w-[26px] h-[26px] stroke-pf-accent fill-none stroke-[1.8]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            }
            title="Clean history and timelines for full transparency"
            description="Every payment, change and agreement update is stored in one place. Both sides can always see the full story, from day one until the final cent is repaid."
            tag="Transparency"
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  tag,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
}) {
  return (
    <article className="bg-[rgba(21,26,33,0.85)] rounded-2xl px-6 py-7 border border-pf-accent/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col justify-between relative overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(69,212,139,0.08),transparent_55%)] opacity-90 pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2.5 relative z-10">
        <div className="w-12 h-12 rounded-full bg-pf-accent/[0.08] inline-flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-[1.12rem] font-semibold leading-tight text-[#f3f7fb] m-0">
          {title}
        </h3>
      </div>

      {/* Body */}
      <p className="relative z-10 text-[0.9rem] text-pf-muted leading-[1.45] mt-0 mb-[18px]">
        {description}
      </p>

      {/* Footer with tag */}
      <div className="mt-auto pt-1 relative z-10">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[0.8rem] tracking-wider uppercase bg-pf-accent/10 text-pf-accent">
          <svg className="w-4 h-4 stroke-pf-accent stroke-2 fill-none" viewBox="0 0 16 16" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5 L6.5 12 13 4" />
          </svg>
          {tag}
        </span>
      </div>
    </article>
  );
}
