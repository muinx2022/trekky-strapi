"use client";

import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAction } from "@/components/icon-action";
import { PaginationControls } from "@/components/pagination-controls";
import {
  batchDeleteSeedUsers,
  deleteUser,
  listUsers,
  seedUsers,
  type PaginationMeta,
  type UserItem,
} from "@/lib/admin-api";

type UserTab = "real" | "seed";

const emptyPagination: PaginationMeta = {
  page: 1,
  pageSize: 10,
  pageCount: 1,
  total: 0,
};

function filterUsersBySeedState(rows: UserItem[], isSeeded: boolean) {
  return rows.filter((row) => Boolean(row.isSeeded) === isSeeded);
}

export function UsersManager() {
  const [activeTab, setActiveTab] = useState<UserTab>("real");

  const [realRows, setRealRows] = useState<UserItem[]>([]);
  const [realPagination, setRealPagination] = useState<PaginationMeta>(emptyPagination);
  const [realPage, setRealPage] = useState(1);
  const [realLoading, setRealLoading] = useState(false);
  const [realError, setRealError] = useState<string | null>(null);

  const [seedRows, setSeedRows] = useState<UserItem[]>([]);
  const [seedPagination, setSeedPagination] = useState<PaginationMeta>(emptyPagination);
  const [seedPage, setSeedPage] = useState(1);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const loadReal = useCallback(async () => {
    setRealLoading(true);
    setRealError(null);
    try {
      const result = await listUsers(realPage, 10, "", false);
      setRealRows(filterUsersBySeedState(result.data, false));
      setRealPagination(result.pagination);
    } catch (loadError) {
      setRealError(loadError instanceof Error ? loadError.message : "Failed to load users");
    } finally {
      setRealLoading(false);
    }
  }, [realPage]);

  const loadSeed = useCallback(async () => {
    setSeedLoading(true);
    setSeedError(null);
    try {
      const result = await listUsers(seedPage, 10, "", true);
      setSeedRows(filterUsersBySeedState(result.data, true));
      setSeedPagination(result.pagination);
      setSelectedIds([]);
    } catch (loadError) {
      setSeedError(loadError instanceof Error ? loadError.message : "Failed to load seed users");
    } finally {
      setSeedLoading(false);
    }
  }, [seedPage]);

  useEffect(() => {
    if (activeTab === "real") {
      void loadReal();
      return;
    }
    void loadSeed();
  }, [activeTab, loadReal, loadSeed]);

  const onDelete = async (item: UserItem) => {
    if (!confirm(`Delete user "${item.username}"?`)) {
      return;
    }
    try {
      await deleteUser(item.id);
      toast({ title: "User deleted", variant: "success" });
      if (activeTab === "seed") {
        await loadSeed();
      } else {
        await loadReal();
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete user";
      if (activeTab === "seed") {
        setSeedError(message);
      } else {
        setRealError(message);
      }
      toast({
        title: "Failed to delete user",
        description: message,
        variant: "error",
      });
    }
  };

  const onRunSeed = async () => {
    const raw = prompt("Input seed user count", "20");
    if (raw === null) {
      return;
    }

    const count = Math.trunc(Number(raw));
    if (!Number.isFinite(count) || count < 1 || count > 500) {
      toast({ title: "Count must be between 1 and 500", variant: "error" });
      return;
    }

    try {
      setSeeding(true);
      const result = await seedUsers(count);
      toast({
        title: `Created ${result.createdCount} users`,
        description:
          result.startUsername && result.endUsername
            ? `From ${result.startUsername} to ${result.endUsername}`
            : undefined,
        variant: "success",
      });
      await loadSeed();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to seed users";
      setSeedError(message);
      toast({ title: "Failed to seed users", description: message, variant: "error" });
    } finally {
      setSeeding(false);
    }
  };

  const currentRows = activeTab === "seed" ? seedRows : realRows;
  const currentPagination = activeTab === "seed" ? seedPagination : realPagination;
  const currentLoading = activeTab === "seed" ? seedLoading : realLoading;
  const currentError = activeTab === "seed" ? seedError : realError;

  const allCurrentSelected = useMemo(() => {
    if (activeTab !== "seed" || seedRows.length === 0) {
      return false;
    }
    return seedRows.every((row) => selectedIds.includes(row.id));
  }, [activeTab, seedRows, selectedIds]);

  const toggleSelectAllSeed = () => {
    if (allCurrentSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(seedRows.map((row) => row.id));
  };

  const onBatchDeleteSeed = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    if (!confirm(`Delete ${selectedIds.length} selected seed users?`)) {
      return;
    }

    try {
      setBatchDeleting(true);
      const result = await batchDeleteSeedUsers(selectedIds);
      toast({
        title: `Deleted ${result.deletedCount} users`,
        description: result.skippedCount > 0 ? `${result.skippedCount} skipped` : undefined,
        variant: "success",
      });
      await loadSeed();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to batch delete users";
      setSeedError(message);
      toast({ title: "Failed to batch delete", description: message, variant: "error" });
    } finally {
      setBatchDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">Users</CardTitle>
            <p className="text-sm text-muted-foreground">Manage real users and seed users separately</p>
          </div>
          {activeTab === "real" ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/users/new" className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                Create User
              </Link>
            </Button>
          ) : (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <Button variant="outline" size="sm" onClick={onRunSeed} disabled={seeding || batchDeleting}>
                {seeding ? "Seeding..." : "Run seed user"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onBatchDeleteSeed}
                disabled={selectedIds.length === 0 || batchDeleting || seeding}
              >
                {batchDeleting ? "Deleting..." : `Batch delete (${selectedIds.length})`}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex w-full rounded-md border bg-background p-1 sm:inline-flex sm:w-auto">
          <button
            type="button"
            className={`flex-1 rounded px-3 py-1.5 text-sm transition-colors sm:flex-none ${
              activeTab === "real" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => setActiveTab("real")}
          >
            Real Users
          </button>
          <button
            type="button"
            className={`flex-1 rounded px-3 py-1.5 text-sm transition-colors sm:flex-none ${
              activeTab === "seed" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => setActiveTab("seed")}
          >
            Seed Users
          </button>
        </div>

        {currentLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {currentError && <p className="text-sm text-destructive">{currentError}</p>}

        {activeTab === "seed" && seedRows.length > 0 && (
          <div className="mb-2 flex items-center gap-2">
            <input
              id="seed-select-all"
              type="checkbox"
              checked={allCurrentSelected}
              onChange={toggleSelectAllSeed}
            />
            <label htmlFor="seed-select-all" className="text-sm text-muted-foreground">
              Select all on current page
            </label>
          </div>
        )}

        <div className="space-y-2">
          {currentRows.map((item) => (
            <div key={item.id} className="group flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-3">
                {activeTab === "seed" && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) => {
                      setSelectedIds((prev) => {
                        if (event.target.checked) {
                          return Array.from(new Set([...prev, item.id]));
                        }
                        return prev.filter((id) => id !== item.id);
                      });
                    }}
                  />
                )}
                <div>
                  <Link
                    href={`/users/${item.id}/edit`}
                    className="font-medium text-foreground transition-colors hover:text-primary hover:underline"
                  >
                    {item.username}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    role: {item.role?.name ?? "none"} | blocked: {String(item.blocked)}
                  </p>
                </div>
              </div>
              <div className="pointer-events-none flex gap-1.5 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
                <IconAction
                  label="Edit user"
                  icon={<Pencil />}
                  href={`/users/${item.id}/edit`}
                  variant="outline"
                  size="icon-xs"
                />
                <IconAction
                  label="Delete user"
                  icon={<Trash2 />}
                  onClick={() => onDelete(item)}
                  variant="destructive"
                  size="icon-xs"
                />
              </div>
            </div>
          ))}
          {currentRows.length === 0 && !currentLoading && (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          )}
        </div>

        <PaginationControls
          page={currentPagination.page}
          pageCount={currentPagination.pageCount}
          total={currentPagination.total}
          onPageChange={activeTab === "seed" ? setSeedPage : setRealPage}
        />
      </CardContent>
    </Card>
  );
}

