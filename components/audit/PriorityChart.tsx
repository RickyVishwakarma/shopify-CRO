"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
} from "recharts";
import type { Opportunity } from "@/types/audit";

/**
 * Horizontal bar of the top opportunities by priority score — a quick visual
 * read of where the leverage is, colored by tier to match the score badges.
 */
export function PriorityChart({ opportunities }: { opportunities: Opportunity[] }) {
  const data = opportunities.slice(0, 8).map((o) => ({
    name: o.title.length > 28 ? o.title.slice(0, 27) + "…" : o.title,
    priority: o.priorityScore,
  }));

  const color = (v: number) =>
    v >= 1.5 ? "var(--good)" : v >= 0.8 ? "var(--warn)" : "var(--muted-foreground)";

  return (
    <div className="h-full w-full" style={{ minHeight: 260 }}>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 38)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
        >
          <XAxis
            type="number"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--foreground)",
            }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Bar dataKey="priority" radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={color(d.priority)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
