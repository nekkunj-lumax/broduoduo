"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const CHART_COLORS = {
  primary: "#376488",
  light: "#6899bd",
  teal: "#2a8f9d",
  green: "#2f9e73",
  amber: "#d49a2a",
  red: "#c4574f",
  slate: "#8696ad",
};

const axisProps = {
  stroke: "#8696ad",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(15,27,42,0.08)",
  fontSize: 12,
};

export interface BarDatum {
  name: string;
  [key: string]: string | number;
}

export interface BarSeries {
  key: string;
  label: string;
  color?: string;
  stackId?: string;
}

/** Vertical or horizontal bar chart supporting multiple / stacked series. */
export function SimpleBarChart({
  data,
  series,
  layout = "vertical",
  format,
  yWidth,
}: {
  data: BarDatum[];
  series: BarSeries[];
  /** "vertical" = categories on X axis; "horizontal" = categories on Y axis */
  layout?: "vertical" | "horizontal";
  format?: (v: number) => string;
  yWidth?: number;
}) {
  const horizontal = layout === "horizontal";
  const palette = [CHART_COLORS.primary, CHART_COLORS.light, CHART_COLORS.teal, CHART_COLORS.amber];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf3" horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...axisProps} tickFormatter={format} />
            <YAxis type="category" dataKey="name" width={yWidth ?? 130} {...axisProps} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={format} width={yWidth ?? 56} />
          </>
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(71,125,164,0.08)" }}
          formatter={(v) => (format ? format(Number(v)) : String(v))}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId={s.stackId}
            fill={s.color ?? palette[i % palette.length]}
            radius={s.stackId ? 0 : [3, 3, 0, 0]}
            maxBarSize={44}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  format,
}: {
  data: { name: string; value: number; color?: string }[];
  format?: (v: number) => string;
}) {
  const palette = [
    CHART_COLORS.primary,
    CHART_COLORS.green,
    CHART_COLORS.amber,
    CHART_COLORS.slate,
    CHART_COLORS.teal,
    CHART_COLORS.red,
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
          {data.map((d, i) => (
            <Cell key={d.name} fill={d.color ?? palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => (format ? format(Number(v)) : String(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}
