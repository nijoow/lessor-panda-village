import { MAX_NOTE_LENGTH, NOTE_PAGE_SIZE, type GuestbookNote, type GuestbookStatus } from "@/domain/guestbook";
import type { GuestbookRepository, NoteRequest } from "./repository";

interface Context {
  placeId: string;
  userId: string | null;
  readOnly: boolean;
}

export interface GuestbookPorts {
  repository: GuestbookRepository;
  readCache(): { notes: GuestbookNote[]; savedAt: number } | null;
  applyBoard(notes: GuestbookNote[], status: GuestbookStatus, cachedAt: number | null, persist?: boolean): void;
  setBoardStatus(status: GuestbookStatus): void;
  confirmWrite(note: GuestbookNote): void;
  confirmDeletion(noteId: string): void;
  canAfford(): boolean;
  charge(): void;
  notifyPeers(): void;
}

interface QueryState {
  visibleNotes: GuestbookNote[];
  mineOnly: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  isSubmitting: boolean;
  writeError: string | null;
  deleteError: string | null;
}

const writeMessage = (error: unknown): string => {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (message.includes("world_traces_rate_limit")) return "쪽지는 5초에 한 번 남길 수 있어. 잠시 후 다시 시도해봐.";
  if (message.includes("world_traces_body_length")) return `쪽지는 1~${MAX_NOTE_LENGTH}자로 적어줘.`;
  if (message.includes("row-level security") || message.includes("permission denied")) return "지금은 쪽지를 걸 수 없어. 마을에 다시 연결해봐.";
  return "쪽지를 걸지 못했어. 연결을 확인하고 다시 시도해봐.";
};

/** Owns query generations and confirmed mutations; SDK, persistence and UI are ports. */
export class GuestbookSession {
  private state: QueryState;
  private listeners = new Set<() => void>();
  private token = 0;
  private cursor: GuestbookNote | null = null;
  private pending: NoteRequest | null = null;
  private active = true;

  constructor(private readonly context: Context, private readonly ports: GuestbookPorts) {
    this.state = {
      visibleNotes: ports.readCache()?.notes ?? [], mineOnly: false, hasMore: false,
      isLoadingMore: false, isSubmitting: false, writeError: null, deleteError: null,
    };
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  activate = () => { this.active = true; };
  deactivate = () => { this.active = false; this.cancelReads(); };
  cancelReads = () => { this.token += 1; };

  private update(next: Partial<QueryState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  private load = async (older = false) => {
    if (!this.active || !this.context.placeId) return;
    const token = ++this.token;
    const { placeId, userId, readOnly } = this.context;
    const mineOnly = this.state.mineOnly;
    this.update({ isLoadingMore: older });
    if (!older) this.ports.setBoardStatus("loading");
    try {
      let notes: GuestbookNote[];
      let boardNotes: GuestbookNote[] | null = null;
      let cachedAt: number | null = null;
      if (!readOnly && userId) {
        [notes, boardNotes] = await Promise.all([
          this.ports.repository.readPage(placeId, mineOnly ? userId : undefined, older ? this.cursor : null),
          mineOnly && !older ? this.ports.repository.readPage(placeId).catch(() => null) : Promise.resolve(null),
        ]);
      } else {
        const snapshot = await this.ports.repository.readSnapshot();
        notes = snapshot.notes;
        cachedAt = snapshot.savedAt;
      }
      if (!this.active || token !== this.token) return;
      this.cursor = notes.at(-1) ?? null;
      this.update({
        visibleNotes: older ? [...this.state.visibleNotes, ...notes.filter((note) => !this.state.visibleNotes.some((item) => item.id === note.id))] : notes,
        hasMore: !readOnly && notes.length === NOTE_PAGE_SIZE,
      });
      if (!older && (!mineOnly || boardNotes || readOnly)) {
        this.ports.applyBoard(boardNotes ?? notes, "ready", cachedAt, true);
      } else this.ports.setBoardStatus("ready");
    } catch {
      if (!this.active || token !== this.token) return;
      const cached = !mineOnly && !older ? this.ports.readCache() : null;
      if (cached) {
        this.update({ visibleNotes: cached.notes });
        this.ports.applyBoard(cached.notes, "error", cached.savedAt);
      } else this.ports.setBoardStatus("error");
    } finally {
      if (this.active && token === this.token) this.update({ isLoadingMore: false });
    }
  };

  refresh = () => this.load();
  loadOlder = () => {
    if (this.state.hasMore && !this.state.isLoadingMore) return this.load(true);
  };
  setMineOnly = (selected: boolean) => {
    const mineOnly = selected && !this.context.readOnly;
    if (this.state.mineOnly === mineOnly) return;
    this.cursor = null;
    this.update({ mineOnly, visibleNotes: [], hasMore: false });
    void this.load();
  };

  submit = async (rawBody: string): Promise<boolean> => {
    const { readOnly, userId, placeId } = this.context;
    if (!this.active || this.state.isSubmitting || readOnly || !userId || !placeId) return false;
    const body = rawBody.trim();
    if (!body || body.length > MAX_NOTE_LENGTH) {
      this.update({ writeError: `쪽지는 1~${MAX_NOTE_LENGTH}자로 적어줘.` });
      return false;
    }
    if (!this.ports.canAfford()) {
      this.update({ writeError: "죽순이 필요해. 대나무 숲에서 죽순을 모아봐." });
      return false;
    }
    this.update({ isSubmitting: true, writeError: null });
    if (!this.pending || this.pending.body !== body) this.pending = { id: crypto.randomUUID(), body, userId, placeId };
    try {
      const note = await this.ports.repository.create(this.pending);
      if (!this.active) return false;
      this.cancelReads();
      this.ports.confirmWrite(note);
      this.ports.charge();
      this.pending = null;
      await this.load();
      this.ports.notifyPeers();
      return true;
    } catch (error) {
      if (this.active) this.update({ writeError: writeMessage(error) });
      return false;
    } finally {
      if (this.active) this.update({ isSubmitting: false });
    }
  };

  remove = async (noteId: string) => {
    if (!this.active || this.context.readOnly || !this.context.userId) return;
    this.update({ deleteError: null });
    try {
      await this.ports.repository.remove(noteId, this.context.userId);
      if (!this.active) return;
      this.cancelReads();
      this.ports.confirmDeletion(noteId);
      this.update({ visibleNotes: this.state.visibleNotes.filter((note) => note.id !== noteId) });
      this.ports.notifyPeers();
      await this.load();
    } catch {
      if (this.active) this.update({ deleteError: "쪽지를 지우지 못했어. 연결을 확인하고 다시 시도해봐." });
    }
  };
}
