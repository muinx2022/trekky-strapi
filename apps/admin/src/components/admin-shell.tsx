"use client";

import Link from "next/link";
import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  FileText,
  Link2,
  MessageSquare,
  RefreshCcw,
  Settings2,
  Tag,
  Unplug,
  Users,
  Zap,
} from "lucide-react";
import { type ElementType, useEffect, useState } from "react";
import { toast } from "@/components/ui/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { createAdminDataProvider } from "@/lib/refine-admin-provider";
import {
  disconnectGa4Analytics,
  getAdminAnalyticsOverview,
  getAdminDashboard,
  getGa4AnalyticsSettings,
  getGa4OauthUrl,
  triggerAutoEngage,
  updateGa4AnalyticsSettings,
  type AdminAnalyticsOverview,
  type AdminDashboardData,
  type AnalyticsRange,
  type Ga4AnalyticsSettings,
} from "@/lib/admin-api";

const queryClient = new QueryClient();
const adminDataProvider = createAdminDataProvider();
const numberFormatter = new Intl.NumberFormat("en-US");

type PostRecord = AdminDashboardData["recent"]["posts"][number];
type CategoryRecord = AdminDashboardData["recent"]["categories"][number];
type CommentRecord = AdminDashboardData["recent"]["comments"][number];

const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return numberFormatter.format(value);
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getAdminTargetHref(item: AdminAnalyticsOverview["topPages"][number]) {
  if (item.targetType === "post" && item.targetDocumentId) {
    return `/posts/${item.targetDocumentId}/view`;
  }

  if (item.targetType === "page" && item.targetDocumentId) {
    return `/pages/${item.targetDocumentId}/edit`;
  }

  return null;
}

function AnalyticsStatCard({
  label,
  value,
  icon: Icon,
  helper,
}: {
  label: string;
  value: number | null;
  icon: ElementType;
  helper: string;
}) {
  return (
    <Card className="gap-3 border-border/70 py-5">
      <CardContent className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/80">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{formatNumber(value)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-56 rounded-xl bg-muted/70" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-3 rounded bg-muted/60" />
        ))}
      </div>
    </div>
  );
}

function EmptyAnalyticsState({ message }: { message: string }) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function AnalyticsChart({ series }: { series: AdminAnalyticsOverview["series"] }) {
  if (series.length === 0) {
    return <EmptyAnalyticsState message="No analytics data returned for this date range." />;
  }

  const width = 720;
  const height = 260;
  const padding = 18;
  const maxValue = Math.max(1, ...series.map((point) => Math.max(point.users, point.views)));
  const steps = Math.max(1, series.length - 1);

  const buildPoints = (key: "users" | "views") =>
    series
      .map((point, index) => {
        const x = padding + (index / steps) * (width - padding * 2);
        const y = height - padding - (point[key] / maxValue) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
          {[0, 1, 2, 3].map((line) => {
            const y = padding + ((height - padding * 2) / 3) * line;
            return (
              <line
                key={line}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="currentColor"
                strokeDasharray="4 6"
                className="text-border/80"
              />
            );
          })}
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={buildPoints("views")}
            className="text-primary"
          />
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={buildPoints("users")}
            className="text-chart-2"
          />
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Views
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-chart-2" />
          Users
        </span>
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
        {series
          .filter((_, index) => index === 0 || index === series.length - 1 || index % Math.ceil(series.length / 4) === 0)
          .slice(0, 4)
          .map((point) => (
            <div key={point.date} className="rounded-lg border border-border/60 px-3 py-2">
              <div>{formatDateLabel(point.date)}</div>
              <div className="mt-1 font-medium text-foreground">{formatNumber(point.views)} views</div>
            </div>
          ))}
      </div>
    </div>
  );
}

function RangePicker({ value, onChange }: { value: AnalyticsRange; onChange: (next: AnalyticsRange) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-border/70 bg-background p-1 shadow-sm">
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RecentCard<T extends { id: number }>({
  title,
  icon: Icon,
  rows,
  children,
}: {
  title: string;
  icon: ElementType;
  rows: T[];
  children: (row: T) => React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4 text-xs">Name</TableHead>
              <TableHead className="px-4 text-xs">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="text-sm">
                {children(row)}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No data yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ContentOverview({ data, isError }: { data: AdminDashboardData | undefined; isError: boolean }) {
  const postRows = data?.recent.posts ?? [];
  const categoryRows = data?.recent.categories ?? [];
  const commentRows = data?.recent.comments ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Content overview</h2>
          <p className="text-sm text-muted-foreground">Current totals and latest updated records.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">Posts {formatNumber(data?.totals.posts ?? null)}</Badge>
          <Badge variant="outline">Categories {formatNumber(data?.totals.categories ?? null)}</Badge>
          <Badge variant="outline">Comments {formatNumber(data?.totals.comments ?? null)}</Badge>
        </div>
      </div>

      {isError && (
        <Card>
          <CardContent className="py-4 text-sm text-destructive">Failed to load content overview data.</CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <RecentCard title="Recent Posts" icon={FileText} rows={postRows}>
          {(item: PostRecord) => (
            <>
              <TableCell className="max-w-[160px] truncate font-medium">{item.title}</TableCell>
              <TableCell className="text-muted-foreground">{item.slug}</TableCell>
            </>
          )}
        </RecentCard>

        <RecentCard title="Categories" icon={Tag} rows={categoryRows}>
          {(item: CategoryRecord) => (
            <>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-muted-foreground">{item.slug}</TableCell>
            </>
          )}
        </RecentCard>

        <RecentCard title="Recent Comments" icon={MessageSquare} rows={commentRows}>
          {(item: CommentRecord) => (
            <>
              <TableCell className="font-medium">{item.authorName}</TableCell>
              <TableCell className="max-w-[160px] truncate text-muted-foreground">{item.content}</TableCell>
            </>
          )}
        </RecentCard>
      </div>
    </div>
  );
}

function Ga4SettingsCard({
  settings,
  onSaved,
}: {
  settings: Ga4AnalyticsSettings | undefined;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    propertyId: "",
    clientId: "",
    clientSecret: "",
  });
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    setForm({
      propertyId: settings?.propertyId ?? "",
      clientId: settings?.clientId ?? "",
      clientSecret: settings?.clientSecret ?? "",
    });
  }, [settings?.propertyId, settings?.clientId, settings?.clientSecret]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateGa4AnalyticsSettings(form);
      toast({ title: "GA4 settings saved", variant: "success" });
      await onSaved();
    } catch (error) {
      toast({
        title: "Failed to save GA4 settings",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      await updateGa4AnalyticsSettings(form);
      const result = await getGa4OauthUrl(`${window.location.origin}/dashboard`);
      window.location.href = result.url;
    } catch (error) {
      toast({
        title: "Failed to start Google connection",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await disconnectGa4Analytics();
      toast({ title: "Google Analytics disconnected", variant: "success" });
      await onSaved();
    } catch (error) {
      toast({
        title: "Failed to disconnect",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card className="border-border/70 py-5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Google Analytics OAuth
            </CardTitle>
            <CardDescription className="mt-1">
              Store GA4 property and OAuth client credentials in Strapi, then connect once to save a refresh token.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={settings?.configured ? "outline" : "secondary"}>
              {settings?.configured ? "Configured" : "Not configured"}
            </Badge>
            <Badge variant={settings?.connected ? "default" : "secondary"}>
              {settings?.connected ? "Connected" : "Not connected"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ga4-property-id">Property ID</Label>
            <Input
              id="ga4-property-id"
              value={form.propertyId}
              onChange={(event) => setForm((prev) => ({ ...prev, propertyId: event.target.value }))}
              placeholder="123456789"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ga4-client-id">OAuth Client ID</Label>
            <Input
              id="ga4-client-id"
              value={form.clientId}
              onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))}
              placeholder="123.apps.googleusercontent.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ga4-client-secret">OAuth Client Secret</Label>
            <Input
              id="ga4-client-secret"
              type="password"
              value={form.clientSecret}
              onChange={(event) => setForm((prev) => ({ ...prev, clientSecret: event.target.value }))}
              placeholder="GOCSPX-..."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
          <div className="space-y-1">
            <div className="font-medium">
              {settings?.connected
                ? `Connected${settings.connectedEmail ? ` as ${settings.connectedEmail}` : ""}`
                : "OAuth connection required"}
            </div>
            <div className="text-xs text-muted-foreground">
              Redirect URI to register in Google Cloud:
              {" "}
              <code className="rounded bg-background px-1.5 py-0.5">https://api.trekky.net/api/management/google/ga4/callback</code>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
            <Button onClick={handleConnect} disabled={connecting}>
              <Link2 className="h-4 w-4" />
              {connecting ? "Redirecting..." : settings?.connected ? "Reconnect Google" : "Connect Google"}
            </Button>
            {settings?.connected && (
              <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                <Unplug className="h-4 w-4" />
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceOverview() {
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [engaging, setEngaging] = useState(false);
  const [engageMsg, setEngageMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const settings = useQuery({
    queryKey: ["ga4-settings"],
    queryFn: getGa4AnalyticsSettings,
  });

  const analytics = useQuery({
    queryKey: ["admin-analytics", range],
    queryFn: () => getAdminAnalyticsOverview(range),
    enabled: Boolean(settings.data?.connected),
  });

  const dashboard = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getAdminDashboard,
  });

  async function refreshSettingsAndAnalytics() {
    await settings.refetch();
    await analytics.refetch();
  }

  async function handleAutoEngage() {
    setEngaging(true);
    setEngageMsg(null);
    try {
      const res = await triggerAutoEngage();
      setEngageMsg({ ok: true, text: res.message });
    } catch (err) {
      setEngageMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setEngaging(false);
    }
  }

  const analyticsData = analytics.data;
  const generatedLabel = analyticsData?.generatedAt
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(analyticsData.generatedAt))
    : null;

  return (
    <div className="space-y-6">
      <Ga4SettingsCard settings={settings.data} onSaved={refreshSettingsAndAnalytics} />

      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-primary/[0.08] via-background to-background shadow-sm">
        <div className="flex flex-col gap-6 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                <BarChart3 className="h-3.5 w-3.5" />
                Google Analytics 4
              </Badge>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Site-wide performance from GA4 with OAuth credentials stored in Strapi.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <RangePicker value={range} onChange={setRange} />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => analytics.refetch()}
                  disabled={analytics.isFetching || !settings.data?.connected}
                  className="gap-1.5"
                >
                  <RefreshCcw className={cn("h-3.5 w-3.5", analytics.isFetching && "animate-spin")} />
                  Refresh
                </Button>
                <Button size="sm" variant="outline" onClick={handleAutoEngage} disabled={engaging}>
                  <Zap className="mr-1 h-3.5 w-3.5" />
                  {engaging ? "Running..." : "Auto Engage"}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {generatedLabel ? `Last sync: ${generatedLabel}` : "Connect Google Analytics to load reports"}
              </div>
              {engageMsg && (
                <div className={cn("text-xs", engageMsg.ok ? "text-green-600" : "text-destructive")}>
                  {engageMsg.text}
                </div>
              )}
            </div>
          </div>

          {!settings.data?.connected ? (
            <EmptyAnalyticsState message="Save your GA4 property and OAuth client credentials, then connect Google to start loading analytics." />
          ) : analytics.isLoading ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-32 rounded-2xl border border-border/70 bg-background/80" />
                ))}
              </div>
              <ChartSkeleton />
            </>
          ) : analytics.isError ? (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive">Analytics unavailable</CardTitle>
                <CardDescription>
                  {analytics.error instanceof Error ? analytics.error.message : "Failed to load GA4 analytics."}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <AnalyticsStatCard
                  label="Users"
                  value={analyticsData?.summary.users ?? null}
                  icon={Users}
                  helper={`Active users in the last ${range.replace("d", "")} days`}
                />
                <AnalyticsStatCard
                  label="Views"
                  value={analyticsData?.summary.views ?? null}
                  icon={BarChart3}
                  helper="Total page and screen views"
                />
                <AnalyticsStatCard
                  label="Sessions"
                  value={analyticsData?.summary.sessions ?? null}
                  icon={RefreshCcw}
                  helper="Sessions reported by GA4"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
                <Card className="gap-4 border-border/70 py-5">
                  <CardHeader className="pb-0">
                    <CardTitle>Traffic trend</CardTitle>
                    <CardDescription>Daily users and views for the selected range.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AnalyticsChart series={analyticsData?.series ?? []} />
                  </CardContent>
                </Card>

                <Card className="gap-4 border-border/70 py-5">
                  <CardHeader className="pb-0">
                    <CardTitle>Top pages</CardTitle>
                    <CardDescription>Highest-view paths returned by GA4.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-0">
                    {(analyticsData?.topPages.length ?? 0) === 0 ? (
                      <div className="px-6">
                        <EmptyAnalyticsState message="No top-page records were returned by GA4." />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="px-6">Page</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Views</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analyticsData?.topPages.map((item) => {
                            const href = getAdminTargetHref(item);
                            return (
                              <TableRow key={`${item.path}-${item.targetDocumentId ?? "none"}`}>
                                <TableCell className="px-6 align-top">
                                  <div className="space-y-1">
                                    <div className="font-medium">{item.title}</div>
                                    <div className="text-xs text-muted-foreground">{item.path}</div>
                                    {href && (
                                      <Link href={href} className="text-xs text-primary hover:underline">
                                        Open in admin
                                      </Link>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <Badge variant="outline" className="capitalize">
                                    {item.targetType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right align-top font-medium">
                                  {formatNumber(item.views)}
                                  <div className="text-xs font-normal text-muted-foreground">
                                    {formatNumber(item.users)} users
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </section>

      <ContentOverview data={dashboard.data} isError={dashboard.isError} />
    </div>
  );
}

export function AdminShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <Refine
        dataProvider={adminDataProvider}
        routerProvider={routerProvider}
        resources={[
          { name: "management/posts", list: "/posts" },
          { name: "management/pages", list: "/pages" },
          { name: "management/categories", list: "/categories" },
          { name: "management/tags", list: "/tags" },
          { name: "management/comments", list: "/comments" },
        ]}
      >
        <ResourceOverview />
      </Refine>
    </QueryClientProvider>
  );
}
