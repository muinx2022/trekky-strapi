"use client";

import { useEffect, useState } from "react";
import { Search, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listUsers, type UserItem } from "@/lib/admin-api";

type PostAuthorPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (user: UserItem) => void;
};

export function PostAuthorPicker({ open, onClose, onSelect }: PostAuthorPickerProps) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await listUsers(1, 20, query);
        setRows(result.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [open, query]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-lg border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">Select Author</p>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search username or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {rows.map((user) => (
              <button
                key={user.id}
                type="button"
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-accent"
                onClick={() => {
                  onSelect(user);
                  onClose();
                }}
              >
                <div>
                  <p className="text-sm font-medium">{user.username}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
            {!loading && rows.length === 0 && (
              <p className="text-sm text-muted-foreground">No users found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
