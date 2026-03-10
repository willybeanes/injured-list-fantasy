"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface WeeklyData {
  week: string;
  days: number;
  isCurrent?: boolean;
}

interface WeeklyChartProps {
  data: WeeklyData[];
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "Figtree" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "Figtree" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(220,47,31,0.05)" }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 9,
            fontSize: 12,
            fontFamily: "Figtree",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-card)",
          }}
          formatter={(value) => [`${value} IL days`, "Score"]}
        />
        <Bar dataKey="days" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.isCurrent ? "#dc2f1f" : "var(--border-2)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
