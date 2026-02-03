'use client';

import { cn, getInitials } from '@/lib/utils';

interface UserAvatarProps {
  name: string | null | undefined;
  profilePictureUrl?: string | null;
  userId?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getAvatarColorClass(name: string | null | undefined): string {
  if (!name) return 'bg-indigo-500';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-indigo-500',
    'bg-violet-500',
    'bg-pink-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-blue-500',
    'bg-teal-500',
  ];
  return colors[Math.abs(hash) % colors.length];
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-xl',
};

export function UserAvatar({ name, profilePictureUrl, userId, size = 'md', className }: UserAvatarProps) {
  const initials = getInitials(name);
  const colorClass = getAvatarColorClass(name);

  // If user has profile picture
  if (profilePictureUrl && userId) {
    return (
      <div className={cn('rounded-full overflow-hidden flex-shrink-0', sizeClasses[size], className)}>
        <img
          src={`/api/profile/picture/${userId}`}
          alt={name || 'User'}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Initials-based avatar
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0',
        sizeClasses[size],
        colorClass,
        className
      )}
    >
      {initials}
    </div>
  );
}
