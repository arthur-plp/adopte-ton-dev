"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type Stats = {
  users: { total: number; developers: number; recruiters: number; admins: number };
  jobOffers: {
    total: number;
    draft: number;
    pendingReview: number;
    approved: number;
    published: number;
    rejected: number;
    archived: number;
  };
  applications: {
    total: number;
    sent: number;
    viewed: number;
    interview: number;
    accepted: number;
    rejected: number;
    withdrawn: number;
    acceptanceRate: number;
  };
};

const usersChartConfig: ChartConfig = {
  developers: { label: "Développeurs", color: "var(--chart-1)" },
  recruiters: { label: "Recruteurs", color: "var(--chart-2)" },
  admins: { label: "Admins", color: "var(--chart-4)" },
};

const JOB_STATUS_LABELS: Record<keyof Stats["jobOffers"], string> = {
  total: "Total",
  draft: "Brouillon",
  pendingReview: "En attente",
  approved: "Approuvée",
  published: "Publiée",
  rejected: "Rejetée",
  archived: "Archivée",
};

const APPLICATION_STATUS_LABELS: Record<keyof Stats["applications"], string> = {
  total: "Total",
  sent: "Envoyée",
  viewed: "Vue",
  interview: "Entretien",
  accepted: "Acceptée",
  rejected: "Rejetée",
  withdrawn: "Retirée",
  acceptanceRate: "Taux d'acceptation",
};

const jobsChartConfig: ChartConfig = { count: { label: "Offres", color: "var(--chart-1)" } };
const applicationsChartConfig: ChartConfig = { count: { label: "Candidatures", color: "var(--chart-2)" } };

export function AdminStatsCharts({ stats }: { stats: Stats }) {
  const usersData = [
    { key: "developers", name: "Développeurs", value: stats.users.developers },
    { key: "recruiters", name: "Recruteurs", value: stats.users.recruiters },
    { key: "admins", name: "Admins", value: stats.users.admins },
  ];

  const jobStatusKeys: (keyof Stats["jobOffers"])[] = ["draft", "pendingReview", "approved", "published", "rejected", "archived"];
  const jobData = jobStatusKeys.map((key) => ({ name: JOB_STATUS_LABELS[key], count: stats.jobOffers[key] }));

  const applicationStatusKeys: (keyof Stats["applications"])[] = ["sent", "viewed", "interview", "accepted", "rejected", "withdrawn"];
  const applicationData = applicationStatusKeys.map((key) => ({ name: APPLICATION_STATUS_LABELS[key], count: stats.applications[key] }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Utilisateurs par rôle</h3>
        <ChartContainer config={usersChartConfig} className="mx-auto aspect-square max-h-64">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie data={usersData} dataKey="value" nameKey="name" innerRadius={55} strokeWidth={4}>
              {usersData.map((entry) => (
                <Cell key={entry.key} fill={`var(--color-${entry.key})`} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
          {usersData.map((entry) => (
            <span key={entry.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: `var(--color-${entry.key})` }} />
              {entry.name} ({entry.value})
            </span>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Offres par statut</h3>
        <ChartContainer config={jobsChartConfig} className="max-h-64 w-full">
          <BarChart data={jobData} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={90} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="card p-5 lg:col-span-2">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Candidatures par statut</h3>
        <ChartContainer config={applicationsChartConfig} className="max-h-64 w-full">
          <BarChart data={applicationData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis hide />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
