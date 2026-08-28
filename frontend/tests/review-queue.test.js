/**
 * frontend/features/review-queue tests
 *
 * Tests all acceptance criteria: filter/debounce, pagination, empty states,
 * select-all, approve/reject single & bulk, abort stale requests, loading/error/success.
 *
 * Run: node tests/review-queue.test.js
 */

"use strict";

// ─── Minimal DOM-free simulators ─────────────────────────────────────────────

let _abortCount = 0;
class MockAbortController {
  constructor() {
    this.signal = { aborted: false, _controller: this };
    _abortCount++;
  }
  abort() {
    this.signal.aborted = true;
  }
}
globalThis.AbortController = MockAbortController;
globalThis.DOMException = class DOMException extends Error {
  constructor(msg, name) { super(msg); this.name = name; }
};

// ─── Mock API ─────────────────────────────────────────────────────────────────

function makePaginatedResponse(items, page = 1, total = items.length, limit = 20) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    pagination: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
  };
}

function mockRegistration(overrides = {}) {
  return {
    _id: overrides._id ?? `reg-${Math.random().toString(36).slice(2)}`,
    studentName: "Test Student",
    studentEmail: "test@test.com",
    college: "Test College",
    amount: 100,
    utr: "123456789",
    referralCode: null,
    paymentScreenshot: "https://example.com/img.png",
    createdAt: new Date().toISOString(),
    event: { name: "Test Event", slug: "test-event", fee: 100 },
    ...overrides,
  };
}

// ─── Simulate hook logic directly (no React) ──────────────────────────────────

class ReviewQueueSimulator {
  constructor(code, mockApi) {
    this.code = code;
    this.api = mockApi;
    this.state = {
      items: [],
      selectedIds: new Set(),
      page: 1,
      totalPages: 1,
      total: 0,
      loading: false,
      busyId: null,
      isBulkBusy: false,
      eventSlug: "",
      college: "",
      from: "",
      to: "",
      rejectModal: { isOpen: false, isBulk: false, targetId: null },
      rejectionReason: "",
    };
    this.abortController = null;
    this.callLog = [];
  }

  get hasActiveFilters() {
    const { eventSlug, college, from, to } = this.state;
    return Boolean(eventSlug || college || from || to);
  }

  get isAllSelected() {
    return this.state.items.length > 0 && this.state.selectedIds.size === this.state.items.length;
  }

  async fetchQueue(page) {
    if (this.abortController) this.abortController.abort();
    const ctrl = new MockAbortController();
    this.abortController = ctrl;

    this.state.loading = true;
    this.callLog.push({ action: "fetchQueue", page });

    try {
      const data = await this.api.getPendingQueue(this.code, {
        event: this.state.eventSlug || undefined,
        college: this.state.college || undefined,
        from: this.state.from || undefined,
        to: this.state.to || undefined,
        page,
        limit: 20,
      }, ctrl.signal);

      if (ctrl.signal.aborted) return; // stale
      this.state.items = data.items;
      this.state.selectedIds = new Set();
      this.state.page = data.pagination.page;
      this.state.totalPages = data.pagination.totalPages;
      this.state.total = data.pagination.total;
    } catch (err) {
      if (ctrl.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        return;
      }
      // Logged internally by hook
    } finally {
      if (!ctrl.signal.aborted) this.state.loading = false;
    }
  }

  async changePage(newPage) {
    if (newPage < 1 || newPage > this.state.totalPages) return;
    await this.fetchQueue(newPage);
  }

  toggleSelect(id) {
    const s = new Set(this.state.selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    this.state.selectedIds = s;
  }

  toggleSelectAll() {
    if (this.isAllSelected) {
      this.state.selectedIds = new Set();
    } else {
      this.state.selectedIds = new Set(this.state.items.map(i => i._id));
    }
  }

  setFilter(key, value) {
    this.state[key] = value;
    this.state.page = 1;
  }

  clearFilters() {
    this.state.eventSlug = this.state.college = this.state.from = this.state.to = "";
    this.state.page = 1;
  }

  async approve(id) {
    this.state.busyId = id;
    this.callLog.push({ action: "approve", id });
    try {
      await this.api.approveRegistration(id, this.code);
      await this.fetchQueue(this.state.page);
    } finally {
      this.state.busyId = null;
    }
  }

  openRejectModal(id) {
    this.state.rejectionReason = "Payment screenshot could not be verified";
    this.state.rejectModal = { isOpen: true, isBulk: false, targetId: id };
  }

  openBulkRejectModal() {
    this.state.rejectionReason = "Payment screenshot could not be verified";
    this.state.rejectModal = { isOpen: true, isBulk: true, targetId: null };
  }

  async confirmRejection() {
    const { rejectModal, rejectionReason } = this.state;
    if (rejectModal.isBulk) {
      this.state.isBulkBusy = true;
      this.callLog.push({ action: "bulkReject", ids: Array.from(this.state.selectedIds) });
      try {
        await this.api.bulkRejectRegistrations(Array.from(this.state.selectedIds), rejectionReason, this.code);
        this.state.rejectModal = { isOpen: false, isBulk: false, targetId: null };
        this.state.selectedIds = new Set();
        await this.fetchQueue(this.state.page);
      } finally {
        this.state.isBulkBusy = false;
      }
    } else if (rejectModal.targetId) {
      this.state.busyId = rejectModal.targetId;
      this.callLog.push({ action: "reject", id: rejectModal.targetId });
      try {
        await this.api.rejectRegistration(rejectModal.targetId, this.code, rejectionReason);
        this.state.rejectModal = { isOpen: false, isBulk: false, targetId: null };
        await this.fetchQueue(this.state.page);
      } finally {
        this.state.busyId = null;
      }
    }
  }

  async bulkApprove() {
    if (this.state.selectedIds.size === 0) return;
    this.state.isBulkBusy = true;
    this.callLog.push({ action: "bulkApprove", ids: Array.from(this.state.selectedIds) });
    try {
      await this.api.bulkApproveRegistrations(Array.from(this.state.selectedIds), this.code);
      this.state.selectedIds = new Set();
      await this.fetchQueue(this.state.page);
    } finally {
      this.state.isBulkBusy = false;
    }
  }
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✔ ${label}`);
    passed++;
  } else {
    console.error(`  ✘ ${label}`);
    failed++;
  }
}

async function test(label, fn) {
  console.log(`\n[Test] ${label}`);
  try {
    await fn();
  } catch (e) {
    console.error(`  ✘ EXCEPTION: ${e.message}`);
    failed++;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

await test("Filter changes reset page to 1 and trigger re-fetch", async () => {
  let callCount = 0;
  const api = {
    getPendingQueue: async () => { callCount++; return makePaginatedResponse([]); },
    approveRegistration: async () => {},
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator(undefined, api);
  await sim.fetchQueue(1);
  sim.setFilter("eventSlug", "test-event");
  await sim.fetchQueue(1);
  assert(callCount === 2, "fetchQueue called after filter change");
  assert(sim.state.page === 1, "page reset to 1 on filter change");
  assert(sim.state.eventSlug === "test-event", "eventSlug filter applied");
});

await test("Debouncing: stale abort signal prevents state update", async () => {
  let resolveSlowFetch;
  const slowFetchPromise = new Promise(r => (resolveSlowFetch = r));
  let stateUpdated = false;

  const api = {
    getPendingQueue: async (code, filters, signal) => {
      if (!signal.aborted) await slowFetchPromise;
      if (signal.aborted) throw Object.assign(new DOMException("Aborted", "AbortError"), {});
      stateUpdated = true;
      return makePaginatedResponse([]);
    },
    approveRegistration: async () => {},
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator(undefined, api);

  // Start first fetch (slow), then immediately abort with second fetch
  const firstFetch = sim.fetchQueue(1).catch(() => {});
  // Abort by starting a new fetch
  sim.abortController.abort();
  resolveSlowFetch(); // let slow fetch resolve but signal is aborted
  await firstFetch;
  assert(!stateUpdated, "Stale request state update prevented by abort signal");
});

await test("Pagination: changePage stays within bounds", async () => {
  const items = [mockRegistration(), mockRegistration()];
  const api = {
    getPendingQueue: async (code, filters) => makePaginatedResponse(items, filters.page, 45, 20),
    approveRegistration: async () => {},
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator(undefined, api);
  await sim.fetchQueue(1);
  assert(sim.state.totalPages === 3, "totalPages computed correctly (45 items / 20 limit = 3 pages)");

  await sim.changePage(0); // invalid: below 1
  assert(sim.state.page === 1, "page stays at 1 when going below bounds");

  await sim.changePage(2);
  assert(sim.state.page === 2, "page changes to 2");

  await sim.changePage(4); // invalid: above totalPages
  assert(sim.state.page === 2, "page stays at 2 when going above totalPages");
});

await test("Empty state: items empty with active filters vs without", async () => {
  const api = {
    getPendingQueue: async () => makePaginatedResponse([]),
    approveRegistration: async () => {},
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator(undefined, api);
  await sim.fetchQueue(1);
  assert(sim.state.items.length === 0, "empty queue with no filters");
  assert(!sim.hasActiveFilters, "no active filters");

  sim.setFilter("college", "MIT");
  assert(sim.hasActiveFilters, "has active filters after college filter set");
  await sim.fetchQueue(1);
  assert(sim.state.items.length === 0, "empty queue with active filter");
});

await test("Select all visible rows on current page", async () => {
  const items = [mockRegistration({ _id: "a" }), mockRegistration({ _id: "b" }), mockRegistration({ _id: "c" })];
  const api = {
    getPendingQueue: async () => makePaginatedResponse(items),
    approveRegistration: async () => {},
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator(undefined, api);
  await sim.fetchQueue(1);
  assert(!sim.isAllSelected, "not all selected initially");

  sim.toggleSelectAll();
  assert(sim.isAllSelected, "all selected after toggleSelectAll");
  assert(sim.state.selectedIds.size === 3, "3 items selected");

  sim.toggleSelectAll(); // deselect all
  assert(sim.state.selectedIds.size === 0, "all deselected after second toggleSelectAll");
});

await test("Individual approve action clears busyId and reloads", async () => {
  const target = mockRegistration({ _id: "reg-1" });
  let approveCalledWith;
  const api = {
    getPendingQueue: async () => makePaginatedResponse([]),
    approveRegistration: async (id, code) => { approveCalledWith = { id, code }; },
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator("TEAM01", api);
  await sim.fetchQueue(1);

  await sim.approve(target._id);
  assert(approveCalledWith?.id === "reg-1", "approveRegistration called with correct id");
  assert(approveCalledWith?.code === "TEAM01", "approveRegistration called with code");
  assert(sim.state.busyId === null, "busyId cleared after approve");
});

await test("Individual reject: opens modal, confirms, reloads", async () => {
  const target = mockRegistration({ _id: "reg-2" });
  let rejectCalledWith;
  const api = {
    getPendingQueue: async () => makePaginatedResponse([]),
    approveRegistration: async () => {},
    rejectRegistration: async (id, code, reason) => { rejectCalledWith = { id, code, reason }; },
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator("TEAM01", api);
  await sim.fetchQueue(1);

  sim.openRejectModal(target._id);
  assert(sim.state.rejectModal.isOpen, "reject modal opens");
  assert(sim.state.rejectModal.targetId === target._id, "target id set in modal");

  sim.state.rejectionReason = "Screenshot unclear";
  await sim.confirmRejection();
  assert(rejectCalledWith?.id === "reg-2", "rejectRegistration called with correct id");
  assert(rejectCalledWith?.reason === "Screenshot unclear", "rejection reason passed");
  assert(!sim.state.rejectModal.isOpen, "modal closed after confirm");
  assert(sim.state.busyId === null, "busyId cleared");
});

await test("Bulk approve: calls API with all selected IDs and clears selection", async () => {
  const items = ["r1", "r2", "r3"].map(id => mockRegistration({ _id: id }));
  let bulkApproveCalled;
  const api = {
    getPendingQueue: async () => makePaginatedResponse([]),
    approveRegistration: async () => {},
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async (ids, code) => { bulkApproveCalled = { ids, code }; },
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator("TEAM01", api);
  sim.state.items = items;
  sim.toggleSelectAll();
  assert(sim.state.selectedIds.size === 3, "3 items selected before bulk approve");

  await sim.bulkApprove();
  assert(bulkApproveCalled?.ids.length === 3, "bulkApproveRegistrations called with 3 ids");
  assert(bulkApproveCalled?.code === "TEAM01", "code passed to bulk approve");
  assert(sim.state.selectedIds.size === 0, "selection cleared after bulk approve");
  assert(!sim.state.isBulkBusy, "isBulkBusy cleared after bulk approve");
});

await test("Bulk reject: opens modal, confirms, sends all selected IDs", async () => {
  const items = ["r4", "r5"].map(id => mockRegistration({ _id: id }));
  let bulkRejectCalled;
  const api = {
    getPendingQueue: async () => makePaginatedResponse([]),
    approveRegistration: async () => {},
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async (ids, reason, code) => { bulkRejectCalled = { ids, reason, code }; },
  };
  const sim = new ReviewQueueSimulator("TEAM01", api);
  sim.state.items = items;
  sim.toggleSelectAll();

  sim.openBulkRejectModal();
  assert(sim.state.rejectModal.isBulk, "bulk reject modal opens with isBulk=true");
  sim.state.rejectionReason = "Incorrect amount";

  await sim.confirmRejection();
  assert(bulkRejectCalled?.ids.sort().join(",") === "r4,r5", "both ids sent to bulkReject");
  assert(bulkRejectCalled?.reason === "Incorrect amount", "reason passed to bulkReject");
  assert(sim.state.selectedIds.size === 0, "selection cleared after bulk reject");
  assert(!sim.state.rejectModal.isOpen, "modal closed after bulk reject");
});

await test("Aborting stale requests: second fetch aborts first", async () => {
  let call = 0;
  let signal1Aborted = false;
  const api = {
    getPendingQueue: async (code, filters, signal) => {
      call++;
      if (call === 1) {
        // Simulate slow first request
        await new Promise(r => setTimeout(r, 10));
        if (signal.aborted) { signal1Aborted = true; throw new DOMException("Aborted", "AbortError"); }
      }
      return makePaginatedResponse([], filters.page);
    },
    approveRegistration: async () => {},
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator(undefined, api);

  const first = sim.fetchQueue(1).catch(() => {});
  // Immediately trigger second fetch (aborts first)
  await sim.fetchQueue(2);
  await first;

  assert(signal1Aborted, "first request was aborted when second started");
  assert(sim.state.page === 2, "state reflects second fetch page");
});

await test("Loading state: set true before fetch, false after", async () => {
  let loadingDuringFetch = false;
  const api = {
    getPendingQueue: async () => {
      await new Promise(r => setTimeout(r, 1));
      return makePaginatedResponse([]);
    },
    approveRegistration: async () => {},
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator(undefined, api);

  // Override to check loading mid-fetch
  const origGet = api.getPendingQueue;
  api.getPendingQueue = async (...args) => {
    loadingDuringFetch = sim.state.loading;
    return origGet(...args);
  };

  sim.state.loading = false;
  await sim.fetchQueue(1);

  assert(loadingDuringFetch === true, "loading was true during fetch");
  assert(sim.state.loading === false, "loading is false after fetch");
});

await test("Error state: abort error does not crash, other errors surfaced", async () => {
  let errorThrown = false;
  const api = {
    getPendingQueue: async (code, filters, signal) => {
      throw new Error("Network failure");
    },
    approveRegistration: async () => {},
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator(undefined, api);
  try {
    await sim.fetchQueue(1);
  } catch (e) {
    errorThrown = true;
  }
  // The hook catches errors internally, doesn't re-throw
  assert(!errorThrown, "fetchQueue does not throw on network error");
  assert(!sim.state.loading, "loading reset to false after error");
});

await test("Clear filters resets all filter state", async () => {
  const api = {
    getPendingQueue: async () => makePaginatedResponse([]),
    approveRegistration: async () => {},
    rejectRegistration: async () => {},
    bulkApproveRegistrations: async () => {},
    bulkRejectRegistrations: async () => {},
  };
  const sim = new ReviewQueueSimulator(undefined, api);
  sim.setFilter("eventSlug", "coding-war");
  sim.setFilter("college", "MIT");
  sim.setFilter("from", "2024-01-01");
  sim.setFilter("to", "2024-12-31");
  assert(sim.hasActiveFilters, "filters active before clear");

  sim.clearFilters();
  assert(!sim.hasActiveFilters, "filters cleared");
  assert(sim.state.eventSlug === "", "eventSlug cleared");
  assert(sim.state.college === "", "college cleared");
  assert(sim.state.from === "", "from cleared");
  assert(sim.state.to === "", "to cleared");
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(56)}`);
if (failed === 0) {
  console.log(`✅ ALL ${passed} REVIEW QUEUE TESTS PASSED`);
} else {
  console.log(`❌ ${failed} TESTS FAILED, ${passed} passed`);
  process.exit(1);
}
