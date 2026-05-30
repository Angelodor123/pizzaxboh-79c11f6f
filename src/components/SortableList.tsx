import { ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

/**
 * Generic vertical sortable list.
 *
 * Usage:
 *   <SortableList items={shifts} getId={(s) => s.id} onReorder={async (reordered) => ...}>
 *     {(s, handle) => <Row handle={handle}>{s.name}</Row>}
 *   </SortableList>
 */
export function SortableList<T>({
  items,
  getId,
  onReorder,
  children,
  className,
  disabled = false,
}: {
  items: T[];
  getId: (item: T) => string;
  onReorder: (reorderedItems: T[]) => void | Promise<void>;
  children: (item: T, dragHandle: ReactNode) => ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = items.map((it) => getId(it));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    await onReorder(reordered);
  };

  if (disabled) {
    return (
      <div className={className}>
        {items.map((it) => (
          <div key={getId(it)}>{children(it, null)}</div>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((it) => (
            <SortableRow key={getId(it)} id={getId(it)}>
              {(handle) => children(it, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : ("auto" as const),
    opacity: isDragging ? 0.85 : 1,
  };
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      className="h-9 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-neon hover:bg-accent/40 active:bg-accent/60 cursor-grab active:cursor-grabbing touch-none select-none"
      aria-label="גרור לסידור מחדש"
      title="גרור לסידור מחדש"
    >
      <span aria-hidden className="leading-none text-[18px] font-bold tracking-[1px]">⠿</span>
    </button>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}

