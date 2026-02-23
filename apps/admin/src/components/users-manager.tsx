"use client";

import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAction } from "@/components/icon-action";
import { PaginationControls } from "@/components/pagination-controls";
import { deleteUser, listUsers, type PaginationMeta, type UserItem } from "@/lib/admin-api";

export function UsersManager() {
  const [rows, setRows] = useState<UserItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers(page, 10);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (item: UserItem) => {
    if (!confirm(`Delete user "${item.username}"?`)) {
      return;
    }
    try {
      await deleteUser(item.id);
      toast({ title: "User deleted", variant: "success" });
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete user");
      toast({
        title: "Failed to delete user",
        description: deleteError instanceof Error ? deleteError.message : undefined,
        variant: "error",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">Users</CardTitle>
            <p className="text-sm text-muted-foreground">Manage user accounts and roles</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/users/new" className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              Create User
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-2">
          {rows.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">
                  {item.username} ({item.email})
                </p>
                <p className="text-sm text-muted-foreground">
                  role: {item.role?.name ?? "none"} | blocked: {String(item.blocked)}
                </p>
              </div>
              <div className="flex gap-2">
                <IconAction
                  label="Edit user"
                  icon={<Pencil />}
                  href={`/users/${item.id}/edit`}
                  variant="outline"
                />
                <IconAction
                  label="Delete user"
                  icon={<Trash2 />}
                  onClick={() => onDelete(item)}
                  variant="destructive"
                />
              </div>
            </div>
          ))}
          {rows.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          )}
        </div>
        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  );
}
