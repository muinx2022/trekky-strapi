"use client";

import {
  Refine,
  useNavigation,
} from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { FileText, Tag, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type PostRecord = AdminDashboardData["recent"]["posts"][number];
type CategoryRecord = AdminDashboardData["recent"]["categories"][number];
type CommentRecord = AdminDashboardData["recent"]["comments"][number];

function StatCard({
  label,
  value,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: number | null;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`gap-3 py-5 ${onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""}`}
      onClick={onClick}
    >
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {value === null ? "-" : value}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceOverview() {
  const navigation = useNavigation();
  const dashboard = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getAdminDashboard,
  });

  const data = dashboard.data;
  const postRows = data?.recent.posts ?? [];
  const categoryRows = data?.recent.categories ?? [];
  const commentRows = data?.recent.comments ?? [];

  const postTotal = data?.totals.posts ?? null;
  const categoryTotal = data?.totals.categories ?? null;
  const commentTotal = data?.totals.comments ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your content</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Posts"
          value={postTotal}
          icon={FileText}
          onClick={() => navigation.list("management/posts")}
        />
        <StatCard
          label="Categories"
          value={categoryTotal}
          icon={Tag}
        />
        <StatCard
          label="Comments"
          value={commentTotal}
          icon={MessageSquare}
        />
      </div>

      {dashboard.isError && (
        <Card>
          <CardContent className="py-4 text-sm text-destructive">
            Failed to load admin dashboard data.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <RecentCard
          title="Recent Posts"
          icon={FileText}
          rows={postRows}
          onViewAll={() => navigation.list("management/posts")}
        >
          {(item: PostRecord) => (
            <>
              <TableCell className="max-w-[140px] truncate font-medium">{item.title}</TableCell>
              <TableCell className="text-muted-foreground">{item.slug}</TableCell>
            </>
          )}
        </RecentCard>

        <RecentCard
          title="Categories"
          icon={Tag}
          rows={categoryRows}
        >
          {(item: CategoryRecord) => (
            <>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-muted-foreground">{item.slug}</TableCell>
            </>
          )}
        </RecentCard>

        <RecentCard
          title="Recent Comments"
          icon={MessageSquare}
          rows={commentRows}
        >
          {(item: CommentRecord) => (
            <>
              <TableCell className="font-medium">{item.authorName}</TableCell>
              <TableCell className="max-w-[140px] truncate text-muted-foreground">
                {item.content}
              </TableCell>
            </>
          )}
        </RecentCard>
      </div>
    </div>
  );
}

function RecentCard<T extends { id: number }>({
  title,
  icon: Icon,
  rows,
  onViewAll,
  children,
}: {
  title: string;
  icon: React.ElementType;
  rows: T[];
  onViewAll?: () => void;
  children: (row: T) => React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        {onViewAll && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onViewAll}
            className="gap-1 text-xs text-muted-foreground"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
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
                <TableCell
                  colSpan={2}
                  className="px-4 py-6 text-center text-xs text-muted-foreground"
                >
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

export function AdminShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <Refine
        dataProvider={adminDataProvider}
        routerProvider={routerProvider}
        resources={[
          { name: "management/posts", list: "/posts" },
          { name: "management/categories", list: "/categories" },
          { name: "management/comments", list: "/comments" },
        ]}
      >
        <ResourceOverview />
      </Refine>
    </QueryClientProvider>
  );
}
