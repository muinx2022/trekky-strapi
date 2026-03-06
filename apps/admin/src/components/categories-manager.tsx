"use client";

import Link from "next/link";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAction } from "@/components/icon-action";
import {
  deleteCategory,
  listAllCategories,
  publishCategory,
  reorderCategory,
  unpublishCategory,
  type CategoryItem,
} from "@/lib/admin-api";

function toPlainText(value?: string) {
  return (value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function CategoryRow({
  item,
  level,
  onTogglePublished,
  onDelete,
  togglingDocumentId,
  renderChildren,
  isDragging,
}: {
  item: CategoryItem;
  level: number;
  onTogglePublished: (item: CategoryItem) => void;
  onDelete: (item: CategoryItem) => void;
  togglingDocumentId: string | null;
  renderChildren: ReactNode;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging: isBeingDragged } = useDraggable({
    id: `cat-${item.id}`,
    data: { item },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-child-${item.id}`,
    data: { type: "child" as const, targetId: item.id },
  });

  return (
    <div className="space-y-1">
      <div
        ref={setDropRef}
        className={`group grid grid-cols-[20px_minmax(240px,1.8fr)_minmax(140px,1fr)_minmax(140px,1fr)_110px_110px_120px] items-start gap-3 rounded-md border p-3 text-sm transition-colors ${
          isBeingDragged ? "opacity-50 bg-muted/50" : isOver ? "bg-blue-50 dark:bg-blue-900/20" : "bg-background hover:bg-muted/50"
        }`}
        style={{ marginLeft: `${level * 20}px` }}
      >
        <div
          ref={setDragRef}
          {...attributes}
          {...listeners}
          className="flex cursor-grab touch-none select-none pt-0.5 text-muted-foreground/70 active:cursor-grabbing"
          title="Drag to move"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium">{item.name}</p>
          {item.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{toPlainText(item.description)}</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">Drop here to make child of {item.name}</p>
        </div>
        <div className="text-muted-foreground">{item.slug}</div>
        <div className="text-muted-foreground">{item.parent?.name ?? "-"}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              item.publishedAt ? "bg-emerald-600" : "bg-muted-foreground/30"
            }`}
            onClick={() => onTogglePublished(item)}
            disabled={togglingDocumentId === item.documentId}
            title={item.publishedAt ? "Published" : "Draft"}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-background shadow transition-transform ${
                item.publishedAt ? "translate-x-[14px]" : "translate-x-0.5"
              }`}
            />
            <span className="sr-only">{item.publishedAt ? "Published" : "Draft"}</span>
          </button>
          <span className="text-xs text-muted-foreground">{item.publishedAt ? "Published" : "Draft"}</span>
        </div>
        <div className="text-muted-foreground">{formatDate(item.updatedAt)}</div>
        <div className="flex justify-end gap-1.5 opacity-100 pointer-events-auto transition-opacity duration-150 md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto">
          <IconAction label="Edit category" icon={<Pencil />} href={`/categories/${item.documentId}/edit`} variant="outline" size="icon-xs" />
          <IconAction label="Delete category" icon={<Trash2 />} onClick={() => onDelete(item)} variant="destructive" size="icon-xs" />
        </div>
      </div>

      <DroppableAfterLine itemId={item.id} level={level} isDragging={isDragging} />

      {renderChildren}
    </div>
  );
}

function DroppableAfterLine({ itemId, level, isDragging }: { itemId: number; level: number; isDragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `after-${itemId}`,
    data: { type: "after" as const, targetId: itemId },
  });

  if (!isDragging) return null;

  return (
    <div
      ref={setNodeRef}
      className={`h-3 rounded border border-dashed transition-colors ${
        isOver ? "border-blue-400 bg-blue-100 dark:bg-blue-900/30" : "border-muted-foreground/40 bg-muted/30"
      }`}
      style={{ marginLeft: `${level * 20}px` }}
      title="Drop after to reorder"
    />
  );
}

function DroppableRootZone({ isDragging }: { isDragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "root",
    data: { type: "root" as const },
  });

  if (!isDragging) return null;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border border-dashed px-3 py-2 text-xs font-medium transition-colors ${
        isOver ? "border-blue-500 bg-blue-100 dark:bg-blue-900/40" : "border-blue-400/70 bg-blue-50/40 text-blue-700"
      }`}
    >
      Drop here to make root category
    </div>
  );
}

export function CategoriesManager() {
  const [rows, setRows] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingDocumentId, setTogglingDocumentId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAllCategories();
      setRows(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const orderedRows = useMemo(
    () => [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [rows]
  );

  const childrenByParentId = useMemo(() => {
    const map = new Map<number | null, CategoryItem[]>();
    for (const item of orderedRows) {
      const parentId = item.parent?.id ?? null;
      const bucket = map.get(parentId) ?? [];
      bucket.push(item);
      map.set(parentId, bucket);
    }
    return map;
  }, [orderedRows]);

  const onDelete = async (item: CategoryItem) => {
    if (!confirm(`Delete category "${item.name}"?`)) return;
    try {
      await deleteCategory(item.documentId);
      toast({ title: "Category deleted", variant: "success" });
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete category");
      toast({ title: "Failed to delete category", description: deleteError instanceof Error ? deleteError.message : undefined, variant: "error" });
    }
  };

  const onDrop = useCallback(async (targetId: number, position: "child" | "after") => {
    const draggedId = activeId ? parseInt(String(activeId).replace("cat-", ""), 10) : null;
    if (!draggedId || draggedId === targetId) return;
    try {
      await reorderCategory(draggedId, targetId, position);
      setActiveId(null);
      toast({ title: "Category order updated", variant: "success" });
      await load();
    } catch (dropError) {
      setError(dropError instanceof Error ? dropError.message : "Failed to reorder category");
      toast({ title: "Failed to reorder category", description: dropError instanceof Error ? dropError.message : undefined, variant: "error" });
    }
  }, [activeId, load]);

  const onDropRoot = useCallback(async () => {
    const draggedId = activeId ? parseInt(String(activeId).replace("cat-", ""), 10) : null;
    if (!draggedId) return;
    try {
      await reorderCategory(draggedId, null, "root");
      setActiveId(null);
      toast({ title: "Category moved to root", variant: "success" });
      await load();
    } catch (dropError) {
      setError(dropError instanceof Error ? dropError.message : "Failed to move category to root");
      toast({ title: "Failed to move category", description: dropError instanceof Error ? dropError.message : undefined, variant: "error" });
    }
  }, [activeId, load]);

  const onTogglePublished = async (item: CategoryItem) => {
    try {
      setTogglingDocumentId(item.documentId);
      const updated = item.publishedAt ? await unpublishCategory(item.documentId) : await publishCategory(item.documentId);
      setRows((prev) =>
        prev.map((row) =>
          row.documentId === item.documentId ? { ...row, publishedAt: updated.publishedAt ?? null, updatedAt: updated.updatedAt } : row
        )
      );
      toast({ title: updated.publishedAt ? "Category published" : "Category moved to draft", variant: "success" });
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to change publish status");
      toast({ title: "Failed to change status", description: toggleError instanceof Error ? toggleError.message : undefined, variant: "error" });
    } finally {
      setTogglingDocumentId(null);
    }
  };

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { over } = event;
      if (!over) {
        setActiveId(null);
        return;
      }
      const overId = over.id as string;
      const overData = over.data?.current;
      if (overId === "root" || overData?.type === "root") {
        await onDropRoot();
        return;
      }
      if (overData?.type === "after" && overData?.targetId) {
        await onDrop(overData.targetId, "after");
        return;
      }
      if (overData?.type === "child" && overData?.targetId) {
        await onDrop(overData.targetId, "child");
        return;
      }
      if (overId.startsWith("drop-child-")) {
        const targetId = parseInt(overId.replace("drop-child-", ""), 10);
        if (!Number.isNaN(targetId)) await onDrop(targetId, "child");
      }
      setActiveId(null);
    },
    [onDrop, onDropRoot]
  );

  const renderTree = useCallback(
    (parentId: number | null, level: number, visited = new Set<number>()): ReactNode => {
      const nodes = childrenByParentId.get(parentId) ?? [];
      const isDragging = !!activeId;
      return nodes.map((item) => {
        if (visited.has(item.id)) {
          return (
            <div key={item.documentId} className="space-y-1">
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                âš ï¸ Circular reference: {item.name}
              </div>
            </div>
          );
        }
        const newVisited = new Set(visited);
        newVisited.add(item.id);

        return (
          <CategoryRow
            key={item.documentId}
            item={item}
            level={level}
            onTogglePublished={onTogglePublished}
            onDelete={onDelete}
            togglingDocumentId={togglingDocumentId}
            renderChildren={renderTree(item.id, level + 1, newVisited)}
            isDragging={isDragging}
          />
        );
      });
    },
    [childrenByParentId, onTogglePublished, onDelete, togglingDocumentId, activeId]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">Categories</CardTitle>
            <p className="text-sm text-muted-foreground">Manage category tree and ordering</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/categories/new" className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              Create Category
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && (
          <DndContext
            sensors={sensors}
            onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-2">
              <div className="grid grid-cols-[20px_minmax(240px,1.8fr)_minmax(140px,1fr)_minmax(140px,1fr)_110px_110px_120px] gap-3 rounded-md border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div />
                <div>Name</div>
                <div>Slug</div>
                <div>Parent</div>
                <div>Status</div>
                <div>Updated</div>
                <div className="text-right">Actions</div>
              </div>
              <DroppableRootZone isDragging={!!activeId} />
              {renderTree(null, 0)}
            </div>
          </DndContext>
        )}
        {rows.length === 0 && !loading && <p className="text-sm text-muted-foreground">No categories yet.</p>}
        <p className="mt-3 text-xs text-muted-foreground">
          Drag category row (grip icon) and drop on another row to set parent-child. Drop on dashed line to reorder.
        </p>
      </CardContent>
    </Card>
  );
}


