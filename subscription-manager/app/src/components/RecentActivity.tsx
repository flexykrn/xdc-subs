"use client";

interface Activity {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "subscribe" | "renew" | "pause" | "cancel" | "approve";
  status: "success" | "pending" | "failed";
}

interface RecentActivityProps {
  activities: Activity[];
}

const typeConfig = {
  subscribe: { color: "bg-emerald-500", icon: "+", label: "Subscribe" },
  renew: { color: "bg-cyan-500", icon: "↻", label: "Renew" },
  pause: { color: "bg-amber-500", icon: "⏸", label: "Pause" },
  cancel: { color: "bg-red-500", icon: "✕", label: "Cancel" },
  approve: { color: "bg-blue-500", icon: "✓", label: "Approve" },
};

const statusConfig = {
  success: { dot: "bg-emerald-500", text: "text-emerald-700" },
  pending: { dot: "bg-amber-500", text: "text-amber-700" },
  failed: { dot: "bg-red-500", text: "text-red-700" },
};

export default function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
        <div className="mt-4 flex items-center justify-center py-8">
          <p className="text-sm text-slate-500">No activity yet. Subscribe to a plan to see your first transaction.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
        <span className="text-xs text-slate-500">Last {activities.length} events</span>
      </div>
      <div className="mt-4 space-y-0">
        {activities.map((activity, index) => {
          const config = typeConfig[activity.type];
          const status = statusConfig[activity.status];
          const isLast = index === activities.length - 1;

          return (
            <div key={activity.id} className="flex gap-3">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${config.color}`}>
                  {config.icon}
                </div>
                {!isLast && <div className="mt-1 h-full w-px bg-slate-200 min-h-[40px]" />}
              </div>

              {/* Content */}
              <div className={`flex-1 pb-4 ${!isLast ? "border-b border-slate-100" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.text} bg-slate-50`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {activity.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{activity.description}</p>
                <p className="mt-1 text-xs text-slate-400">{activity.timestamp}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
