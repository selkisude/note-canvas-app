import type { ToolMode } from "../types/noteTypes";

type ToolbarProps = {
  mode: ToolMode;
  setMode: (mode: ToolMode) => void;

  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWidth: () => void;

  addChecklist: () => void;
  addBulletList: () => void;

  clearStrokes: () => void;
  undoLastStroke: () => void;

  addPage: () => void;
  currentPageNumber: number;
  totalPages: number;

  penColor: string;
  setPenColor: (color: string) => void;
  penWidth: number;
  setPenWidth: (width: number) => void;

  highlighterColor: string;
  setHighlighterColor: (color: string) => void;
  highlighterWidth: number;
  setHighlighterWidth: (width: number) => void;

  textColor: string;
  setTextColor: (color: string) => void;
};

export function Toolbar({
  mode,
  setMode,
  zoom,
  zoomIn,
  zoomOut,
  fitToWidth,
  addChecklist,
  addBulletList,
  clearStrokes,
  undoLastStroke,
  addPage,
  currentPageNumber,
  totalPages,
  penColor,
  setPenColor,
  penWidth,
  setPenWidth,
  highlighterColor,
  setHighlighterColor,
  highlighterWidth,
  setHighlighterWidth,
  textColor,
  setTextColor,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <button
        className={mode === "select" ? "active" : ""}
        onClick={() => setMode("select")}
      >
        Düzenle
      </button>

      <button
        className={`mobile-hide ${mode === "pan" ? "active" : ""}`}
        onClick={() => setMode("pan")}
      >
        Kaydır
      </button>

      <button
        className={mode === "pen" ? "active" : ""}
        onClick={() => setMode("pen")}
      >
        Kalem
      </button>

      <button
        className={mode === "highlighter" ? "active" : ""}
        onClick={() => setMode("highlighter")}
      >
        Fosforlu
      </button>

      <button
        className={mode === "eraser" ? "active" : ""}
        onClick={() => setMode("eraser")}
      >
        Silgi
      </button>

      <button
        className={mode === "text" ? "active" : ""}
        onClick={() => setMode("text")}
      >
        + Metin
      </button>

      <button onClick={addChecklist}>+ Checklist</button>
      <button onClick={addBulletList}>+ Liste</button>

      <div className="toolbar-divider" />

      <button onClick={addPage}>+ Sayfa</button>

      <span className="page-counter">
        Sayfa {currentPageNumber} / {totalPages}
      </span>

      <div className="toolbar-divider" />

      <button onClick={undoLastStroke}>Geri Al</button>
      <button onClick={clearStrokes}>Sayfayı Temizle</button>

      <div className="toolbar-divider" />

      <div className="tool-settings">
        <div className="color-picker-wrap">
          <span>Kalem</span>

          <input
            className="color-picker"
            type="color"
            value={penColor}
            onChange={(event) => setPenColor(event.target.value)}
            title="Kalem rengi seç"
          />

          <select
            className="pen-width-select"
            value={penWidth}
            onChange={(event) => setPenWidth(Number(event.target.value))}
          >
            <option value={2}>İnce</option>
            <option value={4}>Orta</option>
            <option value={8}>Kalın</option>
            <option value={14}>Çok kalın</option>
          </select>
        </div>

        <div className="color-picker-wrap">
          <span>Fosforlu</span>

          <input
            className="color-picker"
            type="color"
            value={highlighterColor}
            onChange={(event) => setHighlighterColor(event.target.value)}
            title="Fosforlu rengi seç"
          />

          <select
            className="pen-width-select"
            value={highlighterWidth}
            onChange={(event) => setHighlighterWidth(Number(event.target.value))}
          >
            <option value={10}>İnce</option>
            <option value={18}>Orta</option>
            <option value={28}>Kalın</option>
            <option value={40}>Çok kalın</option>
          </select>
        </div>

        <div className="color-picker-wrap">
          <span>Yazı</span>

          <input
            className="color-picker"
            type="color"
            value={textColor}
            onChange={(event) => setTextColor(event.target.value)}
            title="Yazı rengi seç"
          />
        </div>
      </div>

      <div className="toolbar-divider" />

      <button className="mobile-hide" onClick={zoomOut}>
        -
      </button>

      <span className="page-counter mobile-hide">
        %{Math.round(zoom * 100)}
      </span>

      <button className="mobile-hide" onClick={zoomIn}>
        +
      </button>

      <button className="mobile-hide" onClick={fitToWidth}>
        Sığdır
      </button>
    </div>
  );
}