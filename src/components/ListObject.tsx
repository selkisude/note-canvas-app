import { useEffect, useState } from "react";
import type {
  ListItem,
  ListObject as ListObjectType,
  ToolMode,
} from "../types/noteTypes";

type Props = {
  object: ListObjectType;
  zoom: number;
  mode: ToolMode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (object: ListObjectType) => void;
  onStartDrag: (
    event: React.PointerEvent<HTMLDivElement>,
    object: ListObjectType
  ) => void;
};

export function ListObject({
  object,
  mode,
  isSelected,
  onSelect,
  onUpdate,
  onStartDrag,
}: Props) {
  const isEditMode = mode === "select";

  const [focusItemId, setFocusItemId] = useState<string | null>(null);

    useEffect(() => {
        if (!focusItemId) return;

        const input = document.querySelector<HTMLInputElement>(
            `[data-list-item-id="${focusItemId}"]`
        );

        if (!input) return;

        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);

        setFocusItemId(null);
        }, [focusItemId, object.items]);

  function updateItemText(itemId: string, text: string) {
    if (!isEditMode) return;

    const updatedItems = object.items.map((item) =>
      item.id === itemId ? { ...item, text } : item
    );

    onUpdate({
      ...object,
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    });
  }

  function toggleChecklistItem(itemId: string) {
    if (!isEditMode) return;

    const updatedItems = object.items.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );

    onUpdate({
      ...object,
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    });
  }

  function addItemAfter(itemId: string) {
    if (!isEditMode) return;

    const newItem: ListItem = {
        id: crypto.randomUUID(),
        text: "",
        checked: false,
    };

    const index = object.items.findIndex((item) => item.id === itemId);
    const updatedItems = [...object.items];

    updatedItems.splice(index + 1, 0, newItem);

    setFocusItemId(newItem.id);

    onUpdate({
        ...object,
        items: updatedItems,
        height: object.height + 38,
        updatedAt: new Date().toISOString(),
    });
  }

  function removeItem(itemId: string) {
    if (!isEditMode) return;
    if (object.items.length === 1) return;

    const updatedItems = object.items.filter((item) => item.id !== itemId);

    onUpdate({
      ...object,
      items: updatedItems,
      height: Math.max(60, object.height - 38),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div
      className={`list-object ${isSelected ? "selected" : ""} ${
        !isEditMode ? "locked" : ""
      }`}
      style={{
        left: object.x,
        top: object.y,
        width: object.width,
        minHeight: object.height,
        fontSize: object.fontSize,
        color: object.color ?? "#111111",
        zIndex: object.zIndex,
        }}
      onPointerDown={(event) => {
        if (!isEditMode) return;

        event.stopPropagation();
        onSelect(object.id);

        const target = event.target as HTMLElement;

        if (target.closest(".drag-handle")) {
          onStartDrag(event, object);
        }
      }}
    >
      {isEditMode && (
        <div className="drag-handle" title="Taşı">
          ⋮⋮
        </div>
      )}

      <div className="list-content">
        {object.items.map((item) => (
          <div className="list-row" key={item.id}>
            {object.listType === "checklist" ? (
              <input
                className="check-input"
                type="checkbox"
                checked={Boolean(item.checked)}
                disabled={!isEditMode}
                onChange={() => toggleChecklistItem(item.id)}
              />
            ) : (
              <span className="bullet-dot">•</span>
            )}

            <input
                className={`list-input ${
                    object.listType === "checklist" && item.checked ? "checked-item" : ""
                }`}
                data-list-item-id={item.id}
                style={{
                    color: object.color ?? "#111111",
                }}
                value={item.text}
                disabled={!isEditMode}
                placeholder={
                    object.listType === "checklist"
                    ? "Yapılacak..."
                    : "Liste maddesi..."
                }
                onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelect(object.id);
                }}
                onChange={(event) => updateItemText(item.id, event.target.value)}
                onKeyDown={(event) => {
                    event.stopPropagation();

                    if (event.key === "Enter") {
                    event.preventDefault();
                    addItemAfter(item.id);
                    }

                    if (
                    event.key === "Backspace" &&
                    item.text.length === 0 &&
                    object.items.length > 1
                    ) {
                    event.preventDefault();
                    removeItem(item.id);
                    }
                }}
                />
          </div>
        ))}
      </div>
    </div>
  );
}