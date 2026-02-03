import Link from 'next/link';
import Image from 'next/image';
import { getCurrentUser } from '@/lib/auth';
import { getAgreementsByUserId } from '@/lib/supabase/db';
import { redirect } from 'next/navigation';
import { LoansPageClient } from './LoansPageClient';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const agreements = await getAgreementsByUserId(user.id);

  // Check if user has any agreements (excluding cancelled ones that were never accepted)
  const visibleAgreements = agreements.filter(a => {
    if (a.status === 'cancelled') return false;
    return true;
  });
  const hasAgreements = visibleAgreements.length > 0;

  if (!hasAgreements) {
    // Show welcome state for new users
    return (
      <WelcomeCard 
        userName={user.fullName} 
        hasProfilePicture={!!user.profilePicturePath} 
      />
    );
  }

  // Show loans page with table
  return (
    <LoansPageClient
      agreements={agreements}
      currentUser={{
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      }}
    />
  );
}

function WelcomeCard({ userName, hasProfilePicture }: { userName: string | null; hasProfilePicture: boolean }) {
  const firstName = userName?.split(' ')[0] || 'there';

  return (
    <div className="py-16 px-8 relative">
      {/* Speech Balloon - shown when user has no profile picture */}
      {!hasProfilePicture && (
        <div className="absolute top-9 right-5 max-w-[340px] z-10 hidden xl:block">
          <div className="bg-pf-card border border-pf-accent/30 rounded-2xl px-6 py-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.4),0_0_0_1px_rgba(61,220,151,0.1),0_0_20px_rgba(61,220,151,0.15)]">
            <p className="text-[17px] leading-relaxed m-0">
              <Link
                href="/profile"
                className="text-pf-text hover:text-pf-accent hover:underline transition-colors"
              >
                Please add a profile photo to make sending requests to friends more personal.
              </Link>
            </p>
          </div>
          {/* Speech balloon tail pointing down to mascot */}
          <div className="absolute -bottom-4 right-[60px] w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[16px] border-t-pf-accent/30" />
          <div className="absolute -bottom-[14px] right-[62px] w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[14px] border-t-pf-card" />
        </div>
      )}

      {/* Mobile version of the tip - shown as a banner */}
      {!hasProfilePicture && (
        <div className="xl:hidden mb-6 bg-pf-card border border-pf-accent/30 rounded-2xl px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.4),0_0_0_1px_rgba(61,220,151,0.1),0_0_20px_rgba(61,220,151,0.15)]">
          <p className="text-base leading-relaxed m-0">
            <Link
              href="/profile"
              className="text-pf-text hover:text-pf-accent hover:underline transition-colors"
            >
              Please add a profile photo to make sending requests to friends more personal.
            </Link>
          </p>
        </div>
      )}

      <div className="max-w-4xl mx-auto flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1 text-center lg:text-left">
          <h2 className="text-3xl font-bold mb-4">Welcome, {firstName}</h2>
          <p className="text-lg text-pf-muted/90 mb-4">
            PayFriends keeps money and friendships in balance. Create simple agreements 
            with friends, let us handle the reminders, and always know exactly where you stand.
          </p>
          <p className="text-pf-muted mb-6">
            Start by creating your first agreement. You can lend money to a friend or set up 
            a plan to repay someone else. We will take care of the plan, the schedule and the follow up.
          </p>

          <div className="flex gap-3 justify-center lg:justify-start flex-wrap">
            <Link href="/calculate" className="btn-primary flex items-center gap-2 px-5 py-3 text-base">
              <span className="text-lg font-bold">+</span>
              <span>New Loan Agreement</span>
            </Link>
            <Link href="/grouptabs/create" className="btn-primary flex items-center gap-2 px-5 py-3 text-base">
              <span className="text-lg font-bold">+</span>
              <span>Start GroupTab</span>
            </Link>
          </div>

          <p className="text-sm text-pf-muted/60 mt-6">
            <Link href="/features" className="text-pf-accent font-medium hover:underline">
              See all features and how we work our magic
            </Link>
          </p>
        </div>

        <div className="flex-shrink-0 relative mt-20 lg:mt-0">
          <Image
            src="/images/mascot.png"
            alt="PayFriends mascot"
            width={360}
            height={360}
            className="drop-shadow-2xl max-w-[240px] lg:max-w-[360px] h-auto"
          />
          {/* Shadow effect under mascot */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[70%] h-[18%] max-w-[260px] bg-gradient-radial from-black/55 to-transparent blur-md opacity-70" />
        </div>
      </div>
    </div>
  );
}
