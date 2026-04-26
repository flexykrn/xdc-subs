"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface GasModeChartProps {
  sponsorCount: number;
  erc20Count: number;
  multiTokenCount: number;
}

const COLORS = {
  sponsor: "#10b981",
  erc20: "#06b6d4",
  "multi-token": "#8b5cf6",
};

export default function GasModeChart({
  sponsorCount,
  erc20Count,
  multiTokenCount,
}: GasModeChartProps) {
  const data = [
    { name: "Sponsor", value: sponsorCount, mode: "sponsor" as const },
    { name: "ERC20", value: erc20Count, mode: "erc20" as const },
    { name: "Multi", value: multiTokenCount, mode: "multi-token" as const },
  ];

  const total = sponsorCount + erc20Count + multiTokenCount;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Gas Mode Usage</h3>
        <span className="text-xs text-slate-500">Total: {total} txs</span>
      </div>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.mode]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
