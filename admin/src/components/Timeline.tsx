import { formatDateTime, cn } from '@/lib/utils';

interface TimelineEvent {
  type: 'system' | 'payment' | 'admin' | 'user';
  label: string;
  timestamp: string;
  details?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {
  const getEventColor = (type: string) => {
    switch (type) {
      case 'system':
        return 'bg-blue-500';
      case 'payment':
        return 'bg-green-500';
      case 'admin':
        return 'bg-yellow-500';
      case 'user':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="admin-card p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Timeline</h2>
      
      {events.length === 0 ? (
        <p className="text-sm text-gray-500">No events.</p>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={index} className="flex gap-3">
              {/* Dot and line */}
              <div className="flex flex-col items-center">
                <div className={cn('w-3 h-3 rounded-full', getEventColor(event.type))} />
                {index < events.length - 1 && (
                  <div className="w-px h-full bg-gray-700 min-h-[20px]" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="text-sm font-medium">{event.label}</div>
                {event.details && (
                  <div className="text-xs text-gray-400 mt-0.5">{event.details}</div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {formatDateTime(event.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
