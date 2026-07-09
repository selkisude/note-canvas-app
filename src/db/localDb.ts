import Dexie, { type Table } from "dexie";
import type {
  Folder,
  ListObject,
  NoteFile,
  Page,
  StrokeObject,
  TextObject,
} from "../types/noteTypes";

export class NoteCanvasDb extends Dexie {
  folders!: Table<Folder, string>;
  noteFiles!: Table<NoteFile, string>;
  pages!: Table<Page, string>;
  textObjects!: Table<TextObject, string>;
  listObjects!: Table<ListObject, string>;
  strokes!: Table<StrokeObject, string>;

  constructor() {
    super("NoteCanvasDb");

    this.version(1).stores({
      pages: "id, noteId, pageNumber, updatedAt",
      textObjects: "id, pageId, updatedAt",
      strokes: "id, pageId, updatedAt",
    });

    this.version(2).stores({
      pages: "id, noteId, pageNumber, updatedAt",
      textObjects: "id, pageId, updatedAt",
      listObjects: "id, pageId, updatedAt",
      strokes: "id, pageId, updatedAt",
    });

    this.version(3).stores({
      noteFiles: "id, title, folderId, updatedAt",
      pages: "id, noteId, pageNumber, updatedAt",
      textObjects: "id, pageId, updatedAt",
      listObjects: "id, pageId, updatedAt",
      strokes: "id, pageId, updatedAt",
    });

    this.version(4).stores({
      folders: "id, title, updatedAt",
      noteFiles: "id, title, folderId, updatedAt",
      pages: "id, noteId, pageNumber, updatedAt",
      textObjects: "id, pageId, updatedAt",
      listObjects: "id, pageId, updatedAt",
      strokes: "id, pageId, updatedAt",
    });
  }
}

export const db = new NoteCanvasDb();