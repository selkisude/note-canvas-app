export type ToolMode =
  | "select"
  | "text"
  | "pen"
  | "highlighter"
  | "eraser"
  | "pan";

export type ObjectKind = "text" | "list";

export type Point = {
  x: number;
  y: number;
  pressure?: number;
};

export type TextObject = {
  id: string;
  pageId: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize: number;
  color?: string;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type ListItem = {
  id: string;
  text: string;
  checked?: boolean;
};

export type ListObject = {
  id: string;
  pageId: string;
  type: "list";
  listType: "bullet" | "checklist";
  x: number;
  y: number;
  width: number;
  height: number;
  items: ListItem[];
  fontSize: number;
  color?: string;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type StrokeObject = {
  id: string;
  pageId: string;
  type: "stroke";
  points: Point[];
  color: string;
  width: number;
  opacity?: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type Page = {
  id: string;
  noteId: string;
  pageNumber: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
};

export type NoteFile = {
  id: string;
  title: string;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
};

export type Folder = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
};