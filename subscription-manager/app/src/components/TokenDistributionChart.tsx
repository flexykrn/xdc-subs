"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface TokenDistributionChartProps {
  tokenABalance: string;
  tokenBBalance: string;
  tokenASymbol: string;
  tokenBSymbol: string;
}

const COLORS = ["#06b6d4", "#8b5cf6", "#10b981"];

export default function TokenDistributionChart({
  tokenABalance,
  tokenBBalance,
  tokenASymbol,
  tokenBSymbol,
}: TokenDistributionChartProps) {
  const data = [
    { name: tokenASymbol, value: parseFloat(tokenABalance) || 0 },
    { name: tokenBSymbol, value: parseFloat(tokenBBalance) || 0 },
  ].filter((item) => item.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
        <p className="text-sm text-slate-500">No token data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">Token Distribution</h3>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: unknown) => {
                const num = typeof value === "number" ? value : 0;
                return `${num.toFixed(4)} tokens`;
              }}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
