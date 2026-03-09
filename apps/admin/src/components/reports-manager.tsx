"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, ExternalLink, X } from "lucide-react";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationControls } from "@/components/pagination-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listReports,
  resolveReports,
  type PaginationMeta,
  type ReportItem,
  type ReportStatus,
} from "@/lib/admin-api";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const STATUS_STYLES: Record<ReportStatus, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  reviewed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  dismissed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Pending",
  reviewed: "Approved",
  dismissed: "Rejected",
};

type ReportGroup = {
  targetType: string;
  targetDocumentId: string;
  targetTitle?: string | null;
  targetSlug?: string | null;
  reports: ReportItem[];
  pendingCount: number;
};

type PendingPostAction =
  | {
      type: "approve" | "reject";
      group: ReportGroup;
    }
  | null;

function groupReports(reports: ReportItem[]): ReportGroup[] {
  const map = new Map<string, ReportGroup>();
  for (const report of reports) {
    const key = `${report.targetType}:${report.targetDocumentId}`;
    if (!map.has(key)) {
      map.set(key, {
        targetType: report.targetType,
        targetDocumentId: report.targetDocumentId,
        targetTitle: report.targetTitle,
        targetSlug: report.targetSlug,
        reports: [],
        pendingCount: 0,
      });
    }

    const group = map.get(key)!;
    group.reports.push(report);
    if (report.status === "pending") group.pendingCount += 1;
    if (report.targetTitle) group.targetTitle = report.targetTitle;
    if (report.targetSlug) group.targetSlug = report.targetSlug;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
    const latestA = Math.max(...a.reports.map((r) => new Date(r.createdAt ?? 0).getTime()));
    const latestB = Math.max(...b.reports.map((r) => new Date(r.createdAt ?? 0).getTime()));
    return latestB - latestA;
  });
}

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "";

function ConfirmReportPostActionModal({
  pendingAction,
  loading,
  onCancel,
  onConfirm,
}: {
  pendingAction: PendingPostAction;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!pendingAction) {
    return null;
  }

  const isApprove = pendingAction.type === "approve";
  const postName = pendingAction.group.targetTitle ?? pendingAction.group.targetDocumentId;
  const title = isApprove ? "Approve report" : "Reject report";
  const description = isApprove
    ? `Approve report and unpublish "${postName}"?`
    : `Reject report — "${postName}" will not be affected.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant={isApprove ? "default" : "destructive"} onClick={onConfirm} disabled={loading}>
            {loading ? "Processing..." : isApprove ? "Approve & unpublish" : "Reject"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReportsManager() {
  const [rows, setRows] = useState<ReportItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | ReportStatus>("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<PendingPostAction>(null);
  const [actionDocumentId, setActionDocumentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listReports(page, 10, { status: statusFilter, targetType: targetTypeFilter });
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, targetTypeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const onConfirmAction = async () => {
    if (!pendingAction) {
      return;
    }

    const { type, group } = pendingAction;
    const documentId = group.targetDocumentId;

    try {
      setActionDocumentId(documentId);
      await resolveReports(group.targetType, documentId, type);

      if (type === "approve") {
        toast({ title: "Report approved — post unpublished", variant: "success" });
      } else {
        toast({ title: "Report rejected", variant: "success" });
      }

      setPendingAction(null);
      void load();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setActionDocumentId(null);
    }
  };

  const groups = groupReports(rows);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-xl font-semibold tracking-tight">Reports</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage user reports · {groups.length} reported items
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as "all" | ReportStatus);
            }}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Approved</option>
            <option value="dismissed">Rejected</option>
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={targetTypeFilter}
            onChange={(e) => {
              setPage(1);
              setTargetTypeFilter(e.target.value);
            }}
          >
            <option value="all">All types</option>
            <option value="post">Post</option>
            <option value="comment">Comment</option>
            <option value="user">User</option>
          </select>
        </div>

        {loading && <p className="py-2 text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="py-2 text-sm text-destructive">{error}</p>}

        <div className="divide-y rounded-md border">
          {groups.length === 0 && !loading && (
            <div className="py-10 text-center text-sm text-muted-foreground">No reports found.</div>
          )}

          {groups.map((group) => {
            const key = `${group.targetType}:${group.targetDocumentId}`;
            const expanded = expandedKeys.has(key);
            const isPostGroup = group.targetType === "post";
            const postUrl = group.targetType === "post" && group.targetSlug
              ? `${WEB_URL}/p/${group.targetSlug}--${group.targetDocumentId}`
              : null;

            return (
              <div key={key}>
                <div
                  className="flex cursor-pointer select-none items-center gap-3 px-4 py-3 hover:bg-muted/40"
                  onClick={() => toggleExpand(key)}
                >
                  <span className="text-muted-foreground">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>

                  <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                    {group.targetType}
                  </span>

                  <div className="min-w-0 flex-1">
                    {group.targetTitle ? (
                      <p className="truncate text-sm font-medium">{group.targetTitle}</p>
                    ) : (
                      <p className="truncate font-mono text-xs text-muted-foreground">{group.targetDocumentId}</p>
                    )}
                  </div>

                  {postUrl && (
                    <a
                      href={postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                      title="View post"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}

                  {isPostGroup && group.pendingCount > 0 && (
                    <div
                      className="flex shrink-0 items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
                        onClick={() => setPendingAction({ type: "approve", group })}
                        disabled={actionDocumentId === group.targetDocumentId}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 border-zinc-400 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        onClick={() => setPendingAction({ type: "reject", group })}
                        disabled={actionDocumentId === group.targetDocumentId}
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  )}

                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    {group.pendingCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {group.pendingCount} pending
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {group.reports.length} {group.reports.length === 1 ? "report" : "reports"}
                    </span>
                  </div>
                </div>

                {expanded && (
                  <Table className="[&_td]:align-top">
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="w-[50px] pl-12">ID</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="w-[180px]">Reporter</TableHead>
                        <TableHead className="w-[140px]">Date</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.reports.map((item) => (
                        <TableRow key={item.id} className="bg-muted/10">
                          <TableCell className="pl-12 text-sm text-muted-foreground">{item.id}</TableCell>
                          <TableCell className="max-w-[260px] text-sm">
                            {item.reason || <span className="italic text-muted-foreground">No reason provided</span>}
                          </TableCell>
                          <TableCell>
                            {item.reporter ? (
                              <div>
                                <p className="text-sm font-medium">{item.reporter.username}</p>
                                <p className="text-xs text-muted-foreground">{item.reporter.email}</p>
                              </div>
                            ) : (
                              <span className="text-sm italic text-muted-foreground">Deleted user</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(item.createdAt)}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                            >
                              {STATUS_LABELS[item.status]}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </div>

        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          onPageChange={setPage}
        />
      </CardContent>

      <ConfirmReportPostActionModal
        pendingAction={pendingAction}
        loading={!!pendingAction && actionDocumentId === pendingAction.group.targetDocumentId}
        onCancel={() => {
          if (!actionDocumentId) {
            setPendingAction(null);
          }
        }}
        onConfirm={() => {
          void onConfirmAction();
        }}
      />
    </Card>
  );
}
