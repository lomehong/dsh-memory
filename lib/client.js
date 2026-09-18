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

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/MemoryView.tsx
var import_react = require("react");

// src/time-format.ts
function pad2(n) {
  return String(n).padStart(2, "0");
}
function formatLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

// src/client/MemoryView.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var SCOPE_LABELS = { master: "\u4EC5\u4E3B\u4EBA", self: "\u5F53\u4E8B\u4EBA", public: "\u516C\u5F00" };
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
var CSS = `
.dsh-mem-root { padding: 16px 20px 20px; height: 100%; display: flex; flex-direction: column; gap: 12px; color: var(--dsw-alias-label-primary); }
.dsh-mem-stats { display: flex; gap: 12px; }
.dsh-mem-stat { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-layer-2); }
.dsh-mem-statNum { font-size: 22px; font-weight: 700; line-height: 1.2; color: var(--dsw-alias-label-primary); }
.dsh-mem-statNum[data-accent='brand'] { color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary)); }
.dsh-mem-statNum[data-accent='warn'] { color: var(--dsw-alias-state-warn-primary); }
.dsh-mem-statLabel { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.dsh-mem-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dsh-mem-input, .dsh-mem-select { padding: 6px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; font-size: 13px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); transition: border-color .12s ease; outline: none; }
.dsh-mem-input { flex: 1; min-width: 160px; }
.dsh-mem-input::placeholder { color: var(--dsw-alias-label-tertiary); }
.dsh-mem-input:focus, .dsh-mem-select:focus, .dsh-mem-modalInput:focus, .dsh-mem-modalTextarea:focus, .dsh-mem-modalSelect:focus { border-color: var(--dsw-alias-brand-primary, var(--dsw-alias-border-l2)); }
.dsh-mem-select option { background: var(--dsw-alias-bg-base, #1b1b1b); color: var(--dsw-alias-label-primary); }
.dsh-mem-btn { padding: 6px 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; font-size: 13px; line-height: 1.5; cursor: pointer; background: transparent; color: var(--dsw-alias-label-secondary); transition: background .12s ease, border-color .12s ease, color .12s ease; }
.dsh-mem-btn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dsh-mem-btnSmall { padding: 3px 10px; font-size: 11px; border-radius: 6px; }
/* \u4E3B\u52A8\u4F5C\u6309\u94AE\u8D70 button-info-*\uFF08DeepSeek \u84DD\uFF0C\u6DF1\u6D45\u4E3B\u9898\u5404\u6709\u4E00\u6863\uFF09\u2014\u2014
   \u4E0E\u4EA7\u54C1\u8F93\u5165\u533A\u7684\u84DD\u8272\u53D1\u9001\u952E\u540C\u4E00\u89C6\u89C9\u65CF\uFF1B\u4E0D\u8981\u7528 button-primary-fill\uFF0C
   \u6DF1\u8272\u6A21\u5F0F\u4E0B\u5B83\u662F\u53CD\u8272\u767D\u5E95\uFF0C\u9700\u914D brand-primary-invert \u6DF1\u8272\u6807\u7B7E\u3002 */
.dsh-mem-btnPrimary { background: var(--dsw-alias-button-info-fill, #4a6cf7); border-color: transparent; color: #fff; }
.dsh-mem-btnPrimary:hover { background: var(--dsw-alias-button-info-hover, #5a7cff); color: #fff; }
.dsh-mem-btnDanger { color: var(--dsw-alias-state-error-primary); }
.dsh-mem-btnDanger:hover { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.dsh-mem-scroll { flex: 1; overflow: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); }
.dsh-mem-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dsh-mem-th { padding: 9px 12px; text-align: left; font-weight: 600; font-size: 12px; color: var(--dsw-alias-label-tertiary); background: var(--dsw-alias-bg-layer-3); border-bottom: 1px solid var(--dsw-alias-border-l2); position: sticky; top: 0; }
.dsh-mem-td { padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); font-size: 13px; line-height: 1.5; }
.dsh-mem-tbody tr:hover .dsh-mem-td { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-mem-trExpired .dsh-mem-td { opacity: 0.45; }
.dsh-mem-content { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-mem-badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; line-height: 18px; border: 1px solid transparent; }
.dsh-mem-badgeNeutral { background: var(--dsw-alias-bg-layer-3); border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); }
.dsh-mem-badge[data-scope='master'] { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent); border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent); color: var(--dsw-alias-state-warn-primary); }
.dsh-mem-badge[data-scope='self'] { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 40%, transparent); color: var(--dsw-alias-state-success-primary); }
.dsh-mem-badge[data-scope='public'] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, transparent); color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-secondary)); }
.dsh-mem-empty { padding: 48px 24px; text-align: center; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.dsh-mem-overlay { position: fixed; inset: 0; background: rgb(0 0 0 / 52%); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.dsh-mem-modal { background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l2); border-radius: 14px; padding: 20px; min-width: 360px; max-width: 480px; box-shadow: 0 12px 36px rgb(0 0 0 / 36%); color: var(--dsw-alias-label-primary); }
.dsh-mem-modalTitle { margin: 0 0 14px; font-size: 15px; font-weight: 600; }
.dsh-mem-modalLabel { display: block; margin-bottom: 4px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.dsh-mem-modalInput, .dsh-mem-modalTextarea, .dsh-mem-modalSelect { width: 100%; padding: 6px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; font-size: 13px; margin-bottom: 12px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); box-sizing: border-box; outline: none; transition: border-color .12s ease; font-family: inherit; }
.dsh-mem-modalTextarea { min-height: 64px; resize: vertical; }
.dsh-mem-btnRow { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
`;
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-mem-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: CSS }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-mem-stats", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-mem-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-mem-statNum", children: entries.length }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-mem-statLabel", children: "\u603B\u8BB0\u5FC6" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-mem-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-mem-statNum", "data-accent": scopeFilter || search ? "brand" : void 0, children: filtered.length }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-mem-statLabel", children: "\u7B5B\u9009\u540E" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-mem-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-mem-statNum", "data-accent": expiredCount > 0 ? "warn" : void 0, children: expiredCount }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-mem-statLabel", children: "\u5DF2\u8FC7\u671F" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-mem-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "dsh-mem-input", placeholder: "\u641C\u7D22\u8BB0\u5FC6...", value: search, onChange: (e) => setSearch(e.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { className: "dsh-mem-select", value: scopeFilter, onChange: (e) => setScopeFilter(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: "\u6240\u6709\u8303\u56F4" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "master", children: "\u4EC5\u4E3B\u4EBA" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "self", children: "\u5F53\u4E8B\u4EBA" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "public", children: "\u516C\u5F00" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsh-mem-btn dsh-mem-btnPrimary", onClick: () => setShowAdd(true), children: "+ \u6DFB\u52A0" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsh-mem-btn dsh-mem-btnDanger dsh-mem-btnSmall", onClick: handleClear, children: "\u6E05\u9664\u5168\u90E8" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsh-mem-btn dsh-mem-btnSmall", onClick: handlePrune, children: "\u6E05\u9664\u8FC7\u671F" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-mem-scroll", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { className: "dsh-mem-table", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "dsh-mem-th", children: "\u65F6\u95F4" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "dsh-mem-th", children: "\u7C7B\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "dsh-mem-th", children: "\u5185\u5BB9" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "dsh-mem-th", children: "\u8303\u56F4" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "dsh-mem-th", children: "\u4F5C\u8005" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "dsh-mem-th", children: "\u64CD\u4F5C" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { className: "dsh-mem-tbody", children: filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "dsh-mem-td", colSpan: 6, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-mem-empty", children: "\u6682\u65E0\u8BB0\u5FC6" }) }) }) : filtered.map((e) => {
        const expired = e.expireAt && e.expireAt < now;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { className: expired ? "dsh-mem-trExpired" : void 0, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "dsh-mem-td", children: formatLocal(e.timestamp) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "dsh-mem-td", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-mem-badge dsh-mem-badgeNeutral", children: e.type }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "dsh-mem-td dsh-mem-content", title: e.content, children: e.content }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "dsh-mem-td", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-mem-badge", "data-scope": e.scope, children: SCOPE_LABELS[e.scope] || e.scope }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "dsh-mem-td", children: e.authorRole === "master" ? "\u4E3B\u4EBA" : e.author }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { className: "dsh-mem-td", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsh-mem-btn dsh-mem-btnSmall", style: { marginRight: "4px" }, onClick: () => openEdit(e), children: "\u7F16\u8F91" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsh-mem-btn dsh-mem-btnDanger dsh-mem-btnSmall", onClick: () => handleDelete(e.id), children: "\u5220\u9664" })
          ] })
        ] }, e.id);
      }) })
    ] }) }),
    showAdd && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-mem-overlay", onClick: () => setShowAdd(false), children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-mem-modal", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "dsh-mem-modalTitle", children: "\u6DFB\u52A0\u8BB0\u5FC6" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dsh-mem-modalLabel", children: "\u5185\u5BB9" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { className: "dsh-mem-modalTextarea", value: addContent, onChange: (e) => setAddContent(e.target.value), placeholder: "\u8BB0\u5FC6\u5185\u5BB9" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dsh-mem-modalLabel", children: "\u7C7B\u578B" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { className: "dsh-mem-modalSelect", value: addType, onChange: (e) => setAddType(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "note", children: "\u7B14\u8BB0" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "schedule_created", children: "\u65E5\u7A0B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "todo_created", children: "\u5F85\u529E" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "decision", children: "\u51B3\u7B56" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "conversation_summary", children: "\u5BF9\u8BDD\u6458\u8981" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dsh-mem-modalLabel", children: "\u53EF\u89C1\u8303\u56F4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { className: "dsh-mem-modalSelect", value: addScope, onChange: (e) => setAddScope(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "master", children: "\u4EC5\u4E3B\u4EBA\u53EF\u89C1" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "self", children: "\u4E3B\u4EBA+\u5F53\u4E8B\u4EBA" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "public", children: "\u6240\u6709\u4EBA\u53EF\u89C1" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dsh-mem-modalLabel", children: "\u53C2\u4E0E\u8005 userid\uFF08\u9017\u53F7\u5206\u9694\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "dsh-mem-modalInput", value: addParticipants, onChange: (e) => setAddParticipants(e.target.value), placeholder: "userid1, userid2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-mem-btnRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsh-mem-btn", onClick: () => setShowAdd(false), children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsh-mem-btn dsh-mem-btnPrimary", onClick: handleAdd, children: "\u6DFB\u52A0" })
      ] })
    ] }) }),
    editId !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-mem-overlay", onClick: () => setEditId(null), children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-mem-modal", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "dsh-mem-modalTitle", children: "\u7F16\u8F91\u8BB0\u5FC6" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dsh-mem-modalLabel", children: "\u5185\u5BB9" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { className: "dsh-mem-modalTextarea", value: editContent, onChange: (e) => setEditContent(e.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dsh-mem-modalLabel", children: "\u53EF\u89C1\u8303\u56F4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { className: "dsh-mem-modalSelect", value: editScope, onChange: (e) => setEditScope(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "master", children: "\u4EC5\u4E3B\u4EBA\u53EF\u89C1" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "self", children: "\u4E3B\u4EBA+\u5F53\u4E8B\u4EBA" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "public", children: "\u6240\u6709\u4EBA\u53EF\u89C1" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dsh-mem-modalLabel", children: "\u53C2\u4E0E\u8005 userid\uFF08\u9017\u53F7\u5206\u9694\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "dsh-mem-modalInput", value: editParticipants, onChange: (e) => setEditParticipants(e.target.value), placeholder: "userid1, userid2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-mem-btnRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsh-mem-btn", onClick: () => setEditId(null), children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsh-mem-btn dsh-mem-btnPrimary", onClick: handleEdit, children: "\u4FDD\u5B58" })
      ] })
    ] }) })
  ] });
}

// src/client/AutopilotConfigForm.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var c = {
  text: "var(--dsw-alias-label-primary, #1f2329)",
  textSecondary: "var(--dsw-alias-label-secondary, #4e5969)",
  bgBase: "var(--dsw-alias-bg-base, #ffffff)",
  bgLayer: "var(--dsw-alias-bg-layer-1, #f7f8fa)",
  border: "var(--dsw-alias-separator-primary, #e5e6eb)",
  accent: "var(--dsw-alias-state-business-primary, #3370ff)",
  ok: "var(--dsw-alias-state-success-primary, #00b42a)",
  error: "var(--dsw-alias-state-error-primary, #f53f3f)"
};
var sectionStyle = { border: `1px solid ${c.border}`, borderRadius: 8, padding: "12px 16px", background: c.bgBase, marginBottom: 12 };
var titleStyle = { fontSize: 13, fontWeight: 600, color: c.text, margin: "0 0 8px" };
var hintStyle = { fontSize: 12, color: c.textSecondary, lineHeight: 1.5 };
var rowStyle = { display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0" };
var labelStyle = { fontSize: 13, color: c.text };
var numStyle = { width: 90, padding: "4px 8px", borderRadius: 6, border: `1px solid ${c.border}`, background: c.bgBase, color: c.text, fontSize: 13 };
var btnStyle = { padding: "4px 10px", borderRadius: 6, border: `1px solid ${c.border}`, background: c.bgBase, color: c.textSecondary, fontSize: 12, cursor: "pointer" };
var primaryBtn = { ...btnStyle, background: c.accent, color: "#fff", border: "none", fontWeight: 600, padding: "6px 22px", fontSize: 13 };
async function api2(path, init) {
  const headers = { Accept: "application/json" };
  if (init?.token) headers["x-memory-token"] = init.token;
  if (init?.body !== void 0) headers["content-type"] = "application/json";
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers,
    ...init?.body !== void 0 ? { body: JSON.stringify(init.body) } : {},
    signal: AbortSignal.timeout(1e4)
  });
  return await res.json();
}
function SwitchRow(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: rowStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "input",
      {
        type: "checkbox",
        checked: props.checked,
        onChange: (e) => props.onChange(e.target.checked),
        style: { marginTop: 2 }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: labelStyle, children: props.label }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: hintStyle, children: props.hint })
    ] })
  ] });
}
function NumberRow(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...rowStyle, alignItems: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { minWidth: 150 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: labelStyle, children: props.label }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: hintStyle, children: props.hint })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "input",
      {
        type: "number",
        style: numStyle,
        value: props.value,
        onChange: (e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) props.onChange(v);
        }
      }
    )
  ] });
}
function AutopilotConfigForm() {
  const [cfg, setCfg] = (0, import_react2.useState)(null);
  const [dirty, setDirty] = (0, import_react2.useState)(false);
  const [status, setStatus] = (0, import_react2.useState)("");
  const [loadError, setLoadError] = (0, import_react2.useState)(false);
  const load = (0, import_react2.useCallback)(async () => {
    try {
      const res = await api2("/dsh-memory/autopilot");
      if (res.ok && res.config) {
        setCfg(res.config);
        setDirty(false);
        setLoadError(false);
      }
    } catch {
      setLoadError(true);
    }
  }, []);
  (0, import_react2.useEffect)(() => {
    void load();
  }, [load]);
  async function save() {
    if (cfg === null) return;
    try {
      const t = await api2("/dsh-memory/token");
      if (!t.ok || typeof t.token !== "string") {
        setStatus("\u83B7\u53D6\u6821\u9A8C token \u5931\u8D25");
        return;
      }
      const res = await api2("/dsh-memory/autopilot", {
        method: "POST",
        body: cfg,
        token: t.token
      });
      if (res.ok && res.config) {
        setCfg(res.config);
        setDirty(false);
        setStatus("\u5DF2\u4FDD\u5B58\u5E76\u751F\u6548");
      } else {
        setStatus("\u4FDD\u5B58\u5931\u8D25\uFF1A" + (res.error ?? "\u672A\u77E5\u9519\u8BEF"));
      }
    } catch (e) {
      setStatus("\u4FDD\u5B58\u5931\u8D25\uFF1A" + String(e));
    }
  }
  if (loadError) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...hintStyle, color: c.error }, children: "\u914D\u7F6E\u83B7\u53D6\u5931\u8D25\uFF08dsh-memory \u5BBF\u4E3B\u670D\u52A1\u4E0D\u53EF\u7528\uFF1F\uFF09\u3002" });
  }
  if (cfg === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: hintStyle, children: "\u52A0\u8F7D\u4E2D\u2026" });
  }
  const patch = (p) => {
    setCfg({ ...cfg, ...p });
    setDirty(true);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { maxWidth: 720 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: sectionStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: titleStyle, children: "\u8BFB\u4FA7 \xB7 \u6309\u8F6E\u81EA\u52A8\u88C5\u914D" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        SwitchRow,
        {
          checked: cfg.injectPerTurn,
          label: "\u6309\u8F6E\u81EA\u52A8\u88C5\u914D\u6CE8\u5165",
          hint: "\u6BCF\u8F6E\u5BF9\u8BDD\u81EA\u52A8\u68C0\u7D22\u76F8\u5173\u8BB0\u5FC6\u5E76\u6CE8\u5165 system prompt\uFF08memory-pack \u6BB5\uFF09\uFF0C\u88C5\u914D\u5931\u8D25\u4E0D\u963B\u65AD\u5BF9\u8BDD\u3002",
          onChange: (v) => patch({ injectPerTurn: v })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NumberRow, { value: cfg.injectLimit, label: "\u6BCF\u8F6E\u6700\u591A\u6CE8\u5165\u6761\u6570", hint: "1\u201320\uFF0C\u9ED8\u8BA4 5", onChange: (v) => patch({ injectLimit: v }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NumberRow, { value: cfg.injectBudgetBytes, label: "\u6CE8\u5165\u5B57\u8282\u9884\u7B97", hint: "200\u20138192\uFF0C\u9ED8\u8BA4 1600\uFF1B\u8D85\u9650\u6309\u5E8F\u88C1\u526A", onChange: (v) => patch({ injectBudgetBytes: v }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: sectionStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: titleStyle, children: "\u5199\u4FA7 \xB7 \u5BF9\u8BDD\u590D\u76D8\u6C89\u6DC0" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        SwitchRow,
        {
          checked: cfg.reviewerEnabled,
          label: "\u5BF9\u8BDD\u590D\u76D8\u6C89\u6DC0\uFF08\u603B\u5F00\u5173\uFF09",
          hint: "\u4F1A\u8BDD\u544A\u4E00\u6BB5\u843D\u540E\u7ECF\u6A21\u578B\u63D0\u53D6\u503C\u5F97\u8BB0\u4F4F\u7684\u4E8B\u5B9E\uFF0C\u5224\u91CD\u540E\u5199\u5165\u8BB0\u5FC6\u5E93\u3002",
          onChange: (v) => patch({ reviewerEnabled: v })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        SwitchRow,
        {
          checked: cfg.reviewOnIdle,
          label: "\u7A7A\u95F2\u53BB\u6296\u89E6\u53D1",
          hint: "\u4F1A\u8BDD\u8F6C\u5165\u7A7A\u95F2\u540E\u5EF6\u8FDF\u89E6\u53D1\u590D\u76D8\uFF08\u9ED8\u8BA4\u5F00\uFF09\u3002",
          onChange: (v) => patch({ reviewOnIdle: v })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NumberRow, { value: cfg.idleDebounceSec, label: "\u7A7A\u95F2\u53BB\u6296\u79D2\u6570", hint: "10\u20133600\uFF0C\u9ED8\u8BA4 90", onChange: (v) => patch({ idleDebounceSec: v }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NumberRow, { value: cfg.reviewPeriodicHours, label: "\u5468\u671F\u515C\u5E95\u95F4\u9694\uFF08\u5C0F\u65F6\uFF09", hint: "0=\u5173\uFF0C\u9ED8\u8BA4 6\uFF1B\u5BF9\u6F0F\u6389\u7684\u4F1A\u8BDD\u505A\u626B\u5C3E\u590D\u76D8", onChange: (v) => patch({ reviewPeriodicHours: v }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        SwitchRow,
        {
          checked: cfg.reviewGuests,
          label: "\u590D\u76D8\u8BBF\u5BA2\u4F1A\u8BDD",
          hint: "\u9ED8\u8BA4\u5173\uFF08\u4FDD\u5B88\u4FA7\uFF09\uFF1A\u8BBF\u5BA2\u4F1A\u8BDD\u4E0D\u81EA\u52A8\u6C89\u6DC0\u8BB0\u5FC6\uFF1B\u4E3B\u4EBA\u7684\u8BB0\u5FC6\u4ECD\u53D7\u53EF\u89C1\u6027\u89C4\u5219\u7EA6\u675F\u3002",
          onChange: (v) => patch({ reviewGuests: v })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NumberRow, { value: cfg.reviewMaxEntries, label: "\u5355\u6B21\u590D\u76D8\u6700\u591A\u843D\u5E93\u6761\u6570", hint: "1\u201320\uFF0C\u9ED8\u8BA4 5", onChange: (v) => patch({ reviewMaxEntries: v }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NumberRow, { value: cfg.reviewTranscriptChars, label: "\u56DE\u5408\u7A97\u53E3\u6587\u672C\u4E0A\u9650\uFF08\u5B57\u7B26\uFF09", hint: "200\u201320000\uFF0C\u9ED8\u8BA4 4000", onChange: (v) => patch({ reviewTranscriptChars: v }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: sectionStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: titleStyle, children: "\u5BA1\u6279\u7559\u75D5" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        SwitchRow,
        {
          checked: cfg.approvalMemory,
          label: "\u6279\u51C6/\u62D2\u7EDD\u81EA\u52A8\u843D\u300C\u6388\u6743\u300D\u8BB0\u5FC6",
          hint: "approval/request \u89C2\u5BDF\u8005\u8BB0\u5F55\uFF08\u900F\u4F20\u4E0D\u6539\u88C1\u51B3\uFF09\uFF0C\u6388\u6743\u56DB\u5143\u7EC4\u5199\u5165\u8BB0\u5FC6\u5E93\u3002",
          onChange: (v) => patch({ approvalMemory: v })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 12, alignItems: "center", marginTop: 4 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: primaryBtn, disabled: !dirty, onClick: () => {
        void save();
      }, children: "\u4FDD\u5B58\u5E76\u751F\u6548" }),
      dirty && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { ...hintStyle, color: c.warn }, children: "\u6709\u672A\u4FDD\u5B58\u66F4\u6539" }),
      !dirty && status !== "" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { ...hintStyle, color: c.ok }, children: status }),
      dirty && status !== "" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { ...hintStyle, color: c.error }, children: status })
    ] })
  ] });
}
function AutopilotPluginConfig(props) {
  if (props.view === "page") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(AutopilotConfigForm, {});
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 12, color: c.textSecondary }, children: "\u8BB0\u5FC6\u81EA\u52A8\u9A7E\u9A76\uFF1A\u6309\u8F6E\u88C5\u914D\u6CE8\u5165 + \u5BF9\u8BDD\u590D\u76D8\u6C89\u6DC0 + \u5BA1\u6279\u7559\u75D5\uFF1B\u70B9\u5F00\u914D\u7F6E\u5F00\u5173\u4E0E\u9884\u7B97\u3002" });
}

// src/client/index.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "memory",
    order: 20,
    label: () => "\u8BB0\u5FC6"
  }, MemoryView));
  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: "@dsh-extra/dsh-memory"
  }, (props) => AutopilotPluginConfig({ view: props.view })));
  const slots = ctx.slots;
  if (typeof slots.spec !== "function") return;
  try {
    if (slots.spec("main") !== void 0) {
      ctx.slots.inject(
        "main",
        () => ctx.slots.register({ name: "main", key: "memory" }, MemoryView)
      );
    }
    if (slots.spec("sidebar.panellist") !== void 0) {
      ctx.slots.inject(
        "sidebar.panellist",
        () => ctx.slots.register(
          { name: "sidebar.panellist", id: "memory", order: 20, label: () => "\u8BB0\u5FC6" },
          ({ size, active }) => memoryIcon(size, active)
        )
      );
    }
  } catch {
  }
}
function memoryIcon(size, active) {
  const color = active ? "var(--dsw-alias-state-business-primary)" : "var(--dsw-alias-label-secondary)";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ellipse", { cx: "12", cy: "5.5", rx: "7", ry: "2.8", stroke: color, strokeWidth: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M5 5.5v6c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9v-6", stroke: color, strokeWidth: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M5 11.5v6c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9v-6", stroke: color, strokeWidth: "2" })
  ] });
}
		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
