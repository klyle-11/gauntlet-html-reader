// Gauntlet workbook: progressive enhancement over the static pages.
// No dependencies, no build step. Runs from file:// or any static host.
(() => {
  'use strict';

  const NS = 'gauntlet:';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /** Tiny element builder: h('button.cls', {onclick}, 'text', child). */
  function h(spec, attrs, ...children) {
    const [tag, ...classes] = spec.split('.');
    const el = document.createElement(tag || 'div');
    if (classes.length) el.className = classes.join(' ');
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      children.unshift(attrs);
      attrs = null;
    }
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }

  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  /** FNV-1a. Widget ids hash the item's text, so reordering the source never moves notes. */
  function hash(s) {
    let x = 0x811c9dc5;
    for (const ch of norm(s).toLowerCase()) {
      x ^= ch.codePointAt(0);
      x = Math.imul(x, 0x01000193) >>> 0;
    }
    return x.toString(36);
  }
  const now = () => new Date().toISOString();
  const fmtDate = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  const ls = {
    get(k, fallback = null) {
      try {
        const v = localStorage.getItem(NS + k);
        return v == null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(NS + k, JSON.stringify(v));
      } catch (e) {
        toast('Could not save to browser storage: ' + e.message);
      }
    },
    del(k) {
      try {
        localStorage.removeItem(NS + k);
      } catch {}
    },
    keys(prefix) {
      const out = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(NS + prefix)) out.push(k.slice(NS.length + prefix.length));
        }
      } catch {}
      return out;
    },
  };

  function toast(msg) {
    const t = h('div.toast', { role: 'status' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ---------------------------------------------------------------- state

  const blank = (key) => ({
    v: 1,
    key,
    updatedAt: null,
    checks: {},
    dsa: {},
    research: {},
    hints: {},
    measures: [],
    parking: [],
    todo: [],
    files: {},
  });

  const Store = {
    load(key) {
      return Object.assign(blank(key), ls.get('m:' + key, {}));
    },
    save(state) {
      state.updatedAt = now();
      ls.set('m:' + state.key, state);
      Disk.queue(state);
    },
    all() {
      return ls.keys('m:').map((k) => Store.load(k));
    },
  };

  // ------------------------------------------------- workspace folder (disk)
  // Chromium's File System Access API writes real files: <folder>/<key>/notes.json
  // and <folder>/<key>/<code files>. Everything still works without it.

  const Disk = {
    supported: 'showDirectoryPicker' in window,
    root: null,
    state: 'off', // off | needs-permission | on
    pending: new Map(),

    db() {
      return new Promise((res, rej) => {
        const r = indexedDB.open('gauntlet', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    },
    async idb(mode, fn) {
      const db = await this.db();
      return new Promise((res, rej) => {
        const tx = db.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        tx.oncomplete = () => res(req && req.result);
        tx.onerror = () => rej(tx.error);
      });
    },

    async init() {
      if (!this.supported) return;
      try {
        const handle = await this.idb('readonly', (s) => s.get('workspace'));
        if (!handle) return;
        this.root = handle;
        const p = await handle.queryPermission({ mode: 'readwrite' });
        this.state = p === 'granted' ? 'on' : 'needs-permission';
      } catch {
        this.state = 'off';
      }
      renderWsStatus();
    },

    async connect() {
      if (!this.supported) {
        toast('This browser cannot write to folders. Use Export on the home page to save a copy of your work.');
        return false;
      }
      if (this.root && this.state === 'needs-permission') {
        const p = await this.root.requestPermission({ mode: 'readwrite' });
        this.state = p === 'granted' ? 'on' : 'needs-permission';
      } else {
        try {
          this.root = await window.showDirectoryPicker({ id: 'gauntlet-workspace', mode: 'readwrite' });
        } catch {
          return false;
        }
        await this.idb('readwrite', (s) => s.put(this.root, 'workspace'));
        this.state = 'on';
      }
      renderWsStatus();
      if (this.state === 'on') await this.syncAll();
      return this.state === 'on';
    },

    async disconnect() {
      await this.idb('readwrite', (s) => s.delete('workspace'));
      this.root = null;
      this.state = 'off';
      renderWsStatus();
    },

    queue(state) {
      if (this.state !== 'on') return;
      this.pending.set(state.key, state);
      this.flush();
    },
    flush: debounce(async function () {
      const batch = [...Disk.pending.values()];
      Disk.pending.clear();
      for (const s of batch) {
        try {
          await Disk.write(s);
        } catch (e) {
          toast(`Could not write ${s.key} to the workspace folder: ${e.message}`);
        }
      }
    }, 500),

    async write(state) {
      const dir = await this.root.getDirectoryHandle(state.key, { create: true });
      const { files, ...notes } = state;
      notes.files = Object.keys(files).sort();
      await writeText(dir, 'notes.json', JSON.stringify(notes, null, 2) + '\n');
      for (const [name, content] of Object.entries(files)) await writeText(dir, name, content);
      // Remove code files deleted in the UI; leave anything else in the folder alone.
      const prev = (await readJson(dir, '.gauntlet-files.json')) || [];
      for (const name of prev) if (!(name in files)) await dir.removeEntry(name).catch(() => {});
      await writeText(dir, '.gauntlet-files.json', JSON.stringify(notes.files) + '\n');
    },

    async read(key) {
      if (this.state !== 'on') return null;
      let dir;
      try {
        dir = await this.root.getDirectoryHandle(key);
      } catch {
        return null;
      }
      const notes = await readJson(dir, 'notes.json');
      if (!notes) return null;
      const files = {};
      for (const name of notes.files || []) {
        try {
          files[name] = await (await (await dir.getFileHandle(name)).getFile()).text();
        } catch {}
      }
      return Object.assign(blank(key), notes, { files });
    },

    /** Newer side wins per module, then both sides hold the same thing. */
    async syncAll() {
      const keys = new Set(ls.keys('m:'));
      for await (const [name, entry] of this.root.entries()) if (entry.kind === 'directory') keys.add(name);
      let pulled = 0;
      let pushed = 0;
      for (const key of keys) {
        const local = ls.get('m:' + key);
        const disk = await this.read(key);
        if (disk && (!local || (disk.updatedAt || '') > (local.updatedAt || ''))) {
          ls.set('m:' + key, disk);
          pulled++;
        } else if (local) {
          await this.write(Object.assign(blank(key), local));
          pushed++;
        }
      }
      toast(`Workspace folder synced: ${pulled} loaded, ${pushed} written.`);
    },
  };

  async function writeText(dir, name, text) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }
  async function readJson(dir, name) {
    try {
      return JSON.parse(await (await (await dir.getFileHandle(name)).getFile()).text());
    } catch {
      return null;
    }
  }

  function renderWsStatus() {
    const b = $('[data-action=workspace]');
    if (!b) return;
    const label = { off: 'Browser storage', 'needs-permission': 'Reconnect folder', on: `Folder: ${Disk.root && Disk.root.name}` };
    b.textContent = label[Disk.state];
    b.dataset.state = Disk.state;
    const panel = $('[data-widget=data-panel]');
    if (panel) renderDataPanel(panel);
  }

  // ---------------------------------------------------------------- timer
  // One timer at a time, kept in localStorage so it follows you between pages.

  const Timer = {
    get() {
      return ls.get('timer');
    },
    start(t) {
      ls.set('timer', { ...t, startedAt: Date.now(), endsAt: Date.now() + t.minutes * 60000, paused: null });
      Timer.render();
    },
    stop(log = true) {
      const t = Timer.get();
      if (!t) return;
      if (log) Timer.log(t);
      ls.del('timer');
      Timer.render();
    },
    pause() {
      const t = Timer.get();
      if (!t) return;
      if (t.paused != null) {
        t.endsAt = Date.now() + t.paused;
        t.paused = null;
      } else t.paused = t.endsAt - Date.now();
      ls.set('timer', t);
      Timer.render();
    },
    log(t) {
      const elapsed = Math.round(((t.paused != null ? t.minutes * 60000 - t.paused : Math.min(Date.now(), t.endsAt) - t.startedAt) / 60000) * 10) / 10;
      if (elapsed < 0.1) return;
      const s = Store.load(t.key);
      const r = (s.research[t.item] ||= { text: t.label, sessions: [] });
      (r.sessions ||= []).push({ at: new Date(t.startedAt).toISOString(), minutes: elapsed, box: t.minutes });
      Store.save(s);
      document.dispatchEvent(new CustomEvent('gauntlet:research', { detail: t }));
    },
    tick: null,
    render() {
      const bar = $('.timerbar');
      if (!bar) return;
      const t = Timer.get();
      clearInterval(Timer.tick);
      if (!t) {
        bar.hidden = true;
        bar.textContent = '';
        return;
      }
      bar.hidden = false;
      const left = h('span.time');
      const draw = () => {
        const ms = t.paused != null ? t.paused : t.endsAt - Date.now();
        const s = Math.max(0, Math.round(ms / 1000));
        left.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        bar.classList.toggle('over', ms <= 0);
        if (ms <= 0 && !t.rang) {
          t.rang = true;
          ls.set('timer', t);
          chime();
          notify(`Timebox over: ${t.label}`, 'Stop, write down what you know, and park the rest.');
        }
      };
      draw();
      if (t.paused == null) Timer.tick = setInterval(draw, 1000);
      bar.replaceChildren(
        h('a.what', { href: `${t.key}.html#research`, title: t.label }, `${t.key} · ${t.label}`),
        left,
        h('button', { type: 'button', onclick: Timer.pause }, t.paused != null ? 'Resume' : 'Pause'),
        h('button', { type: 'button', onclick: () => Timer.stop(true) }, 'Stop & log'),
      );
    },
  };

  function chime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach((d, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = [660, 880, 990][i];
        g.gain.setValueAtTime(0.15, ctx.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.4);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + d);
        o.stop(ctx.currentTime + d + 0.45);
      });
    } catch {}
  }
  function notify(title, body) {
    try {
      if (window.Notification && Notification.permission === 'granted') new Notification(title, { body });
    } catch {}
  }

  // ------------------------------------------------------------- widgets
  // Each widget reads the faithfully rendered prose and adds controls next to
  // it. If an extractor finds nothing, the page still reads correctly.

  function initModule(main) {
    const key = main.dataset.module;
    let state = Store.load(key);
    const save = () => {
      Store.save(state);
      updateProgress();
    };
    const seen = { checks: new Set(), dsa: new Set(), research: new Set(), hints: new Set() };

    // Checklists: acceptance criteria, slow-walk steps, prove-it rooms.
    const checkLists = [
      ...$$('ul', main).filter((ul) => {
        const p = ul.previousElementSibling;
        return p && p.tagName === 'P' && /acceptance criteria/i.test(p.textContent);
      }),
      ...$$('section[data-canonical=slowwalk] > ol, section[data-canonical=prove] > ul', main),
    ];
    for (const list of new Set(checkLists)) {
      const sec = list.closest('section').dataset.section;
      list.classList.add('checklist');
      for (const li of list.children) {
        const text = norm(li.textContent);
        const id = `${sec}:${hash(text)}`;
        seen.checks.add(id);
        const box = h('input', {
          type: 'checkbox',
          checked: state.checks[id]?.done,
          'aria-label': 'Done',
          onchange: () => {
            state.checks[id] = { done: box.checked, text: text.slice(0, 200), at: now() };
            li.classList.toggle('done', box.checked);
            save();
          },
        });
        li.classList.toggle('done', !!state.checks[id]?.done);
        li.prepend(box);
      }
    }

    // Decision map: one DSA note per item.
    const dec = $('section[data-canonical=decisions]', main);
    if (dec) {
      let items = $$(':scope > ol > li', dec);
      const targets = items.length ? items : [dec];
      for (const el of targets) {
        const title = el === dec ? 'This decision map' : norm(($('strong', el) || el).textContent).slice(0, 160);
        const id = el === dec ? 'decisions:section' : `dsa:${hash(title)}`;
        seen.dsa.add(id);
        el.append(dsaWidget(id, title));
      }
    }
    function dsaWidget(id, title) {
      const d = () => (state.dsa[id] ||= { title, chosen: '', reasons: '', rejected: '', why: '' });
      const field = (name, label, multi, placeholder) => {
        const input = h(multi ? 'textarea' : 'input', {
          value: state.dsa[id]?.[name] || '',
          placeholder,
          rows: multi ? 3 : null,
          oninput: debounce(() => {
            Object.assign(d(), { [name]: input.value, title, at: now() });
            summary.textContent = summaryText();
            wrap.classList.toggle('decided', !!state.dsa[id]?.chosen);
            save();
          }, 300),
        });
        return h('label', h('span', label), input);
      };
      const summaryText = () => (state.dsa[id]?.chosen ? `DSA: ${state.dsa[id].chosen}` : 'Write the DSA');
      const summary = h('summary', summaryText());
      const wrap = h(
        'details.dsa',
        { class: state.dsa[id]?.chosen ? 'dsa decided' : 'dsa' },
        summary,
        field('chosen', 'Chosen option', false, 'What you picked'),
        field('reasons', 'Reasons', true, 'Why, in terms of the axis and the forcing question'),
        field('rejected', 'Rejected alternative', false, 'One option you did not pick'),
        field('why', 'Why not', true, 'What would have to change for it to win'),
      );
      return wrap;
    }

    // Research targets: a timer per "N min" and a done-when checkbox.
    const res = $('section[data-canonical=research]', main);
    if (res) {
      const blocks = $$(':scope > ul > li, :scope > ol > li, :scope > p', res);
      for (const el of blocks) {
        const text = norm(el.textContent);
        const mins = [...text.matchAll(/(\d{1,3})[\s-]*(?:min\b|mins\b|minutes?\b)/gi)].map((m) => +m[1]);
        if (!mins.length) continue;
        const id = `research:${hash(text)}`;
        seen.research.add(id);
        const label = norm(($('strong, em', el) || el).textContent).replace(/[—–-]\s*\d+.*$/, '').slice(0, 80) || text.slice(0, 80);
        el.append(researchWidget(id, label, text, [...new Set(mins)]));
      }
    }
    function researchWidget(id, label, text, mins) {
      const r = () => (state.research[id] ||= { text: text.slice(0, 200), sessions: [] });
      const done = h('input', {
        type: 'checkbox',
        checked: state.research[id]?.done,
        onchange: () => {
          Object.assign(r(), { done: done.checked, at: now() });
          save();
        },
      });
      const log = h('span.muted.sessions');
      const drawLog = () => {
        const s = state.research[id]?.sessions || [];
        const total = s.reduce((a, b) => a + b.minutes, 0);
        log.textContent = s.length ? `${s.length} session${s.length > 1 ? 's' : ''}, ${Math.round(total)} min` : '';
      };
      drawLog();
      document.addEventListener('gauntlet:research', (e) => {
        if (e.detail.key !== key || e.detail.item !== id) return;
        state = Store.load(key);
        drawLog();
      });
      return h(
        'div.research-tools',
        mins.map((m) =>
          h(
            'button.timer-btn',
            {
              type: 'button',
              onclick: () => {
                if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
                if (Timer.get() && !confirm('Another timebox is running. Stop it and start this one?')) return;
                Timer.stop(true);
                Timer.start({ key, item: id, label, minutes: m });
              },
            },
            `▶ ${m} min`,
          ),
        ),
        h('label.check', done, ' Done when met'),
        log,
      );
    }

    // Hint ladders: reveal one rung at a time; near-spoilers wait for attempts.
    for (const det of $$('section[data-canonical=hints] details', main)) {
      const sum = $('summary', det);
      const id = `hint:${hash(sum ? sum.textContent : det.textContent.slice(0, 120))}`;
      seen.hints.add(id);
      const rungs = $$(':scope > p', det).filter((p) => p.firstElementChild?.tagName === 'STRONG' && p.textContent.trim().startsWith(p.firstElementChild.textContent.trim()) && /:\s*$|:/.test(p.firstElementChild.textContent));
      if (rungs.length < 2) continue;
      det.classList.add('ladder');
      const hs = () => (state.hints[id] ||= { revealed: 1, attempts: [] });
      const need = (p) => {
        const t = p.firstElementChild.textContent.toLowerCase();
        if (!/spoiler/.test(t)) return 0;
        const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
        const m = t.match(/after (\d+|one|two|three|four|five) attempts?/);
        return m ? +m[1] || words[m[1]] : 2;
      };
      const controls = h('div.ladder-tools');
      det.append(controls);
      const draw = () => {
        const s = state.hints[id] || { revealed: 1, attempts: [] };
        rungs.forEach((p, i) => (p.hidden = i >= s.revealed));
        const nextRung = rungs[s.revealed];
        const attempts = s.attempts.length;
        const kids = [];
        if (nextRung) {
          const n = need(nextRung);
          const label = nextRung.firstElementChild.textContent.replace(/[:.]\s*$/, '');
          const locked = attempts < n;
          kids.push(
            h(
              'button',
              {
                type: 'button',
                disabled: locked,
                onclick: () => {
                  hs().revealed = s.revealed + 1;
                  save();
                  draw();
                },
              },
              locked ? `${label}: log ${n - attempts} more attempt${n - attempts > 1 ? 's' : ''} first` : `Reveal: ${label}`,
            ),
          );
        }
        kids.push(
          h(
            'button.ghost',
            {
              type: 'button',
              onclick: () => {
                const note = prompt('What did you try, and what happened?');
                if (note == null) return;
                hs().attempts.push({ at: now(), note });
                save();
                draw();
              },
            },
            'Log an attempt',
          ),
        );
        if (attempts) kids.push(h('ol.attempts', s.attempts.map((a) => h('li', h('time', fmtDate(a.at)), ' ', a.note || '(no note)'))));
        controls.replaceChildren(...kids);
      };
      draw();
    }

    // Measure ritual: a log of numbers.
    const meas = $('section[data-canonical=measure]', main);
    if (meas) meas.append(measureWidget());
    function measureWidget() {
      const what = h('input', { placeholder: 'What you measured', 'aria-label': 'What you measured' });
      const val = h('input', { placeholder: 'Number', 'aria-label': 'Value', class: 'num' });
      const note = h('input', { placeholder: 'Conditions / note', 'aria-label': 'Note' });
      const rows = h('tbody');
      const draw = () =>
        rows.replaceChildren(
          ...state.measures.map((m, i) =>
            h(
              'tr',
              h('td', h('time', fmtDate(m.at))),
              h('td', m.label),
              h('td.num', m.value),
              h('td', m.note),
              h('td', h('button.x', { type: 'button', title: 'Delete', onclick: () => (state.measures.splice(i, 1), save(), draw()) }, '×')),
            ),
          ),
        );
      draw();
      const add = (e) => {
        e.preventDefault();
        if (!val.value.trim() && !what.value.trim()) return;
        state.measures.push({ at: now(), label: what.value.trim(), value: val.value.trim(), note: note.value.trim() });
        save();
        draw();
        val.value = note.value = '';
        val.focus();
      };
      return h(
        'div.measure-log',
        h('h3', 'Measure log'),
        h('table', h('thead', h('tr', h('th', 'When'), h('th', 'What'), h('th.num', 'Value'), h('th', 'Note'), h('th'))), rows),
        h('form.row', { onsubmit: add }, what, val, note, h('button', { type: 'submit' }, 'Add')),
      );
    }

    // Workspace: code files, parking lot, own checklist, orphans, export.
    const ws = $('[data-widget=workspace]', main);
    if (ws) renderWorkspace(ws);
    function renderWorkspace(root) {
      root.replaceChildren(codeEditor(), listWidget('parking', 'Parking lot', 'Interesting, but not today…', false), listWidget('todo', 'Your checklist', 'Something you must be able to show…', true), orphans(), moduleExport());
    }

    function codeEditor() {
      let current = Object.keys(state.files)[0] || null;
      const tabs = h('div.tabs', { role: 'tablist' });
      const area = h('textarea.code', { spellcheck: 'false', 'aria-label': 'Code', autocapitalize: 'off', autocomplete: 'off' });
      const empty = h('p.muted', 'No files yet. Add one: it is saved as a real file when a workspace folder is connected.');
      const persist = debounce(() => {
        if (current == null) return;
        state.files[current] = area.value;
        save();
      }, 400);
      area.addEventListener('input', persist);
      area.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          area.setRangeText('  ', area.selectionStart, area.selectionEnd, 'end');
          persist();
        }
      });
      const draw = () => {
        tabs.replaceChildren(
          ...Object.keys(state.files).map((name) =>
            h('button', { type: 'button', role: 'tab', 'aria-selected': String(name === current), onclick: () => ((current = name), draw()) }, name),
          ),
          h('button.ghost', { type: 'button', onclick: addFile }, '+ File'),
        );
        area.hidden = current == null;
        empty.hidden = current != null;
        tools.hidden = current == null;
        if (current != null) area.value = state.files[current];
      };
      const validName = (n) => n && /^[\w.\- ]+$/.test(n) && !n.startsWith('.') && n !== 'notes.json';
      function addFile() {
        const name = (prompt('File name (e.g. main.ts, notes.sql):', '') || '').trim();
        if (!name) return;
        if (!validName(name)) return toast('Use letters, digits, dots, dashes and underscores only.');
        if (name in state.files) return toast('That file already exists.');
        state.files[name] = '';
        current = name;
        save();
        draw();
        area.focus();
      }
      const tools = h(
        'div.row',
        h('button.ghost', {
          type: 'button',
          onclick: () => {
            const name = (prompt('Rename to:', current) || '').trim();
            if (!name || name === current) return;
            if (!validName(name) || name in state.files) return toast('Invalid or duplicate name.');
            state.files[name] = state.files[current];
            delete state.files[current];
            current = name;
            save();
            draw();
          },
        }, 'Rename'),
        h('button.ghost', { type: 'button', onclick: () => download(current, state.files[current], 'text/plain') }, 'Download'),
        h('button.ghost.danger', {
          type: 'button',
          onclick: () => {
            if (!confirm(`Delete ${current}?`)) return;
            delete state.files[current];
            current = Object.keys(state.files)[0] || null;
            save();
            draw();
          },
        }, 'Delete'),
      );
      draw();
      return h('div.editor', h('h3', 'Code'), tabs, empty, area, tools);
    }

    function listWidget(field, title, placeholder, checkable) {
      const input = h('input', { placeholder, 'aria-label': title });
      const ul = h('ul.plain');
      const draw = () =>
        ul.replaceChildren(
          ...state[field].map((it, i) =>
            h(
              'li',
              { class: it.done ? 'done' : null },
              checkable && h('input', { type: 'checkbox', checked: it.done, onchange: (e) => ((it.done = e.target.checked), save(), draw()) }),
              h('span', it.text),
              h('button.x', { type: 'button', title: 'Delete', onclick: () => (state[field].splice(i, 1), save(), draw()) }, '×'),
            ),
          ),
        );
      draw();
      return h(
        'div.listw',
        h('h3', title),
        ul,
        h('form.row', {
          onsubmit: (e) => {
            e.preventDefault();
            if (!input.value.trim()) return;
            state[field].push({ text: input.value.trim(), at: now(), done: false });
            input.value = '';
            save();
            draw();
          },
        }, input, h('button', { type: 'submit' }, 'Add')),
      );
    }

    /** Notes whose source text changed after a re-parse: shown, never silently dropped. */
    function orphans() {
      const lost = [
        ...Object.entries(state.dsa).filter(([id, d]) => !seen.dsa.has(id) && (d.chosen || d.reasons)).map(([id, d]) => ['dsa', id, `Decision: ${d.title} → ${d.chosen}`]),
        ...Object.entries(state.checks).filter(([id, c]) => !seen.checks.has(id) && c.done).map(([id, c]) => ['checks', id, `Checked: ${c.text}`]),
        ...Object.entries(state.research).filter(([id, r]) => !seen.research.has(id) && (r.done || r.sessions?.length)).map(([id, r]) => ['research', id, `Research: ${r.text}`]),
      ];
      if (!lost.length) return '';
      return h(
        'div.orphans',
        h('h3', 'Notes on text that changed'),
        h('p.muted', 'The source text these belonged to was edited or removed. They are kept here until you delete them.'),
        h('ul.plain', lost.map(([f, id, label]) => h('li', h('span', label), h('button.x', { type: 'button', onclick: (e) => (delete state[f][id], save(), e.target.parentElement.remove()) }, '×')))),
      );
    }

    function moduleExport() {
      return h(
        'div.row.export',
        h('button.ghost', { type: 'button', onclick: () => download(`${key}-notes.md`, toMarkdown(main, state), 'text/markdown') }, 'Download notes (.md)'),
        h('button.ghost', { type: 'button', onclick: () => download(`${key}.json`, JSON.stringify(state, null, 2), 'application/json') }, 'Download data (.json)'),
      );
    }

    function updateProgress() {
      const p = progressOf(state, seen);
      ls.set('p:' + key, { ...p, updatedAt: now() });
      const el = $('[data-progress]');
      if (el) el.replaceChildren(progressBar(p), h('span.muted', `${p.done} / ${p.total} done`));
    }
    updateProgress();

    // A newer copy in the workspace folder wins: reload once with it.
    if (Disk.state === 'on') {
      Disk.read(key).then((disk) => {
        if (disk && (disk.updatedAt || '') > (state.updatedAt || '')) {
          ls.set('m:' + key, disk);
          location.reload();
        }
      });
    }
  }

  function progressOf(state, seen) {
    const ids = [...seen.checks].map((id) => !!state.checks[id]?.done)
      .concat([...seen.dsa].map((id) => !!state.dsa[id]?.chosen))
      .concat([...seen.research].map((id) => !!state.research[id]?.done));
    return { done: ids.filter(Boolean).length, total: ids.length };
  }
  function progressBar(p) {
    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
    return h('span.bar', { role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: `width:${pct}%` }));
  }

  function toMarkdown(main, s) {
    const out = [`# ${main.dataset.title}`, '', `Key: \`${s.key}\` · exported ${fmtDate(now())}`, ''];
    const sec = (t) => out.push(`## ${t}`, '');
    const dsa = Object.values(s.dsa).filter((d) => d.chosen || d.reasons);
    if (dsa.length) {
      sec('Decisions (DSA)');
      for (const d of dsa) out.push(`### ${d.title}`, '', `- **Chosen:** ${d.chosen}`, `- **Reasons:** ${d.reasons}`, `- **Rejected:** ${d.rejected}`, `- **Why not:** ${d.why}`, '');
    }
    const checks = Object.values(s.checks);
    if (checks.length) {
      sec('Checklist');
      for (const c of checks) out.push(`- [${c.done ? 'x' : ' '}] ${c.text}`);
      out.push('');
    }
    const res = Object.values(s.research);
    if (res.length) {
      sec('Research');
      for (const r of res) out.push(`- [${r.done ? 'x' : ' '}] ${r.text} (${(r.sessions || []).reduce((a, b) => a + b.minutes, 0)} min logged)`);
      out.push('');
    }
    const attempts = Object.values(s.hints).flatMap((x) => x.attempts || []);
    if (attempts.length) {
      sec('Attempts');
      for (const a of attempts) out.push(`- ${fmtDate(a.at)}: ${a.note}`);
      out.push('');
    }
    if (s.measures.length) {
      sec('Measurements');
      out.push('| When | What | Value | Note |', '|---|---|---|---|');
      for (const m of s.measures) out.push(`| ${fmtDate(m.at)} | ${m.label} | ${m.value} | ${m.note} |`);
      out.push('');
    }
    for (const [field, title] of [['todo', 'Your checklist'], ['parking', 'Parking lot']]) {
      if (!s[field].length) continue;
      sec(title);
      for (const it of s[field]) out.push(field === 'todo' ? `- [${it.done ? 'x' : ' '}] ${it.text}` : `- ${it.text}`);
      out.push('');
    }
    for (const [name, code] of Object.entries(s.files)) {
      const fence = code.includes('```') ? '````' : '```';
      out.push(`## ${name}`, '', fence + (name.split('.').pop() || ''), code, fence, '');
    }
    return out.join('\n');
  }

  function download(name, text, type) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a);
    a.click();
    setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
  }

  // ------------------------------------------------------- index pages

  function initCards() {
    for (const card of $$('[data-key]')) {
      const p = ls.get('p:' + card.dataset.key);
      const slot = $('[data-card-progress]', card);
      if (!p || !slot || !p.total) continue;
      card.classList.toggle('started', p.done > 0);
      card.classList.toggle('complete', p.done === p.total);
      slot.replaceChildren(progressBar(p), h('span.muted', `${p.done}/${p.total}`));
    }
    const catalog = (() => {
      try {
        return JSON.parse($('#catalog')?.textContent || 'null');
      } catch {
        return null;
      }
    })();
    for (const el of $$('[data-volume-progress]')) {
      const vol = el.dataset.volumeProgress;
      const keys = catalog?.[vol] || $$(`main [data-key]`).map((c) => c.dataset.key);
      const ps = keys.map((k) => ls.get('p:' + k)).filter((p) => p && p.done);
      if (!ps.length) continue;
      const complete = ps.filter((p) => p.done === p.total).length;
      el.textContent = `${ps.length} of ${keys.length} started · ${complete} complete`;
    }
  }

  function initSearch() {
    const input = $('[data-search-input]');
    const results = $('[data-search-results]');
    if (!input || !results) return;
    const grid = $('.vol-grid');
    input.addEventListener('input', () => {
      const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      results.hidden = !terms.length;
      if (grid) grid.hidden = !!terms.length;
      for (const li of results.children) li.hidden = !terms.every((t) => li.dataset.search.includes(t));
    });
  }

  function renderDataPanel(panel) {
    const modules = Store.all().filter((s) => s.updatedAt);
    const kids = [h('h2', 'Your work')];
    kids.push(
      h('p', modules.length ? `You have notes in ${modules.length} module${modules.length > 1 ? 's' : ''}.` : 'No notes yet. Open a module and start with its decision map.'),
    );
    if (Disk.supported) {
      kids.push(
        h('p.muted', Disk.state === 'on'
          ? `Saving to the folder “${Disk.root.name}”, one sub-folder per module (notes.json plus your code files), and to this browser.`
          : 'Pick a folder (for example this project’s workspace/ folder) to also save everything as real files you can open in your editor and commit.'),
        h('div.row',
          h('button', { type: 'button', onclick: () => Disk.connect().then(() => renderDataPanel(panel)) }, Disk.state === 'off' ? 'Choose workspace folder' : Disk.state === 'on' ? 'Sync now' : 'Reconnect folder'),
          Disk.state !== 'off' && h('button.ghost', { type: 'button', onclick: () => Disk.disconnect() }, 'Disconnect')),
      );
    } else {
      kids.push(h('p.muted', 'Saved in this browser. This browser cannot write to a folder (Chrome and Edge can), so export a backup now and then.'));
    }
    const file = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: () => importAll(file.files[0]) });
    kids.push(
      h('div.row',
        h('button.ghost', { type: 'button', onclick: exportAll }, 'Export all (.json)'),
        h('button.ghost', { type: 'button', onclick: () => file.click() }, 'Import…'),
        file,
        h('button.ghost.danger', {
          type: 'button',
          onclick: () => {
            if (!confirm('Delete all notes stored in this browser? Files in a workspace folder are not touched.')) return;
            for (const k of ls.keys('m:')) ls.del('m:' + k);
            for (const k of ls.keys('p:')) ls.del('p:' + k);
            location.reload();
          },
        }, 'Clear browser data')),
    );
    panel.replaceChildren(...kids);
  }

  function exportAll() {
    const modules = Object.fromEntries(Store.all().map((s) => [s.key, s]));
    const progress = Object.fromEntries(ls.keys('p:').map((k) => [k, ls.get('p:' + k)]));
    download(`gauntlet-work-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ format: 'gauntlet-work', v: 1, exportedAt: now(), modules, progress }, null, 2), 'application/json');
  }

  async function importAll(f) {
    if (!f) return;
    let data;
    try {
      data = JSON.parse(await f.text());
    } catch {
      return toast('That file is not valid JSON.');
    }
    if (data.format !== 'gauntlet-work') return toast('That is not a Gauntlet export.');
    let n = 0;
    for (const [key, s] of Object.entries(data.modules || {})) {
      const local = ls.get('m:' + key);
      if (local && (local.updatedAt || '') >= (s.updatedAt || '')) continue;
      ls.set('m:' + key, s);
      if (data.progress?.[key]) ls.set('p:' + key, data.progress[key]);
      Disk.queue(Object.assign(blank(key), s));
      n++;
    }
    toast(`Imported ${n} module${n === 1 ? '' : 's'} (newer copies kept).`);
    setTimeout(() => location.reload(), 800);
  }

  // ---------------------------------------------------------------- misc

  function initChrome() {
    $('[data-action=theme]')?.addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme;
      const dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      const next = dark ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(NS + 'theme', next);
      } catch {}
    });
    $('[data-action=workspace]')?.addEventListener('click', () => {
      if (Disk.state === 'needs-permission') Disk.connect().then((ok) => ok && location.reload());
      else location.href = 'index.html#your-work';
    });
    window.addEventListener('storage', (e) => {
      if (e.key === NS + 'timer') Timer.render();
    });
  }

  window.renderMermaid = () => {
    if (!window.mermaid) return;
    const t = document.documentElement.dataset.theme;
    const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    window.mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'strict' });
    window.mermaid.run({ querySelector: 'pre.mermaid' });
  };

  async function main() {
    initChrome();
    Timer.render();
    await Disk.init();
    const mod = $('main[data-module]');
    if (mod) initModule(mod);
    initCards();
    initSearch();
    const panel = $('[data-widget=data-panel]');
    if (panel) {
      panel.id = 'your-work';
      renderDataPanel(panel);
    }
  }
  main();
})();
