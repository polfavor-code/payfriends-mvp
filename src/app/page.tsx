import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Footer } from '@/components/Footer';

export default async function LandingPage() {
  // If user is already logged in, redirect to dashboard
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-pf-bg text-pf-text">
      <div className="flex-1 w-full max-w-[1280px] px-4 py-12 md:py-16 lg:py-24 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-7 lg:gap-16">
        
        {/* HERO */}
        <section className="w-full lg:w-[60%] bg-pf-card border border-pf-card-border rounded-2xl p-6 lg:p-7 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <h1 className="text-[28px] lg:text-[40px] font-bold leading-[1.15] tracking-[-0.02em] mb-6 text-center lg:text-left">
            Pay friends, stay friends
          </h1>
          
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 lg:gap-10">
            {/* Logo with glow */}
            <Image
              src="/images/payfriends-logov2.png"
              alt="PayFriends logo"
              width={180}
              height={180}
              className="w-[120px] lg:w-[180px] h-auto flex-shrink-0 lg:ml-4 lg:mt-2"
              style={{
                filter: `
                  drop-shadow(0 6px 14px rgba(0,0,0,.35))
                  drop-shadow(0 0 60px rgba(61, 220, 151, 0.45))
                  drop-shadow(0 0 90px rgba(61, 220, 151, 0.30))
                  drop-shadow(0 0 120px rgba(61, 220, 151, 0.20))
                  drop-shadow(0 0 150px rgba(61, 220, 151, 0.12))
                `,
              }}
            />
            
            <div className="max-w-[440px] mt-1 text-center lg:text-left px-2 lg:px-0">
              <p className="text-lg font-semibold text-pf-text mb-4">
                Friends are GREAT!<br />
                Asking them to pay you back? NOT SO GREAT!
              </p>
              <p className="text-pf-muted leading-relaxed mb-4">
                PayFriends does the awkward stuff for you: the reminders, the nudges, the &ldquo;hey… remember that money?&rdquo; messages, so you don&apos;t have to become the annoying debt collector.
              </p>
              <p className="text-pf-muted italic opacity-85">
                Because friendships are priceless…<br />
                But your money isn&apos;t!
              </p>
            </div>
          </div>
          
          {/* Feature list */}
          <ul className="mt-7 pl-1 space-y-3 max-w-full mx-auto lg:mx-0">
            <FeatureItem>Clear agreements that don&apos;t feel like a contract with your friends</FeatureItem>
            <FeatureItem>Automatic reminders so you never have to chase anyone</FeatureItem>
            <FeatureItem>Fair recalculations for &ldquo;I&apos;ll pay a bit now and the rest later&rdquo; situations</FeatureItem>
            <FeatureItem>New plan suggestions when your friends face difficulties paying you back</FeatureItem>
          </ul>
        </section>

        {/* AUTH CARD */}
        <main className="w-[95%] max-w-[420px] lg:max-w-[400px] lg:w-[40%] bg-pf-card border border-pf-card-border rounded-2xl p-6 lg:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <h2 className="text-xl font-semibold mb-6 text-center">
            Get started
          </h2>
          
          <div className="space-y-4">
            <Link
              href="/login"
              className="block w-full py-3.5 px-3 rounded-xl border-0 bg-[#3bd48f] text-[#0d130f] font-extrabold text-[17px] text-center hover:brightness-[1.04] transition-all"
            >
              Login
            </Link>
            
            <Link
              href="/login?signup=true"
              className="block w-full py-3.5 px-3 rounded-xl border border-pf-card-border bg-transparent text-pf-text font-semibold text-[17px] text-center hover:border-pf-accent hover:text-pf-accent transition-colors"
            >
              Create Account
            </Link>
          </div>
          
          <p className="text-pf-muted text-center text-sm mt-6">
            Free to use. No credit card required.
          </p>
        </main>
      </div>

      <Footer />
    </div>
  );
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-[7px]">
      <svg 
        className="w-[19px] h-[19px] flex-shrink-0" 
        viewBox="0 0 24 24" 
        fill="none" 
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="#3ddc97" strokeWidth="2" fill="none" />
        <path 
          d="M8 12.5l2.5 2.5 5.5-5.5" 
          stroke="#3ddc97" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>
      <span className="text-[#c8d2dd] text-[15px] leading-[1.55]">{children}</span>
    </li>
  );
}
