"use client";

import { Refine, useList, type BaseRecord } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
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

const queryClient = new QueryClient();
const adminDataProvider = createAdminDataProvider();

type ResourceListPageProps = {
  resource: "management/posts" | "management/categories" | "management/comments";
  title: string;
  fields: { label: string; key: string }[];
};

function toRows<T extends BaseRecord>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === "object" && "data" in value) {
    const nested = (value as { data?: unknown }).data;
    if (Array.isArray(nested)) {
      return nested as T[];
    }
  }
  return [];
}

function ResourceListContent({ resource, title, fields }: ResourceListPageProps) {
  const list = useList<BaseRecord>({ resource, pagination: { pageSize: 20 } });
  const rows = toRows<BaseRecord>(list.result.data);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{resource} from Strapi REST API</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                {fields.map((field) => (
                  <TableHead key={field.key}>{field.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((record) => (
                <TableRow key={record.id}>
                  {fields.map((field) => (
                    <TableCell key={`${record.id}-${field.key}`}>
                      {String(record[field.key] ?? "-")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={fields.length} className="text-muted-foreground">
                    No records yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

export function ResourceListPage(props: ResourceListPageProps) {
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
        <ResourceListContent {...props} />
      </Refine>
    </QueryClientProvider>
  );
}

