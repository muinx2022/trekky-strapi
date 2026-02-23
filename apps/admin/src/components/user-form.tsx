"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createUser,
  getUser,
  listRoles,
  updateUser,
  type RoleItem,
  type UserItem,
} from "@/lib/admin-api";

type UserFormProps = {
  mode: "create" | "edit";
  userId?: number;
};

type UserFormData = {
  username: string;
  email: string;
  password: string;
  roleId: string;
  blocked: boolean;
  confirmed: boolean;
};

const emptyForm: UserFormData = {
  username: "",
  email: "",
  password: "",
  roleId: "",
  blocked: false,
  confirmed: true,
};
type UserField = "username" | "email" | "password";
type UserErrors = Partial<Record<UserField, string>>;

function toFormData(item: UserItem): UserFormData {
  return {
    username: item.username ?? "",
    email: item.email ?? "",
    password: "",
    roleId: item.role?.id ? String(item.role.id) : "",
    blocked: Boolean(item.blocked),
    confirmed: Boolean(item.confirmed),
  };
}

export function UserForm({ mode, userId }: UserFormProps) {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [errors, setErrors] = useState<UserErrors>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const roleItems = await listRoles();
        setRoles(roleItems);
        if (mode === "edit" && userId) {
          const user = await getUser(userId);
          setForm(toFormData(user));
        } else {
          setForm(emptyForm);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load user form");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [mode, userId]);

  const validateForm = () => {
    const nextErrors: UserErrors = {};
    if (!form.username.trim()) {
      nextErrors.username = "Username is required";
    }
    if (!form.email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Invalid email format";
    }
    if (mode === "create" && !form.password) {
      nextErrors.password = "Password is required";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateForm()) {
      toast({ title: "Please check input data", variant: "error" });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === "edit" && userId) {
        await updateUser(userId, {
          username: form.username,
          email: form.email,
          password: form.password || undefined,
          roleId: form.roleId ? Number(form.roleId) : undefined,
          blocked: form.blocked,
          confirmed: form.confirmed,
        });
      } else {
        await createUser({
          username: form.username,
          email: form.email,
          password: form.password,
          roleId: form.roleId ? Number(form.roleId) : undefined,
          blocked: form.blocked,
          confirmed: form.confirmed,
        });
      }
      toast({
        title: mode === "edit" ? "User updated" : "User created",
        variant: "success",
      });
      router.push("/users");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save user");
      toast({
        title: "Failed to save user",
        description: submitError instanceof Error ? submitError.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{mode === "edit" ? "Edit User" : "Create User"}</CardTitle>
          <Button variant="outline" asChild>
            <Link href="/users">Back to list</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {!loading && (
          <form className="space-y-3" onSubmit={onSubmit} noValidate>
            <Input
              placeholder="Username"
              value={form.username}
              className={errors.username ? "border-destructive focus-visible:ring-destructive/20" : ""}
              onChange={(event) => setForm((p) => ({ ...p, username: event.target.value }))}
              onBlur={() => {
                if (!form.username.trim()) {
                  setErrors((prev) => ({ ...prev, username: "Username is required" }));
                } else {
                  setErrors((prev) => ({ ...prev, username: undefined }));
                }
              }}
              required
            />
            <Input
              placeholder="Email"
              value={form.email}
              className={errors.email ? "border-destructive focus-visible:ring-destructive/20" : ""}
              onChange={(event) => setForm((p) => ({ ...p, email: event.target.value }))}
              onBlur={() => {
                if (!form.email.trim()) {
                  setErrors((prev) => ({ ...prev, email: "Email is required" }));
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
                  setErrors((prev) => ({ ...prev, email: "Invalid email format" }));
                } else {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              required
              type="email"
            />
            <Input
              placeholder={mode === "edit" ? "Password (leave blank to keep)" : "Password"}
              value={form.password}
              className={errors.password ? "border-destructive focus-visible:ring-destructive/20" : ""}
              onChange={(event) => setForm((p) => ({ ...p, password: event.target.value }))}
              onBlur={() => {
                if (mode === "create" && !form.password) {
                  setErrors((prev) => ({ ...prev, password: "Password is required" }));
                } else {
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              required={mode === "create"}
              type="password"
            />
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.roleId}
              onChange={(event) => setForm((p) => ({ ...p, roleId: event.target.value }))}
            >
              <option value="">No role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.blocked}
                onChange={(event) => setForm((p) => ({ ...p, blocked: event.target.checked }))}
              />
              Blocked
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.confirmed}
                onChange={(event) => setForm((p) => ({ ...p, confirmed: event.target.checked }))}
              />
              Confirmed
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : mode === "edit" ? "Update" : "Create"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
