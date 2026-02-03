'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Footer } from '@/components/Footer';

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSignup, setIsSignup] = useState(searchParams.get('signup') === 'true');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsSignup(searchParams.get('signup') === 'true');
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('');
    setIsError(false);
    setLoading(true);

    // Validation for signup
    if (isSignup) {
      if (!fullName || fullName.trim().split(/\s+/).length < 2) {
        setStatus('Please enter your full name (first and last name).');
        setIsError(true);
        setLoading(false);
        return;
      }
      if (!password || password.length < 6) {
        setStatus('Password must be at least 6 characters.');
        setIsError(true);
        setLoading(false);
        return;
      }
    }

    setStatus(isSignup ? 'Creating account...' : 'Logging in...');

    try {
      const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
      
      // Detect timezone for signup
      let timezone = null;
      if (isSignup) {
        try {
          timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
          console.warn('Failed to detect timezone');
        }
      }

      const body = isSignup
        ? { email, password, fullName, timezone }
        : { email, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || (isSignup ? 'Signup failed' : 'Login failed'));
        setIsError(true);
        setLoading(false);
        return;
      }

      setStatus(isSignup ? 'Account created! Redirecting...' : 'Success! Redirecting...');
      setIsError(false);

      // Redirect to dashboard or the original redirect URL
      const redirect = searchParams.get('redirect') || '/dashboard';
      setTimeout(() => router.push(redirect), 400);
    } catch {
      setStatus(isSignup ? 'Signup failed' : 'Login failed');
      setIsError(true);
      setLoading(false);
    }
  };

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
          {/* Tabs */}
          <div className="flex gap-2 border-b border-pf-card-border mb-5" role="tablist">
            <button
              onClick={() => { setIsSignup(false); setStatus(''); setIsError(false); }}
              className={`appearance-none bg-transparent border-0 px-1 py-2.5 font-semibold text-base cursor-pointer border-b-2 transition-colors ${
                !isSignup 
                  ? 'text-pf-accent border-pf-accent' 
                  : 'text-pf-muted border-transparent'
              }`}
              role="tab"
              aria-selected={!isSignup}
            >
              Login
            </button>
            <button
              onClick={() => { setIsSignup(true); setStatus(''); setIsError(false); }}
              className={`appearance-none bg-transparent border-0 px-1 py-2.5 font-semibold text-base cursor-pointer border-b-2 transition-colors ${
                isSignup 
                  ? 'text-pf-accent border-pf-accent' 
                  : 'text-pf-muted border-transparent'
              }`}
              role="tab"
              aria-selected={isSignup}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {isSignup && (
              <div className="mt-2.5">
                <label htmlFor="signup-fullname" className="sr-only">
                  Full legal name (as on passport)
                </label>
                <input
                  id="signup-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="w-full px-3 py-3 rounded-[10px] border border-pf-card-border bg-[#10151d] text-pf-text text-[15px] outline-none transition-colors focus:border-pf-accent focus:shadow-[0_0_0_3px_rgba(61,220,151,0.15)] placeholder:text-[#6f7881] placeholder:opacity-75"
                />
              </div>
            )}
            
            <div className="mt-2.5">
              <label htmlFor={isSignup ? 'signup-email' : 'login-email'} className="sr-only">
                Email
              </label>
              <input
                id={isSignup ? 'signup-email' : 'login-email'}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete={isSignup ? 'email' : 'username'}
                className="w-full px-3 py-3 rounded-[10px] border border-pf-card-border bg-[#10151d] text-pf-text text-[15px] outline-none transition-colors focus:border-pf-accent focus:shadow-[0_0_0_3px_rgba(61,220,151,0.15)] placeholder:text-[#6f7881] placeholder:opacity-75"
              />
            </div>
            
            <div className="mt-2.5">
              <label htmlFor={isSignup ? 'signup-password' : 'login-password'} className="sr-only">
                Password
              </label>
              <input
                id={isSignup ? 'signup-password' : 'login-password'}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                className="w-full px-3 py-3 rounded-[10px] border border-pf-card-border bg-[#10151d] text-pf-text text-[15px] outline-none transition-colors focus:border-pf-accent focus:shadow-[0_0_0_3px_rgba(61,220,151,0.15)] placeholder:text-[#6f7881] placeholder:opacity-75"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-3 rounded-xl border-0 mt-5 bg-[#3bd48f] text-[#0d130f] font-extrabold text-[17px] cursor-pointer hover:brightness-[1.04] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Login'}
            </button>
            
            <p 
              className={`mt-3 min-h-[1.2em] text-sm ${isError ? 'text-[#ff6b6b]' : 'text-pf-muted'}`}
              role="status"
              aria-live="polite"
            >
              {status}
            </p>
          </form>
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
