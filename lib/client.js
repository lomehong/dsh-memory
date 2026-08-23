window.__ModuleLoader__.load({
	id: "@dsh-extra/dsh-memory",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/MemoryView.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var SCOPE_LABELS = { master: "\u4EC5\u4E3B\u4EBA", self: "\u5F53\u4E8B\u4EBA", public: "\u516C\u5F00" };
var SCOPE_COLORS = { master: "#fff3cd", self: "#d4edda", public: "#cce5ff" };
var SCOPE_TEXT = { master: "#856404", self: "#155724", public: "#004085" };
async function api(path, method = "GET", body, token) {
  const headers = { Accept: "application/json" };
  if (token) headers["x-memory-token"] = token;
  const opts = { method, headers };
  if (body) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  return res.json();
}
function MemoryView(_props) {
  const [entries, setEntries] = (0, import_react.useState)([]);
  const [token, setToken] = (0, import_react.useState)("");
  const [search, setSearch] = (0, import_react.useState)("");
  const [scopeFilter, setScopeFilter] = (0, import_react.useState)("");
  const [showAdd, setShowAdd] = (0, import_react.useState)(false);
  const [editId, setEditId] = (0, import_react.useState)(null);
  const [addContent, setAddContent] = (0, import_react.useState)("");
  const [addType, setAddType] = (0, import_react.useState)("note");
  const [addScope, setAddScope] = (0, import_react.useState)("master");
  const [addParticipants, setAddParticipants] = (0, import_react.useState)("");
  const [editContent, setEditContent] = (0, import_react.useState)("");
  const [editScope, setEditScope] = (0, import_react.useState)("master");
  const [editParticipants, setEditParticipants] = (0, import_react.useState)("");
  const load = (0, import_react.useCallback)(async () => {
    try {
      const d = await api("/dsh-memory/entries", "GET");
      setEntries(d.entries ?? []);
    } catch {
    }
  }, []);
  (0, import_react.useEffect)(() => {
    load();
    api("/dsh-memory/token", "GET").then((d) => {
      setToken(String(d.token ?? ""));
    }).catch(() => {
    });
  }, [load]);
  const filtered = entries.filter((e) => {
    if (search && !e.content.toLowerCase().includes(search.toLowerCase()) && !e.type.toLowerCase().includes(search.toLowerCase())) return false;
    if (scopeFilter && e.scope !== scopeFilter) return false;
    return true;
  });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const expiredCount = entries.filter((e) => e.expireAt && e.expireAt < now).length;
  async function handleAdd() {
    if (!addContent.trim()) {
      alert("\u8BF7\u8F93\u5165\u5185\u5BB9");
      return;
    }
    const p = addParticipants.split(",").map((s) => s.trim()).filter(Boolean);
    const r = await api("/dsh-memory/entries", "POST", { content: addContent, type: addType, scope: addScope, participants: p }, token);
    if (r.ok) {
      setShowAdd(false);
      setAddContent("");
      setAddParticipants("");
      load();
    } else {
      alert("\u6DFB\u52A0\u5931\u8D25: " + (r.error || "\u672A\u77E5\u9519\u8BEF"));
    }
  }
  async function handleEdit() {
    if (!editId) return;
    const p = editParticipants.split(",").map((s) => s.trim()).filter(Boolean);
    const r = await api("/dsh-memory/entries/update", "POST", { id: editId, content: editContent, scope: editScope, participants: p }, token);
    if (r.ok) {
      setEditId(null);
      load();
    } else {
      alert("\u66F4\u65B0\u5931\u8D25: " + (r.error || "\u672A\u77E5\u9519\u8BEF"));
    }
  }
  async function handleDelete(id) {
    if (!confirm("\u786E\u5B9A\u5220\u9664\uFF1F")) return;
    const r = await api("/dsh-memory/entries/delete", "POST", { id }, token);
    if (r.ok) load();
  }
  async function handleClear() {
    if (!confirm("\u786E\u5B9A\u6E05\u9664\u6240\u6709\u8BB0\u5FC6\uFF1F")) return;
    const r = await api("/dsh-memory/clear", "POST", void 0, token);
    if (r.ok) load();
  }
  async function handlePrune() {
    const r = await api("/dsh-memory/prune", "POST", void 0, token);
    if (r.ok) {
      load();
      alert("\u5DF2\u6E05\u9664 " + (r.pruned ?? 0) + " \u6761\u8FC7\u671F\u8BB0\u5FC6");
    }
  }
  function openEdit(e) {
    setEditId(e.id);
    setEditContent(e.content);
    setEditScope(e.scope);
    setEditParticipants((e.participants || []).join(", "));
  }
  const styles = {
    container: { padding: "16px", height: "100%", display: "flex", flexDirection: "column" },
    toolbar: { display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center", flexWrap: "wrap" },
    input: { flex: 1, minWidth: "150px", padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" },
    select: { padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" },
    btn: { padding: "6px 12px", border: "none", borderRadius: "4px", fontSize: "13px", cursor: "pointer" },
    btnPrimary: { background: "#4a6cf7", color: "#fff" },
    btnDanger: { background: "#e74c3c", color: "#fff" },
    btnSmall: { padding: "3px 8px", fontSize: "11px" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
    th: { padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #eee", background: "#fafafa", fontWeight: 600, color: "#666", fontSize: "12px" },
    td: { padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: "13px" },
    content: { maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    badge: { display: "inline-block", padding: "2px 6px", borderRadius: "8px", fontSize: "11px", fontWeight: 600 },
    modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", zIndex: 1e3, display: "flex", alignItems: "center", justifyContent: "center" },
    modal: { background: "#fff", borderRadius: "8px", padding: "20px", minWidth: "350px", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" },
    modalLabel: { display: "block", marginBottom: "4px", fontSize: "12px", color: "#666" },
    modalInput: { width: "100%", padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", marginBottom: "10px", boxSizing: "border-box" },
    modalTextarea: { width: "100%", padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", marginBottom: "10px", minHeight: "60px", resize: "vertical", boxSizing: "border-box" },
    modalSelect: { width: "100%", padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", marginBottom: "10px", boxSizing: "border-box" },
    btnRow: { display: "flex", gap: "8px", justifyContent: "flex-end" },
    expired: { opacity: 0.5 },
    stats: { display: "flex", gap: "12px", marginBottom: "12px" },
    statCard: { background: "#fff", borderRadius: "6px", padding: "10px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", flex: 1 },
    statNum: { fontSize: "22px", fontWeight: 700, color: "#4a6cf7" },
    statLabel: { fontSize: "12px", color: "#666", marginTop: "2px" },
    scrollContainer: { flex: 1, overflow: "auto" }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.container, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.stats, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.statCard, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.statNum, children: entries.length }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.statLabel, children: "\u603B\u8BB0\u5FC6" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.statCard, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.statNum, children: filtered.length }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.statLabel, children: "\u7B5B\u9009\u540E" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.statCard, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.statNum, children: expiredCount }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.statLabel, children: "\u5DF2\u8FC7\u671F" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.toolbar, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { style: styles.input, placeholder: "\u641C\u7D22\u8BB0\u5FC6...", value: search, onChange: (e) => setSearch(e.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { style: styles.select, value: scopeFilter, onChange: (e) => setScopeFilter(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: "\u6240\u6709\u8303\u56F4" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "master", children: "\u4EC5\u4E3B\u4EBA" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "self", children: "\u5F53\u4E8B\u4EBA" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "public", children: "\u516C\u5F00" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: () => setShowAdd(true), children: "+ \u6DFB\u52A0" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }, onClick: handleClear, children: "\u6E05\u9664\u5168\u90E8" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { ...styles.btn, ...styles.btnSmall }, onClick: handlePrune, children: "\u6E05\u9664\u8FC7\u671F" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.scrollContainer, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { style: styles.table, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: styles.th, children: "\u65F6\u95F4" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: styles.th, children: "\u7C7B\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: styles.th, children: "\u5185\u5BB9" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: styles.th, children: "\u8303\u56F4" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: styles.th, children: "\u4F5C\u8005" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: styles.th, children: "\u64CD\u4F5C" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { colSpan: 6, style: { ...styles.td, textAlign: "center", color: "#999", padding: "40px" }, children: "\u6682\u65E0\u8BB0\u5FC6" }) }) : filtered.map((e) => {
        const expired = e.expireAt && e.expireAt < now;
        const scopeColor = SCOPE_COLORS[e.scope] || "#e8e8e8";
        const scopeText = SCOPE_TEXT[e.scope] || "#555";
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { style: expired ? styles.expired : void 0, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: styles.td, children: (e.timestamp || "").slice(0, 19).replace("T", " ") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: styles.td, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...styles.badge, background: "#e8e8e8", color: "#555" }, children: e.type }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: { ...styles.td, ...styles.content }, title: e.content, children: e.content }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: styles.td, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...styles.badge, background: scopeColor, color: scopeText }, children: SCOPE_LABELS[e.scope] || e.scope }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: styles.td, children: e.authorRole === "master" ? "\u4E3B\u4EBA" : e.author }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { style: styles.td, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { ...styles.btn, ...styles.btnPrimary, ...styles.btnSmall, marginRight: "4px" }, onClick: () => openEdit(e), children: "\u7F16\u8F91" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }, onClick: () => handleDelete(e.id), children: "\u5220\u9664" })
          ] })
        ] }, e.id);
      }) })
    ] }) }),
    showAdd && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.modalOverlay, onClick: () => setShowAdd(false), children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.modal, onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { margin: "0 0 12px 0", fontSize: "16px" }, children: "\u6DFB\u52A0\u8BB0\u5FC6" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: styles.modalLabel, children: "\u5185\u5BB9" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { style: styles.modalTextarea, value: addContent, onChange: (e) => setAddContent(e.target.value), placeholder: "\u8BB0\u5FC6\u5185\u5BB9" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: styles.modalLabel, children: "\u7C7B\u578B" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { style: styles.modalSelect, value: addType, onChange: (e) => setAddType(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "note", children: "\u7B14\u8BB0" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "schedule_created", children: "\u65E5\u7A0B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "todo_created", children: "\u5F85\u529E" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "decision", children: "\u51B3\u7B56" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "conversation_summary", children: "\u5BF9\u8BDD\u6458\u8981" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: styles.modalLabel, children: "\u53EF\u89C1\u8303\u56F4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { style: styles.modalSelect, value: addScope, onChange: (e) => setAddScope(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "master", children: "\u4EC5\u4E3B\u4EBA\u53EF\u89C1" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "self", children: "\u4E3B\u4EBA+\u5F53\u4E8B\u4EBA" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "public", children: "\u6240\u6709\u4EBA\u53EF\u89C1" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: styles.modalLabel, children: "\u53C2\u4E0E\u8005 userid\uFF08\u9017\u53F7\u5206\u9694\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { style: styles.modalInput, value: addParticipants, onChange: (e) => setAddParticipants(e.target.value), placeholder: "userid1, userid2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.btnRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { ...styles.btn }, onClick: () => setShowAdd(false), children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: handleAdd, children: "\u6DFB\u52A0" })
      ] })
    ] }) }),
    editId !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.modalOverlay, onClick: () => setEditId(null), children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.modal, onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { margin: "0 0 12px 0", fontSize: "16px" }, children: "\u7F16\u8F91\u8BB0\u5FC6" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: styles.modalLabel, children: "\u5185\u5BB9" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { style: styles.modalTextarea, value: editContent, onChange: (e) => setEditContent(e.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: styles.modalLabel, children: "\u53EF\u89C1\u8303\u56F4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { style: styles.modalSelect, value: editScope, onChange: (e) => setEditScope(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "master", children: "\u4EC5\u4E3B\u4EBA\u53EF\u89C1" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "self", children: "\u4E3B\u4EBA+\u5F53\u4E8B\u4EBA" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "public", children: "\u6240\u6709\u4EBA\u53EF\u89C1" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: styles.modalLabel, children: "\u53C2\u4E0E\u8005 userid\uFF08\u9017\u53F7\u5206\u9694\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { style: styles.modalInput, value: editParticipants, onChange: (e) => setEditParticipants(e.target.value), placeholder: "userid1, userid2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.btnRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { ...styles.btn }, onClick: () => setEditId(null), children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: handleEdit, children: "\u4FDD\u5B58" })
      ] })
    ] }) })
  ] });
}

// src/client/index.ts
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "memory",
    order: 20,
    label: () => "\u8BB0\u5FC6"
  }, MemoryView));
}
		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
