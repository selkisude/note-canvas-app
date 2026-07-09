import type { TextObject as TextObjectType, ToolMode } from "../types/noteTypes";

type Props = {
  object: TextObjectType;
  zoom: number;
  mode: ToolMode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (object: TextObjectType) => void;
  onStartDrag: (
    event: React.PointerEvent<HTMLDivElement>,
    object: TextObjectType
  ) => void;
};

export function TextObject({
  object,
  zoom,
  mode,
  isSelected,
  onSelect,
  onUpdate,
  onStartDrag,
}: Props) {
  const isEditMode = mode === "select";

  return (
    <div
      className={`text-object ${isSelected ? "selected" : ""} ${
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
        <div className="drag-handle" title="Taşı" contentEditable={false}>
          ⋮⋮
        </div>
      )}

      <div
        className="text-content"
        contentEditable={isEditMode}
        suppressContentEditableWarning
        data-placeholder="Yazmaya başla..."
        onBlur={(event) => {
          if (!isEditMode) return;

          onUpdate({
            ...object,
            content: event.currentTarget.innerText,
            height: event.currentTarget.offsetHeight / zoom,
            updatedAt: new Date().toISOString(),
          });
        }}
      >
        {object.content}
      </div>
    </div>
  );
}