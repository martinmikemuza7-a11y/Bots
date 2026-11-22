import React from 'react';

interface BotAvatarProps {
  variant: number;
  color: string;
  status?: 'idle' | 'working' | 'waiting_approval';
  size?: 'sm' | 'md' | 'lg';
}

export const BotAvatar: React.FC<BotAvatarProps> = ({
  variant,
  color,
  status = 'idle',
  size = 'md',
}) => {
  const dims =
    size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';

  const shape = variant % 4;

  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center ${dims}`}>
      <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
        {shape === 0 && (
          <rect x="4" y="6" width="32" height="28" rx="10" fill={color} />
        )}
        {shape === 1 && (
          <path
            d="M20 4C29.5 4 36 10.5 36 20C36 29.5 29.5 36 20 36C10.5 36 4 29.5 4 20C4 10.5 10.5 4 20 4Z"
            fill={color}
          />
        )}
        {shape === 2 && (
          <rect x="5" y="5" width="30" height="30" rx="7" fill={color} />
        )}
        {shape === 3 && (
          <path
            d="M8 10C8 6.7 10.7 4 14 4H26C29.3 4 32 6.7 32 10V28C32 32.4 28.4 36 24 36H16C11.6 36 8 32.4 8 28V10Z"
            fill={color}
          />
        )}
        {/* Antenna / crest */}
        <circle cx="20" cy="4.5" r="2" fill={color} opacity="0.7" />
        {/* Eyes */}
        {status === 'working' ? (
          <>
            <rect x="12" y="17" width="6" height="3" rx="1.5" fill="#ffffff" />
            <rect x="22" y="17" width="6" height="3" rx="1.5" fill="#ffffff" />
          </>
        ) : (
          <>
            <circle cx="15" cy="19" r="2.7" fill="#ffffff" />
            <circle cx="25" cy="19" r="2.7" fill="#ffffff" />
            <circle cx="15.7" cy="19" r="1.1" fill="#0f172a" />
            <circle cx="25.7" cy="19" r="1.1" fill="#0f172a" />
          </>
        )}
        {/* Mouth */}
        <rect x="15" y="25.5" width="10" height="2" rx="1" fill="#ffffff" opacity="0.85" />
      </svg>

      {status !== 'idle' && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900 ${
            status === 'working'
              ? 'bg-emerald-500 animate-pulse'
              : 'bg-amber-500'
          }`}
        />
      )}
    </div>
  );
};
