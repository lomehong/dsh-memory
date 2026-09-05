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
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "dsh-mem-td", children: (e.timestamp || "").slice(0, 19).replace("T", " ") }),
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
