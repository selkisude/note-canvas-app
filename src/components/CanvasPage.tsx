import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/localDb";
import type {
  Folder,
  ListObject as ListObjectType,
  NoteFile,
  ObjectKind,
  Page,
  Point,
  StrokeObject,
  TextObject as TextObjectType,
  ToolMode,
} from "../types/noteTypes";
import { TextObject } from "./TextObject";
import { ListObject } from "./ListObject";
import { Toolbar } from "./Toolbar";

const DEFAULT_FILE_ID = "local-note-1";
const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_GAP = 48;
const LAST_OPEN_STATE_KEY = "note-canvas-last-open-state";

type DragState = {
  id: string;
  kind: ObjectKind;
  pageId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

type HistoryAction =
  | {
      type: "add-text";
      object: TextObjectType;
    }
  | {
      type: "update-text";
      before: TextObjectType;
      after: TextObjectType;
    }
  | {
      type: "delete-text";
      object: TextObjectType;
    }
  | {
      type: "add-list";
      object: ListObjectType;
    }
  | {
      type: "update-list";
      before: ListObjectType;
      after: ListObjectType;
    }
  | {
      type: "delete-list";
      object: ListObjectType;
    }
  | {
      type: "add-stroke";
      stroke: StrokeObject;
    }
  | {
    type: "delete-strokes";
    strokes: StrokeObject[];
    }
  | {
      type: "clear-page";
      pageId: string;
      textObjects: TextObjectType[];
      listObjects: ListObjectType[];
      strokes: StrokeObject[];
    }
  | {
      type: "add-page";
      page: Page;
    };

export function CanvasPage() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null);

  const pinchState = useRef<{
    startDistance: number;
    startZoom: number;
    centerX: number;
    centerY: number;
    contentX: number;
    contentY: number;
  } | null>(null);

  const isPinchingRef = useRef(false);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [files, setFiles] = useState<NoteFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);

  const [mode, setMode] = useState<ToolMode>("select");

  const [zoom, setZoom] = useState(0.65);
  const [panX, setPanX] = useState(40);
  const [panY, setPanY] = useState(40);
  const [penColor, setPenColor] = useState("#111111");
  const [penWidth, setPenWidth] = useState(4);
  const [highlighterColor, setHighlighterColor] = useState("#facc15");
  const [highlighterWidth, setHighlighterWidth] = useState(18);
  const [textColor, setTextColor] = useState("#111111");

  const [textObjects, setTextObjects] = useState<TextObjectType[]>([]);
  const [listObjects, setListObjects] = useState<ListObjectType[]>([]);
  const [strokes, setStrokes] = useState<StrokeObject[]>([]);
  const [currentStroke, setCurrentStroke] = useState<{
    pageId: string;
    points: Point[];
  } | null>(null);

  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);

  const [isPageSelectionMode, setIsPageSelectionMode] = useState(false);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);

  const [isMobilePagesOpen, setIsMobilePagesOpen] = useState(false);

  const activeFolder =
    folders.find((item) => item.id === activeFolderId) ?? null;

  const folderFiles = activeFolderId
    ? files.filter((file) => file.folderId === activeFolderId)
    : [];

  const activeFile =
    files.find((item) => item.id === activeFileId) ?? null;

  const activePage =
    pages.find((item) => item.id === activePageId) ?? pages[0] ?? null;

  useEffect(() => {
    async function init() {
      const now = new Date().toISOString();

      let storedFolders = await db.folders.toArray();

      if (storedFolders.length === 0) {
        const defaultFolder: Folder = {
          id: uuidv4(),
          title: "İlk Klasör",
          createdAt: now,
          updatedAt: now,
        };

        await db.folders.add(defaultFolder);
        storedFolders = [defaultFolder];
      }

      let storedFiles = await db.noteFiles.toArray();

      if (storedFiles.length === 0) {
        const defaultFile: NoteFile = {
          id: DEFAULT_FILE_ID,
          title: "İlk Defter",
          folderId: storedFolders[0].id,
          createdAt: now,
          updatedAt: now,
        };

        await db.noteFiles.add(defaultFile);
        storedFiles = [defaultFile];
      }

      const filesWithoutFolder = storedFiles.filter((file) => !file.folderId);

      if (filesWithoutFolder.length > 0) {
        const updatedFiles = storedFiles.map((file) =>
          file.folderId
            ? file
            : {
                ...file,
                folderId: storedFolders[0].id,
                updatedAt: now,
              }
        );

        await db.noteFiles.bulkPut(updatedFiles);
        storedFiles = updatedFiles;
      }

      const sortedFolders = [...storedFolders].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      );

      const sortedFiles = [...storedFiles].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      );

      setFolders(sortedFolders);
      setFiles(sortedFiles);

      const savedStateRaw = sessionStorage.getItem(LAST_OPEN_STATE_KEY);

      if (savedStateRaw) {
        try {
          const savedState = JSON.parse(savedStateRaw) as {
            folderId?: string | null;
            fileId?: string | null;
            pageId?: string | null;
          };

          const savedFolder = sortedFolders.find(
            (folder) => folder.id === savedState.folderId
          );

          const savedFile = sortedFiles.find(
            (file) =>
              file.id === savedState.fileId &&
              file.folderId === savedState.folderId
          );

          if (savedFolder && savedFile) {
            setActiveFolderId(savedFolder.id);
            await loadFile(savedFile.id, savedState.pageId ?? null);
            setIsInitialLoadDone(true);
            return;
          }

          if (savedFolder) {
            setActiveFolderId(savedFolder.id);
            setActiveFileId(null);
            setPages([]);
            setActivePageId(null);
            setTextObjects([]);
            setListObjects([]);
            setStrokes([]);
            setIsInitialLoadDone(true);
            return;
          }
        } catch {
          sessionStorage.removeItem(LAST_OPEN_STATE_KEY);
        }
      }

      setActiveFolderId(null);
      setActiveFileId(null);
      setPages([]);
      setActivePageId(null);
      setTextObjects([]);
      setListObjects([]);
      setStrokes([]);

      setIsInitialLoadDone(true);
    }

    init();
  }, []);

  useEffect(() => {
  if (mode !== "select") {
    setSelectedTextId(null);
    setSelectedListId(null);
  }
}, [mode]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const activeElement = document.activeElement;

      const isEditing =
        activeElement instanceof HTMLElement &&
        (
          activeElement.classList.contains("text-content") ||
          activeElement.classList.contains("list-input") ||
          activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable
        );

      if (isEditing) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedTextId) {
          event.preventDefault();
          deleteSelectedText();
          return;
        }

        if (selectedListId) {
          event.preventDefault();
          deleteSelectedList();
          return;
        }
      }

      if (event.key === "Escape") {
        setSelectedTextId(null);
        setSelectedListId(null);
        setMode("select");
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTextId, selectedListId, textObjects, listObjects]);

  useEffect(() => {
    if (!activeFileId) return;

    const timer = window.setTimeout(() => {
      fitMobilePageToScreen();
    }, 100);

    window.addEventListener("resize", fitMobilePageToScreen);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", fitMobilePageToScreen);
    };
  }, [activeFileId, activePageId, pages.length]);

  useEffect(() => {
    if (!isInitialLoadDone) return;

    sessionStorage.setItem(
      LAST_OPEN_STATE_KEY,
      JSON.stringify({
        folderId: activeFolderId,
        fileId: activeFileId,
        pageId: activePageId,
      })
    );
  }, [isInitialLoadDone, activeFolderId, activeFileId, activePageId]);

  function pushHistory(action: HistoryAction) {
    setUndoStack((prev) => [...prev, action]);
  }

  async function loadFile(fileId: string, preferredPageId?: string | null) {
    setActiveFileId(fileId);

    let storedPages = await db.pages
      .where("noteId")
      .equals(fileId)
      .sortBy("pageNumber");

    if (storedPages.length === 0) {
      const now = new Date().toISOString();

      const firstPage: Page = {
        id: uuidv4(),
        noteId: fileId,
        pageNumber: 1,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        createdAt: now,
        updatedAt: now,
      };

      await db.pages.add(firstPage);
      storedPages = [firstPage];
    }

    setPages(storedPages);
    const pageToOpen =
      storedPages.find((page) => page.id === preferredPageId) ?? storedPages[0];

    setActivePageId(pageToOpen.id);

    const pageIds = storedPages.map((page) => page.id);

    const storedTextObjects = await db.textObjects
      .where("pageId")
      .anyOf(pageIds)
      .toArray();

    const storedListObjects = await db.listObjects
      .where("pageId")
      .anyOf(pageIds)
      .toArray();

    const storedStrokes = await db.strokes
      .where("pageId")
      .anyOf(pageIds)
      .toArray();

    setTextObjects(storedTextObjects);
    setListObjects(storedListObjects);
    setStrokes(storedStrokes);

    setCurrentStroke(null);
    setSelectedTextId(null);
    setSelectedListId(null);
    setUndoStack([]);
    setMode("select");

    pageRefs.current = {};
  }

  function isMobileViewport() {
    return window.matchMedia("(max-width: 700px)").matches;
  }

  function fitMobilePageToScreen() {
    const viewport = viewportRef.current;
    if (!viewport || !isMobileViewport()) return;

    const availableWidth = viewport.clientWidth - 32;
    const newZoom = availableWidth / PAGE_WIDTH;

    const centeredX = (viewport.clientWidth - PAGE_WIDTH * newZoom) / 2;

    setZoom(newZoom);
    setPanX(centeredX);
    setPanY(24);
  }

  function getTouchDistance(touch1: React.Touch, touch2: React.Touch) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchCenter(touch1: React.Touch, touch2: React.Touch) {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (!isMobileViewport()) return;

    if (event.touches.length !== 2) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const touch1 = event.touches[0];
    const touch2 = event.touches[1];

    const viewportRect = viewport.getBoundingClientRect();
    const center = getTouchCenter(touch1, touch2);

    const centerX = center.x - viewportRect.left;
    const centerY = center.y - viewportRect.top;

    pinchState.current = {
      startDistance: getTouchDistance(touch1, touch2),
      startZoom: zoom,
      centerX,
      centerY,
      contentX: (centerX - panX) / zoom,
      contentY: (centerY - panY) / zoom,
    };

    isPinchingRef.current = true;
    setIsDrawing(false);
    setCurrentStroke(null);
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!isMobileViewport()) return;
    if (!pinchState.current) return;
    if (event.touches.length !== 2) return;

    event.preventDefault();

    const touch1 = event.touches[0];
    const touch2 = event.touches[1];

    const currentDistance = getTouchDistance(touch1, touch2);
    const scale = currentDistance / pinchState.current.startDistance;

    const nextZoom = clamp(pinchState.current.startZoom * scale, 0.25, 4);

    const viewport = viewportRef.current;
    if (!viewport) return;

    const viewportRect = viewport.getBoundingClientRect();
    const center = getTouchCenter(touch1, touch2);

    const centerX = center.x - viewportRect.left;
    const centerY = center.y - viewportRect.top;

    setZoom(nextZoom);
    setPanX(centerX - pinchState.current.contentX * nextZoom);
    setPanY(centerY - pinchState.current.contentY * nextZoom);
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2) {
      pinchState.current = null;
      isPinchingRef.current = false;
    }
  }

  function openFolder(folder: Folder) {
    setActiveFolderId(folder.id);
    setActiveFileId(null);

    setPages([]);
    setActivePageId(null);
    setTextObjects([]);
    setListObjects([]);
    setStrokes([]);
    setCurrentStroke(null);
    setUndoStack([]);
    setMode("select");
    setIsSelectionMode(false);
    setSelectedFolderIds([]);
    setSelectedFileIds([]);
  }

  function closeFolder() {
    setActiveFolderId(null);
    setActiveFileId(null);

    setPages([]);
    setActivePageId(null);
    setTextObjects([]);
    setListObjects([]);
    setStrokes([]);
    setCurrentStroke(null);
    setUndoStack([]);
    setMode("select");

    setIsSelectionMode(false);
    setSelectedFolderIds([]);
    setSelectedFileIds([]);
  }

  function clearLibrarySelection() {
    setSelectedFolderIds([]);
    setSelectedFileIds([]);
    setIsSelectionMode(false);
  }

  function toggleFolderSelection(folderId: string) {
    setSelectedFolderIds((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  }

  function toggleFileSelection(fileId: string) {
    setSelectedFileIds((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  }

  async function createFolder() {
    const folderName = window.prompt("Klasör adı:");

    if (!folderName || folderName.trim().length === 0) return;

    const now = new Date().toISOString();

    const newFolder: Folder = {
      id: uuidv4(),
      title: folderName.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await db.folders.add(newFolder);

    setFolders((prev) =>
      [...prev, newFolder].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      )
    );

    setActiveFolderId(newFolder.id);
    setActiveFileId(null);
  }

  async function renameFolder(folder: Folder) {
    const newName = window.prompt("Yeni klasör adı:", folder.title);

    if (!newName || newName.trim().length === 0) return;

    const updatedFolder: Folder = {
      ...folder,
      title: newName.trim(),
      updatedAt: new Date().toISOString(),
    };

    await db.folders.put(updatedFolder);

    setFolders((prev) =>
      prev.map((item) => (item.id === folder.id ? updatedFolder : item))
    );
  }

  async function createFile() {
    if (!activeFolderId) return;

    const fileName = window.prompt("Defter adı:");

    if (!fileName || fileName.trim().length === 0) return;

    const now = new Date().toISOString();

    const newFile: NoteFile = {
      id: uuidv4(),
      title: fileName.trim(),
      folderId: activeFolderId,
      createdAt: now,
      updatedAt: now,
    };

    await db.noteFiles.add(newFile);

    setFiles((prev) =>
      [...prev, newFile].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      )
    );

    await loadFile(newFile.id);
  }

  async function renameFile(file: NoteFile) {
    const newName = window.prompt("Yeni defter adı:", file.title);

    if (!newName || newName.trim().length === 0) return;

    const updatedFile: NoteFile = {
      ...file,
      title: newName.trim(),
      updatedAt: new Date().toISOString(),
    };

    await db.noteFiles.put(updatedFile);

    setFiles((prev) =>
      prev.map((item) => (item.id === file.id ? updatedFile : item))
    );
  }

  async function openFile(file: NoteFile) {
    if (file.id === activeFileId) return;

    await loadFile(file.id);

    setIsSelectionMode(false);
    setSelectedFolderIds([]);
    setSelectedFileIds([]);
  }

  function closeFile() {
    setActiveFileId(null);
    setPages([]);
    setActivePageId(null);

    setTextObjects([]);
    setListObjects([]);
    setStrokes([]);
    setCurrentStroke(null);

    setSelectedTextId(null);
    setSelectedListId(null);
    setUndoStack([]);

    setMode("select");
  }

  async function renameSelectedFolder() {
    if (selectedFolderIds.length !== 1) return;

    const folder = folders.find((item) => item.id === selectedFolderIds[0]);
    if (!folder) return;

    await renameFolder(folder);
    clearLibrarySelection();
  }

  async function renameSelectedFile() {
    if (selectedFileIds.length !== 1) return;

    const file = files.find((item) => item.id === selectedFileIds[0]);
    if (!file) return;

    await renameFile(file);
    clearLibrarySelection();
  }

  async function deleteSelectedFolders() {
    if (selectedFolderIds.length === 0) return;

    const confirmed = window.confirm(
      `${selectedFolderIds.length} klasör silinsin mi? İçlerindeki tüm defterler, sayfalar ve içerikler silinecek.`
    );

    if (!confirmed) return;

    const foldersToDelete = folders.filter((folder) =>
      selectedFolderIds.includes(folder.id)
    );

    for (const folder of foldersToDelete) {
      const folderFiles = await db.noteFiles
        .where("folderId")
        .equals(folder.id)
        .toArray();

      const fileIds = folderFiles.map((file) => file.id);

      let allPages: Page[] = [];

      if (fileIds.length > 0) {
        allPages = await db.pages.where("noteId").anyOf(fileIds).toArray();
      }

      const pageIds = allPages.map((page) => page.id);

      if (pageIds.length > 0) {
        await db.textObjects.where("pageId").anyOf(pageIds).delete();
        await db.listObjects.where("pageId").anyOf(pageIds).delete();
        await db.strokes.where("pageId").anyOf(pageIds).delete();
      }

      if (fileIds.length > 0) {
        await db.pages.where("noteId").anyOf(fileIds).delete();
        await db.noteFiles.where("folderId").equals(folder.id).delete();
      }

      await db.folders.delete(folder.id);
    }

    setFolders((prev) =>
      prev.filter((folder) => !selectedFolderIds.includes(folder.id))
    );

    setFiles((prev) =>
      prev.filter((file) => !selectedFolderIds.includes(file.folderId ?? ""))
    );

    clearLibrarySelection();
  }

  async function deleteSelectedFiles() {
    if (selectedFileIds.length === 0) return;

    const confirmed = window.confirm(
      `${selectedFileIds.length} defter silinsin mi? İçlerindeki tüm sayfalar ve içerikler silinecek.`
    );

    if (!confirmed) return;

    const filesToDelete = files.filter((file) =>
      selectedFileIds.includes(file.id)
    );

    for (const file of filesToDelete) {
      const filePages = await db.pages.where("noteId").equals(file.id).toArray();
      const pageIds = filePages.map((page) => page.id);

      if (pageIds.length > 0) {
        await db.textObjects.where("pageId").anyOf(pageIds).delete();
        await db.listObjects.where("pageId").anyOf(pageIds).delete();
        await db.strokes.where("pageId").anyOf(pageIds).delete();
      }

      await db.pages.where("noteId").equals(file.id).delete();
      await db.noteFiles.delete(file.id);
    }

    setFiles((prev) => prev.filter((file) => !selectedFileIds.includes(file.id)));

    clearLibrarySelection();
  }

  async function changeTextColor(color: string) {
    setTextColor(color);

    if (selectedTextId) {
      const selectedObject = textObjects.find(
        (item) => item.id === selectedTextId
      );

      if (!selectedObject) return;

      await updateTextObject({
        ...selectedObject,
        color,
        updatedAt: new Date().toISOString(),
      });

      return;
    }

    if (selectedListId) {
      const selectedObject = listObjects.find(
        (item) => item.id === selectedListId
      );

      if (!selectedObject) return;

      await updateListObject({
        ...selectedObject,
        color,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function distanceBetweenPoints(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return distanceBetweenPoints(point, start);
  }

  const t =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) /
    (dx * dx + dy * dy);

  const clampedT = clamp(t, 0, 1);

  const closestPoint = {
    x: start.x + clampedT * dx,
    y: start.y + clampedT * dy,
  };

  return distanceBetweenPoints(point, closestPoint);
}

function isPointNearStroke(point: Point, stroke: StrokeObject, radius: number) {
  if (stroke.points.length === 0) return false;

  if (stroke.points.length === 1) {
    return distanceBetweenPoints(point, stroke.points[0]) <= radius;
  }

  for (let i = 0; i < stroke.points.length - 1; i++) {
    const distance = distanceToSegment(
      point,
      stroke.points[i],
      stroke.points[i + 1]
    );

    if (distance <= radius) {
      return true;
    }
  }

  return false;
}

  function getPagePointFromEvent(
    event: React.PointerEvent<HTMLDivElement>,
    pageId: string
  ) {
    const viewportRect = viewportRef.current?.getBoundingClientRect();
    const pageElement = pageRefs.current[pageId];

    if (!viewportRect || !pageElement) return null;

    const pageRect = pageElement.getBoundingClientRect();

    return {
      x: (event.clientX - pageRect.left) / zoom,
      y: (event.clientY - pageRect.top) / zoom,
    };
  }

  function isInsidePage(point: Point, page: Page) {
    return (
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <= page.width &&
      point.y <= page.height
    );
  }

  async function addTextAt(page: Page, x = 120, y = 120) {
      const now = new Date().toISOString();

      const safeX = clamp(x, 0, page.width - 520);
      const safeY = clamp(y, 0, page.height - 80);

      const textObject: TextObjectType = {
        id: uuidv4(),
        pageId: page.id,
        type: "text",
        x: safeX,
        y: safeY,
        width: 520,
        height: 80,
        content: "",
        fontSize: 28,
        color: textColor,
        zIndex: 10,
        createdAt: now,
        updatedAt: now,
      };

      await db.textObjects.add(textObject);
      setTextObjects((prev) => [...prev, textObject]);

      pushHistory({
        type: "add-text",
        object: textObject,
      });

      setSelectedTextId(textObject.id);
      setSelectedListId(null);
      setActivePageId(page.id);
      setMode("select");
    }

    async function addListAt(
    page: Page,
    listType: "bullet" | "checklist",
    x = 120,
    y = 220
  ) {
    const now = new Date().toISOString();

    const safeX = clamp(x, 0, page.width - 520);
    const safeY = clamp(y, 0, page.height - 100);

    const listObject: ListObjectType = {
      id: uuidv4(),
      pageId: page.id,
      type: "list",
      listType,
      x: safeX,
      y: safeY,
      width: 520,
      height: 120,
      items: [
        {
          id: uuidv4(),
          text: "",
          checked: false,
        },
      ],
      fontSize: 28,
      color: textColor,
      zIndex: 10,
      createdAt: now,
      updatedAt: now,
    };

    await db.listObjects.add(listObject);

    setListObjects((prev) => [...prev, listObject]);

    pushHistory({
      type: "add-list",
      object: listObject,
    });

    setSelectedListId(listObject.id);
    setSelectedTextId(null);
    setActivePageId(page.id);
    setMode("select");
  }

  async function addChecklist() {
    if (!activePage) return;
    await addListAt(activePage, "checklist", 120, 220);
  }

  async function addBulletList() {
    if (!activePage) return;
    await addListAt(activePage, "bullet", 120, 220);
  }

  async function updateListObject(updated: ListObjectType) {
    const before = listObjects.find((item) => item.id === updated.id);

    await db.listObjects.put(updated);

    setListObjects((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );

    if (before) {
      pushHistory({
        type: "update-list",
        before,
        after: updated,
      });
    }
  }

  async function deleteSelectedList() {
    if (!selectedListId) return;

    const objectToDelete = listObjects.find((item) => item.id === selectedListId);
    if (!objectToDelete) return;

    await db.listObjects.delete(selectedListId);

    setListObjects((prev) => prev.filter((item) => item.id !== selectedListId));
    setSelectedListId(null);

    pushHistory({
      type: "delete-list",
      object: objectToDelete,
    });
  }

  async function updateTextObject(updated: TextObjectType) {
    const before = textObjects.find((item) => item.id === updated.id);

    await db.textObjects.put(updated);

    setTextObjects((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );

    if (before) {
      pushHistory({
        type: "update-text",
        before,
        after: updated,
      });
    }
  }

  async function deleteSelectedText() {
    if (!selectedTextId) return;

    const objectToDelete = textObjects.find((item) => item.id === selectedTextId);
    if (!objectToDelete) return;

    await db.textObjects.delete(selectedTextId);

    setTextObjects((prev) => prev.filter((item) => item.id !== selectedTextId));
    setSelectedTextId(null);

    pushHistory({
      type: "delete-text",
      object: objectToDelete,
    });
  }

  function startTextDrag(
    event: React.PointerEvent<HTMLDivElement>,
    object: TextObjectType
  ) {
    event.preventDefault();
    event.stopPropagation();

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    setSelectedTextId(object.id);
    setActivePageId(object.pageId);

    setDragState({
      id: object.id,
      kind: "text",
      pageId: object.pageId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: object.x,
      startY: object.y,
    });
  }

  function startListDrag(
    event: React.PointerEvent<HTMLDivElement>,
    object: ListObjectType
  ) {
    event.preventDefault();
    event.stopPropagation();

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    setSelectedListId(object.id);
    setSelectedTextId(null);
    setActivePageId(object.pageId);

    setDragState({
      id: object.id,
      kind: "list",
      pageId: object.pageId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: object.x,
      startY: object.y,
    });
  }

  async function finishObjectDrag() {
    if (!dragState) return;

    if (dragState.kind === "text") {
      const draggedObject = textObjects.find((item) => item.id === dragState.id);

      if (draggedObject) {
        const before: TextObjectType = {
          ...draggedObject,
          x: dragState.startX,
          y: dragState.startY,
        };

        const after: TextObjectType = {
          ...draggedObject,
          updatedAt: new Date().toISOString(),
        };

        await db.textObjects.put(after);

        pushHistory({
          type: "update-text",
          before,
          after,
        });
      }
    }

    if (dragState.kind === "list") {
      const draggedObject = listObjects.find((item) => item.id === dragState.id);

      if (draggedObject) {
        const before: ListObjectType = {
          ...draggedObject,
          x: dragState.startX,
          y: dragState.startY,
        };

        const after: ListObjectType = {
          ...draggedObject,
          updatedAt: new Date().toISOString(),
        };

        await db.listObjects.put(after);

        pushHistory({
          type: "update-list",
          before,
          after,
        });
      }
    }

    setDragState(null);
  }

  async function addPage() {
    if (!activeFileId) return;
    const now = new Date().toISOString();

    const nextPageNumber =
      pages.length === 0
        ? 1
        : Math.max(...pages.map((item) => item.pageNumber)) + 1;

    const newPage: Page = {
      id: uuidv4(),
      noteId: activeFileId,
      pageNumber: nextPageNumber,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      createdAt: now,
      updatedAt: now,
    };

    await db.pages.add(newPage);

    pushHistory({
      type: "add-page",
      page: newPage,
    });

    const updatedPages = [...pages, newPage].sort(
      (a, b) => a.pageNumber - b.pageNumber
    );

    setPages(updatedPages);
    setActivePageId(newPage.id);
    setSelectedTextId(null);
    setMode("select");

    setTimeout(() => {
      pageRefs.current[newPage.id]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function switchPage(targetPage: Page) {
    setActivePageId(targetPage.id);
    setSelectedTextId(null);
    setIsMobilePagesOpen(false);

    pageRefs.current[targetPage.id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function togglePageSelection(pageId: string) {
    setSelectedPageIds((prev) =>
      prev.includes(pageId)
        ? prev.filter((id) => id !== pageId)
        : [...prev, pageId]
    );
  }

  function clearPageSelection() {
    setSelectedPageIds([]);
    setIsPageSelectionMode(false);
  }

  async function deleteSelectedPages() {
    if (selectedPageIds.length === 0) return;

    const confirmed = window.confirm(
      `${selectedPageIds.length} sayfa silinsin mi? Seçili sayfalardaki tüm içerikler silinecek.`
    );

    if (!confirmed) return;

    for (const pageId of selectedPageIds) {
      await db.textObjects.where("pageId").equals(pageId).delete();
      await db.listObjects.where("pageId").equals(pageId).delete();
      await db.strokes.where("pageId").equals(pageId).delete();
      await db.pages.delete(pageId);
    }

    let updatedPages = pages
      .filter((page) => !selectedPageIds.includes(page.id))
      .map((page, index) => ({
        ...page,
        pageNumber: index + 1,
        updatedAt: new Date().toISOString(),
      }));

    if (updatedPages.length > 0) {
      await db.pages.bulkPut(updatedPages);
    }

    setTextObjects((prev) =>
      prev.filter((item) => !selectedPageIds.includes(item.pageId))
    );
    setListObjects((prev) =>
      prev.filter((item) => !selectedPageIds.includes(item.pageId))
    );
    setStrokes((prev) =>
      prev.filter((item) => !selectedPageIds.includes(item.pageId))
    );

    if (updatedPages.length === 0 && activeFileId) {
      const now = new Date().toISOString();

      const newPage: Page = {
        id: uuidv4(),
        noteId: activeFileId,
        pageNumber: 1,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        createdAt: now,
        updatedAt: now,
      };

      await db.pages.add(newPage);
      updatedPages = [newPage];
    }

    setPages(updatedPages);
    setActivePageId(updatedPages[0]?.id ?? null);

    setSelectedTextId(null);
    setSelectedListId(null);
    setCurrentStroke(null);

    clearPageSelection();
  }

  function handlePagePointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    page: Page
  ) {
    if (isPinchingRef.current) return;
    const point = getPagePointFromEvent(event, page.id);
    if (!point) return;

    setActivePageId(page.id);

    if (mode !== "text") {
      setSelectedTextId(null);
      setSelectedListId(null);
    }

    if (mode === "text") {
      if (!isInsidePage(point, page)) return;
      addTextAt(page, point.x, point.y);
      return;
    }

    if (mode === "pen" || mode === "highlighter") {
      if (!isInsidePage(point, page)) return;

      event.currentTarget.setPointerCapture(event.pointerId);

      setIsDrawing(true);
      setCurrentStroke({
        pageId: page.id,
        points: [
          {
            x: point.x,
            y: point.y,
            pressure: event.pressure,
          },
        ],
      });
    }

    if (mode === "eraser") {
      if (!isInsidePage(point, page)) return;

      event.currentTarget.setPointerCapture(event.pointerId);

      setActivePageId(page.id);
      eraseStrokeAt(page.id, point);
    }
  }

  function handleViewportPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (mode === "pan") {
      event.currentTarget.setPointerCapture(event.pointerId);

      setIsPanning(true);
      lastPanPoint.current = {
        x: event.clientX,
        y: event.clientY,
      };
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState) {
      const page = pages.find((item) => item.id === dragState.pageId);
      if (!page) return;

      const dx = (event.clientX - dragState.startClientX) / zoom;
      const dy = (event.clientY - dragState.startClientY) / zoom;

      if (dragState.kind === "text") {
        setTextObjects((prev) =>
          prev.map((item) => {
            if (item.id !== dragState.id) return item;

            return {
              ...item,
              x: clamp(dragState.startX + dx, 0, page.width - item.width),
              y: clamp(dragState.startY + dy, 0, page.height - item.height),
            };
          })
        );
      }

      if (dragState.kind === "list") {
        setListObjects((prev) =>
          prev.map((item) => {
            if (item.id !== dragState.id) return item;

            return {
              ...item,
              x: clamp(dragState.startX + dx, 0, page.width - item.width),
              y: clamp(dragState.startY + dy, 0, page.height - item.height),
            };
          })
        );
      }

      return;
    }

    if ((mode === "pen" || mode === "highlighter") && isDrawing && currentStroke) {
      const page = pages.find((item) => item.id === currentStroke.pageId);
      if (!page) return;

      const point = getPagePointFromEvent(event, currentStroke.pageId);
      if (!point || !isInsidePage(point, page)) return;

      setCurrentStroke((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          points: [
            ...prev.points,
            {
              x: point.x,
              y: point.y,
              pressure: event.pressure,
            },
          ],
        };
      });

      return;
    }

    if (mode === "eraser") {
      if (!activePageId) return;

      const point = getPagePointFromEvent(event, activePageId);
      const page = pages.find((item) => item.id === activePageId);

      if (!point || !page || !isInsidePage(point, page)) return;

      eraseStrokeAt(activePageId, point);
      return;
    }

    if (mode === "pan" && isPanning && lastPanPoint.current) {
      const dx = event.clientX - lastPanPoint.current.x;
      const dy = event.clientY - lastPanPoint.current.y;

      setPanX((prev) => prev + dx);
      setPanY((prev) => prev + dy);

      lastPanPoint.current = {
        x: event.clientX,
        y: event.clientY,
      };
    }
  }

    async function handlePointerUp() {
      if (dragState) {
        await finishObjectDrag();
      }

      if (
        (mode === "pen" || mode === "highlighter") &&
        currentStroke &&
        currentStroke.points.length > 1
      ) {
        const now = new Date().toISOString();
        const isHighlighter = mode === "highlighter";

        const stroke: StrokeObject = {
          id: uuidv4(),
          pageId: currentStroke.pageId,
          type: "stroke",
          points: currentStroke.points,
          color: isHighlighter ? highlighterColor : penColor,
          width: isHighlighter ? highlighterWidth : penWidth,
          opacity: isHighlighter ? 0.35 : 1,
          zIndex: 20,
          createdAt: now,
          updatedAt: now,
        };

        await db.strokes.add(stroke);
        setStrokes((prev) => [...prev, stroke]);
        pushHistory({
          type: "add-stroke",
          stroke,
        });
      }

      setCurrentStroke(null);
      setIsDrawing(false);
      setIsPanning(false);
      lastPanPoint.current = null;
    }

  async function eraseStrokeAt(pageId: string, point: Point) {
    const eraserRadius = 24;

    const strokesOnPage = strokes.filter((stroke) => stroke.pageId === pageId);

    const strokesToDelete = strokesOnPage.filter((stroke) =>
      isPointNearStroke(point, stroke, eraserRadius)
    );

    if (strokesToDelete.length === 0) return;

    const idsToDelete = strokesToDelete.map((stroke) => stroke.id);

    await db.strokes.bulkDelete(idsToDelete);

    setStrokes((prev) =>
      prev.filter((stroke) => !idsToDelete.includes(stroke.id))
    );

    pushHistory({
      type: "delete-strokes",
      strokes: strokesToDelete,
    });

  }

  async function undoLastAction() {
    const lastAction = undoStack[undoStack.length - 1];
    if (!lastAction) return;

    setUndoStack((prev) => prev.slice(0, -1));

    if (lastAction.type === "add-text") {
      await db.textObjects.delete(lastAction.object.id);

      setTextObjects((prev) =>
        prev.filter((item) => item.id !== lastAction.object.id)
      );

      setSelectedTextId(null);
      return;
    }

    if (lastAction.type === "update-text") {
      await db.textObjects.put(lastAction.before);

      setTextObjects((prev) =>
        prev.map((item) =>
          item.id === lastAction.before.id ? lastAction.before : item
        )
      );

      setSelectedTextId(lastAction.before.id);
      setSelectedListId(null);
      return;
    }

    if (lastAction.type === "delete-text") {
      await db.textObjects.add(lastAction.object);

      setTextObjects((prev) => [...prev, lastAction.object]);

      setSelectedTextId(lastAction.object.id);
      setSelectedListId(null);
      return;
    }

    if (lastAction.type === "add-list") {
      await db.listObjects.delete(lastAction.object.id);

      setListObjects((prev) =>
        prev.filter((item) => item.id !== lastAction.object.id)
      );

      setSelectedListId(null);
      return;
    }

    if (lastAction.type === "update-list") {
      await db.listObjects.put(lastAction.before);

      setListObjects((prev) =>
        prev.map((item) =>
          item.id === lastAction.before.id ? lastAction.before : item
        )
      );

      setSelectedListId(lastAction.before.id);
      setSelectedTextId(null);
      return;
    }

    if (lastAction.type === "delete-list") {
      await db.listObjects.add(lastAction.object);

      setListObjects((prev) => [...prev, lastAction.object]);

      setSelectedListId(lastAction.object.id);
      setSelectedTextId(null);
      return;
    }

    if (lastAction.type === "add-stroke") {
      await db.strokes.delete(lastAction.stroke.id);

      setStrokes((prev) =>
        prev.filter((item) => item.id !== lastAction.stroke.id)
      );

      return;
    }

    if (lastAction.type === "delete-strokes") {
      await db.strokes.bulkAdd(lastAction.strokes);

      setStrokes((prev) => [...prev, ...lastAction.strokes]);

      return;
    }

    if (lastAction.type === "clear-page") {
      if (lastAction.textObjects.length > 0) {
        await db.textObjects.bulkAdd(lastAction.textObjects);
      }

      if (lastAction.listObjects.length > 0) {
        await db.listObjects.bulkAdd(lastAction.listObjects);
      }

      if (lastAction.strokes.length > 0) {
        await db.strokes.bulkAdd(lastAction.strokes);
      }

      setTextObjects((prev) => [...prev, ...lastAction.textObjects]);
      setListObjects((prev) => [...prev, ...lastAction.listObjects]);
      setStrokes((prev) => [...prev, ...lastAction.strokes]);

      setActivePageId(lastAction.pageId);
      setSelectedTextId(null);
      setSelectedListId(null);

      return;
    }

    if (lastAction.type === "add-page") {
      await db.pages.delete(lastAction.page.id);

      await db.textObjects.where("pageId").equals(lastAction.page.id).delete();
      await db.listObjects.where("pageId").equals(lastAction.page.id).delete();
      await db.strokes.where("pageId").equals(lastAction.page.id).delete();

      setPages((prev) => prev.filter((item) => item.id !== lastAction.page.id));
      setTextObjects((prev) =>
        prev.filter((item) => item.pageId !== lastAction.page.id)
      );
      setListObjects((prev) =>
        prev.filter((item) => item.pageId !== lastAction.page.id)
      );
      setStrokes((prev) =>
        prev.filter((item) => item.pageId !== lastAction.page.id)
      );

      const remainingPages = pages.filter((item) => item.id !== lastAction.page.id);
      setActivePageId(remainingPages[0]?.id ?? null);

      return;
    }
  }
  
  async function clearStrokes() {
    if (!activePage) return;

    const pageId = activePage.id;

    const textObjectsToDelete = textObjects.filter(
      (item) => item.pageId === pageId
    );

    const listObjectsToDelete = listObjects.filter(
      (item) => item.pageId === pageId
    );

    const strokesToDelete = strokes.filter((item) => item.pageId === pageId);

    const isPageAlreadyEmpty =
      textObjectsToDelete.length === 0 &&
      listObjectsToDelete.length === 0 &&
      strokesToDelete.length === 0;

    if (isPageAlreadyEmpty) return;

    await db.textObjects.where("pageId").equals(pageId).delete();
    await db.listObjects.where("pageId").equals(pageId).delete();
    await db.strokes.where("pageId").equals(pageId).delete();

    setTextObjects((prev) => prev.filter((item) => item.pageId !== pageId));
    setListObjects((prev) => prev.filter((item) => item.pageId !== pageId));
    setStrokes((prev) => prev.filter((item) => item.pageId !== pageId));

    setSelectedTextId(null);
    setSelectedListId(null);
    setCurrentStroke(null);

    pushHistory({
      type: "clear-page",
      pageId,
      textObjects: textObjectsToDelete,
      listObjects: listObjectsToDelete,
      strokes: strokesToDelete,
    });
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    if (event.ctrlKey) {
      const zoomStep = event.deltaY > 0 ? -0.08 : 0.08;

      setZoom((prev) => {
        return Math.min(Math.max(prev + zoomStep, 0.25), 4);
      });

      return;
    }

    if (event.shiftKey) {
      setPanX((prev) => prev - event.deltaY);
      return;
    }

    setPanY((prev) => prev - event.deltaY);
  }

  function zoomIn() {
    setZoom((prev) => Math.min(prev + 0.1, 4));
  }

  function zoomOut() {
    setZoom((prev) => Math.max(prev - 0.1, 0.25));
  }

  function fitToWidth() {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const availableWidth = viewport.clientWidth - 80;
    const newZoom = availableWidth / PAGE_WIDTH;

    setZoom(newZoom);
    setPanX(40);
    setPanY(40);
  }

  if (!activeFolderId) {
    return (
      <div className="app-shell">
        <div className="library-screen">
          <div className="library-header">
            <div>
              <h1>Klasörler</h1>
              <p>Bir klasör seç veya yeni klasör oluştur.</p>
            </div>

            <div className="library-actions">
              {isSelectionMode && (
                <>
                  <span className="selection-count">
                    {selectedFolderIds.length} seçili
                  </span>

                  <button
                    className="library-action-button"
                    disabled={selectedFolderIds.length !== 1}
                    onClick={renameSelectedFolder}
                  >
                    Ad değiştir
                  </button>

                  <button
                    className="library-danger-button"
                    disabled={selectedFolderIds.length === 0}
                    onClick={deleteSelectedFolders}
                  >
                    Sil
                  </button>
                </>
              )}

              <button
                className="library-action-button"
                onClick={() => {
                  setIsSelectionMode((prev) => !prev);
                  setSelectedFolderIds([]);
                  setSelectedFileIds([]);
                }}
              >
                {isSelectionMode ? "Vazgeç" : "Seç"}
              </button>

              {!isSelectionMode && (
                <button className="library-add-button" onClick={createFolder}>
                  + Klasör
                </button>
              )}
            </div>
          </div>

          <div className="notebook-grid">
            {folders.map((folder) => {
              const isSelected = selectedFolderIds.includes(folder.id);

              return (
                <button
                  key={folder.id}
                  className={`notebook-card ${
                    isSelected ? "selected-card" : ""
                  }`}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleFolderSelection(folder.id);
                      return;
                    }

                    openFolder(folder);
                  }}
                >
                  {isSelectionMode && (
                    <div className="selection-indicator">
                      {isSelected ? "✓" : ""}
                    </div>
                  )}

                  <div className="folder-cover">
                    <span>📁</span>
                  </div>

                  <div className="notebook-title">{folder.title}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!activeFileId) {
    return (
      <div className="app-shell">
        <div className="library-screen">
          <div className="library-header">
            <div>
              <button className="back-to-library-button" onClick={closeFolder}>
                ← Klasörler
              </button>

              <h1>{activeFolder?.title ?? "Defterler"}</h1>
              <p>Bu klasördeki defterlerden birini seç.</p>
            </div>

            <div className="library-actions">
              {isSelectionMode && (
                <>
                  <span className="selection-count">
                    {selectedFileIds.length} seçili
                  </span>

                  <button
                    className="library-action-button"
                    disabled={selectedFileIds.length !== 1}
                    onClick={renameSelectedFile}
                  >
                    Ad değiştir
                  </button>

                  <button
                    className="library-danger-button"
                    disabled={selectedFileIds.length === 0}
                    onClick={deleteSelectedFiles}
                  >
                    Sil
                  </button>
                </>
              )}

              <button
                className="library-action-button"
                onClick={() => {
                  setIsSelectionMode((prev) => !prev);
                  setSelectedFolderIds([]);
                  setSelectedFileIds([]);
                }}
              >
                {isSelectionMode ? "Vazgeç" : "Seç"}
              </button>

              {!isSelectionMode && (
                <button className="library-add-button" onClick={createFile}>
                  + Defter
                </button>
              )}
            </div>
          </div>

          <div className="notebook-grid">
            {folderFiles.map((file) => {
              const isSelected = selectedFileIds.includes(file.id);

              return (
                <button
                  key={file.id}
                  className={`notebook-card ${
                    isSelected ? "selected-card" : ""
                  }`}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleFileSelection(file.id);
                      return;
                    }

                    openFile(file);
                  }}
                >
                  {isSelectionMode && (
                    <div className="selection-indicator">
                      {isSelected ? "✓" : ""}
                    </div>
                  )}

                  <div className="notebook-cover">
                    <span>📓</span>
                  </div>

                  <div className="notebook-title">{file.title}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!activePage) {
    return <div className="loading">Yükleniyor...</div>;
  }

  return (
    <div className="app-shell">
      <Toolbar
        mode={mode}
        setMode={setMode}
        zoom={zoom}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        fitToWidth={fitToWidth}
        addChecklist={addChecklist}
        addBulletList={addBulletList}
        clearStrokes={clearStrokes}
        undoLastStroke={undoLastAction}
        addPage={addPage}
        currentPageNumber={activePage.pageNumber}
        totalPages={pages.length}
        penColor={penColor}
        setPenColor={setPenColor}
        penWidth={penWidth}
        setPenWidth={setPenWidth}
        highlighterColor={highlighterColor}
        setHighlighterColor={setHighlighterColor}
        highlighterWidth={highlighterWidth}
        setHighlighterWidth={setHighlighterWidth}
        textColor={textColor}
        setTextColor={changeTextColor}
      />

      <div className="workspace">
        <button
          className="mobile-pages-toggle"
          onClick={() => setIsMobilePagesOpen((prev) => !prev)}
        >
          Sayfalar
        </button>

        <aside
          className={`page-sidebar ${isMobilePagesOpen ? "mobile-open" : ""}`}
        >
          <div className="sidebar-section">
            <button className="back-to-library-button" onClick={closeFile}>
              ← Defterler
            </button>

            <div className="active-notebook-name">
              {activeFile?.title ?? "Defter"}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="page-sidebar-header">
              <div className="page-sidebar-title">Sayfalar</div>

              <button
                className="page-select-button"
                onClick={() => {
                  setIsPageSelectionMode((prev) => !prev);
                  setSelectedPageIds([]);
                }}
              >
                {isPageSelectionMode ? "Vazgeç" : "Seç"}
              </button>
            </div>

            {isPageSelectionMode && (
              <div className="page-selection-actions">
                <span>{selectedPageIds.length} seçili</span>

                <button
                  className="page-delete-button"
                  disabled={selectedPageIds.length === 0}
                  onClick={deleteSelectedPages}
                >
                  Sil
                </button>
              </div>
            )}

            <div className="page-list">
              {pages.map((item) => (
                <div
                  key={item.id}
                  className={`page-thumb page-thumb-with-actions ${
                    activePageId === item.id ? "active" : ""
                  } ${selectedPageIds.includes(item.id) ? "selected-page-thumb" : ""}`}
                  onClick={() => {
                    if (isPageSelectionMode) {
                      togglePageSelection(item.id);
                      return;
                    }

                    switchPage(item);
                  }}
                >
                  {isPageSelectionMode && (
                    <div className="page-selection-indicator">
                      {selectedPageIds.includes(item.id) ? "✓" : ""}
                    </div>
                  )}

                  <div className="page-thumb-preview" />

                  <div className="page-thumb-footer">
                    <span>Sayfa {item.pageNumber}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div
          ref={viewportRef}
          className={`viewport mode-${mode}`}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="pages-stack"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            }}
          >
            {pages.map((item) => {
              const pageTextObjects = textObjects.filter(
                (object) => object.pageId === item.id
              );

              const pageListObjects = listObjects.filter(
                (object) => object.pageId === item.id
              );

              const pageStrokes = strokes.filter(
                (stroke) => stroke.pageId === item.id
              );
              const pageCurrentStroke =
                currentStroke?.pageId === item.id ? currentStroke : null;

              return (
                <div
                  key={item.id}
                  ref={(element) => {
                    pageRefs.current[item.id] = element;
                  }}
                  className={`page ${
                    activePageId === item.id ? "active-page" : ""
                  }`}
                  style={{
                    width: item.width,
                    height: item.height,
                    marginBottom: PAGE_GAP,
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    handlePagePointerDown(event, item);
                  }}
                >
                  <div className="objects-layer">
                    {pageTextObjects.map((object) => (
                      <TextObject
                        key={object.id}
                        object={object}
                        zoom={zoom}
                        mode={mode}
                        isSelected={selectedTextId === object.id}
                        onSelect={setSelectedTextId}
                        onUpdate={updateTextObject}
                        onStartDrag={startTextDrag}
                      />
                    ))}
                    {pageListObjects.map((object) => (
                      <ListObject
                        key={object.id}
                        object={object}
                        zoom={zoom}
                        mode={mode}
                        isSelected={selectedListId === object.id}
                        onSelect={(id) => {
                          setSelectedListId(id);
                          setSelectedTextId(null);
                        }}
                        onUpdate={updateListObject}
                        onStartDrag={startListDrag}
                      />
                    ))}
                  </div>

                  <svg
                    className="drawing-layer"
                    width={item.width}
                    height={item.height}
                    viewBox={`0 0 ${item.width} ${item.height}`}
                  >
                    {pageStrokes.map((stroke) => (
                      <polyline
                        key={stroke.id}
                        points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke={stroke.color}
                        strokeWidth={stroke.width}
                        strokeOpacity={stroke.opacity ?? 1}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}

                    {pageCurrentStroke && (
                      <polyline
                        points={pageCurrentStroke.points
                          .map((p) => `${p.x},${p.y}`)
                          .join(" ")}
                        fill="none"
                        stroke={mode === "highlighter" ? highlighterColor : penColor}
                        strokeWidth={mode === "highlighter" ? highlighterWidth : penWidth}
                        strokeOpacity={mode === "highlighter" ? 0.35 : 1}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>

                  <div className="page-label">Sayfa {item.pageNumber}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}