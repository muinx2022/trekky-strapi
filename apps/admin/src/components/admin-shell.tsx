"use client";

import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ExternalLink,
  FileText,
  MessageSquare,
  Tag,
} from "lucide-react";
import { type ElementType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createAdminDataProvider } from "@/lib/refine-admin-provider";
import { getAdminDashboard, type AdminDashboardData } from "@/lib/admin-api";

const queryClient = new QueryClient();
const adminDataProvider = createAdminDataProvider();
const GA_URL = "https://analytics.google.com/analytics/web/#/a386950699p527628719/reports/intelligenthome";
const numberFormatter = new Intl.NumberFormat("en-US");

type PostRecord = AdminDashboardData["recent"]["posts"][number];
type CategoryRecord = AdminDashboardData["recent"]["categories"][number];
type CommentRecord = AdminDashboardData["recent"]["comments"][number];

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return numberFormatter.format(value);
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

function ResourceOverview() {
  const dashboard = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getAdminDashboard,
  });

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-primary/[0.08] via-background to-background shadow-sm">
        <div className="flex flex-col gap-6 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Open the Google Analytics report directly from admin.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ContentOverview data={dashboard.data} isError={dashboard.isError} />

      <Card className="border-border/70 bg-background/70 py-4">
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium">Analytics report</p>
            <p className="text-sm text-muted-foreground">
              Opens the Google Analytics dashboard for Trekky in a new tab.
            </p>
          </div>
          <a href={GA_URL} target="_blank" rel="noreferrer">
            <Button variant="outline" className="gap-2">
              Open Google Analytics
              <ExternalLink className="h-4 w-4" />
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        </CardContent>
      </Card>
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
