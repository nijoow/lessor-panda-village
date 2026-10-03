import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { loadSource } from "./helpers/load-source.mjs";

const { GuestbookSession } = loadSource("src/lib/guestbook/session.ts");
const note = {
  id: "11111111-1111-4111-8111-111111111111",
  body: "안녕",
  authorId: "22222222-2222-4222-8222-222222222222",
  nickname: "밤톨",
  createdAt: 1,
  createdAtCursor: "2026-10-03T00:00:00Z",
  colorKey: "d",
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

function sessionHarness(repository) {
  let board = [],
    cached = null,
    charged = 0,
    status = "idle";
  const session = new GuestbookSession(
    { placeId: "village:guestbook", userId: note.authorId, readOnly: false },
    {
      repository: {
        canWrite: true,
        readPage: async () => board,
        ...repository,
      },
      readCache: () => cached,
      applyBoard(notes, nextStatus, cachedAt, persist) {
        board = notes;
        status = nextStatus;
        if (persist) cached = { notes, savedAt: cachedAt ?? Date.now() };
      },
      setBoardStatus: (next) => {
        status = next;
      },
      confirmWrite: (saved) => {
        board = [saved, ...board.filter((item) => item.id !== saved.id)];
        cached = { notes: board, savedAt: Date.now() };
      },
      confirmDeletion: (id) => {
        board = board.filter((item) => item.id !== id);
        cached = { notes: board, savedAt: Date.now() };
      },
      canAfford: () => true,
      charge: () => {
        charged++;
      },
      notifyPeers() {},
    },
  );
  return {
    session,
    board: () => board,
    charged: () => charged,
    status: () => status,
  };
}

test("changing the filter supersedes pending reads without filtering the physical board", async () => {
  const requests = [];
  const harness = sessionHarness({
    readPage: (_place, author) => {
      const request = { ...deferred(), author };
      requests.push(request);
      return request.promise;
    },
  });
  const reading = harness.session.refresh();
  harness.session.setMineOnly(true);
  assert.equal(requests.length, 3);
  requests[1].resolve([note]);
  const other = {
    ...note,
    id: "33333333-3333-4333-8333-333333333333",
    authorId: "44444444-4444-4444-8444-444444444444",
  };
  requests[2].resolve([other, note]);
  await setImmediate();
  requests[0].resolve([]);
  await reading;
  assert.equal(harness.session.getSnapshot().visibleNotes.length, 1);
  assert.equal(harness.session.getSnapshot().mineOnly, true);
  assert.equal(harness.board().length, 2);
});

test("a deactivated query cannot overwrite the next visitor's board", async () => {
  const request = deferred();
  const harness = sessionHarness({ readPage: () => request.promise });
  const reading = harness.session.refresh();
  harness.session.deactivate();
  request.resolve([note]);
  await reading;
  assert.equal(harness.board().length, 0);
  assert.equal(harness.session.getSnapshot().visibleNotes.length, 0);
});

test("an ambiguous write retry keeps its request ID and charges once after confirmation", async () => {
  const requests = [];
  const harness = sessionHarness({
    create: async (request) => {
      requests.push(request);
      if (requests.length === 1) throw new Error("offline");
      return note;
    },
  });
  assert.equal(await harness.session.submit("안녕"), false);
  assert.equal(harness.charged(), 0);
  assert.equal(await harness.session.submit("안녕"), true);
  assert.equal(requests[0].id, requests[1].id);
  assert.equal(harness.charged(), 1);
  assert.equal(harness.board().length, 1);
});

test("concurrent submits cannot duplicate a charge or write", async () => {
  const request = deferred();
  let writes = 0;
  const harness = sessionHarness({
    create: () => {
      writes++;
      return request.promise;
    },
  });
  const writing = harness.session.submit("안녕");
  assert.equal(await harness.session.submit("안녕"), false);
  assert.equal(harness.charged(), 0);
  request.resolve(note);
  assert.equal(await writing, true);
  assert.equal(writes, 1);
  assert.equal(harness.charged(), 1);
});

test("public snapshots validate rows and never project private author fields", () => {
  const { projectPublicSnapshot } = loadSource("src/lib/guestbook/codec.ts");
  const row = {
    id: note.id,
    body: note.body,
    created_at: note.createdAtCursor,
    author_nickname: note.nickname,
    author_color_index: 2,
    author_id: note.authorId,
    deleted_at: null,
  };
  const result = projectPublicSnapshot(Array.from({ length: 70 }, () => row));
  assert.equal(result.length, 50);
  assert.equal(Object.hasOwn(result[0], "author_id"), false);
  assert.equal(Object.hasOwn(result[0], "deleted_at"), false);
  assert.throws(() => projectPublicSnapshot([null]), /invalid_snapshot_row/);
  assert.throws(
    () => projectPublicSnapshot([{ ...row, author_color_index: 12 }]),
    /invalid_snapshot_row/,
  );
  assert.throws(
    () => projectPublicSnapshot([{ ...row, created_at: "not a date" }]),
    /invalid_snapshot_row/,
  );
});

test("a Realtime error does not revoke authenticated database writes", () => {
  const { worldCapabilities } = loadSource("src/domain/capabilities.ts");
  const session = {
    mode: "online",
    userId: note.authorId,
    nickname: note.nickname,
    worldKey: "panda-village",
  };
  const capabilities = worldCapabilities(session, "error");
  assert.equal(capabilities.canWriteNotes, true);
  assert.equal(capabilities.canChat, false);
  assert.equal(capabilities.canMoveRemotely, false);
  assert.equal(
    worldCapabilities({ ...session, mode: "offline" }, "connected")
      .canWriteNotes,
    false,
  );
});

test("snapshot and chat contracts accept whole Unicode code points up to their SQL limits", () => {
  const { textLength, truncateText } = loadSource("src/domain/text.ts");
  const { projectPublicSnapshot, toGuestbookNote } = loadSource(
    "src/lib/guestbook/codec.ts",
  );
  const body = "🦊".repeat(80),
    nickname = "🐼".repeat(10);
  assert.equal(textLength(body), 80);
  assert.equal(truncateText("🦊가🐼", 2), "🦊가");
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    body,
    author_nickname: nickname,
    author_color_index: 0,
    created_at: "2026-10-03T00:00:00Z",
  };
  assert.equal(projectPublicSnapshot([row])[0].body, body);
  assert.equal(toGuestbookNote(row).nickname, nickname);
  assert.throws(() => projectPublicSnapshot([{ ...row, body: body + "🐼" }]));
  const { decodeChat } = loadSource("src/lib/multiplayer/protocol.ts");
  assert.equal(
    textLength(
      decodeChat(row.id, { nickname, message: "🦊".repeat(101) }, 0).message,
    ),
    100,
  );
});
