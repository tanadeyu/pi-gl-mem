/**
 * pi-local-mem.ts v1.0.0 (2026-06-20)・独立完結版・仕様書10準拠
 * 【概要】
 * プロジェクト（カレントディレクトリ）直下にのみ、独立した記憶領域を展開・管理するプラグイン。
 * pi-mem（@haha1903/pi-mem）と互換の4ファイル＋4ツール構成を、pi-memへの依存なしに自己完結で実現。
 * PC全体に「一度だけ」インストールすれば、今後の全プロジェクトで完全自動で記憶を分離する。
 * 【独立性について】
 * 本プラグインは pi-mem への import を一切行わない。必要な関数はすべて内部にコピー持参する。
 * よって pi-mem が packages になくても動き、将来 pi-mem が消えても/使わなくても同等機能を維持する。
 * 【安全性・競合リスクゼロについて】
 * 他プラグインのコードを書き換えない「完全外付け型」の非破壊設計。
 * 【1. インストール方法】
 *   $ pi uninstall https://github.com/tanadeyu/pi-local-mem  # 既存登録の除去
 *   $ pi install https://github.com/tanadeyu/pi-local-mem
 * ※pi install は参照登録のみ。インストール後も元ファイルは削除・移動不可。
 * ※参照先を変える際は install 単独だと旧エントリが残ることがあるため、一度 uninstall してから install すること。
 * 【2. 使い方】
 * 新しいプロジェクトフォルダに移動し、pi を起動するだけ。.pi-local-mem/ が完全自動で展開される。
 * 【3. グローバル記憶の遮断（injectGlobal）】
 * .pi-local-mem/pi_memory_local.json の "injectGlobal": false で、pi-mem が注入する <pi-mem-injected> を
 * 送信前に除去（後段 context フィルタ方式）。packages 順序で pi-mem が pi-local-mem より前であることが前提。
 * 【4. アンインストール】
 *   A. $ pi uninstall https://github.com/tanadeyu/pi-local-mem
 *   B. 手動クリーンアップ: $ rm -rf ./.pi-local-mem
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import * as fs from 'fs';
import * as path from 'path';
// --- 内部関数群（pi-mem/lib.ts と同等ロジックをコピー持参・完全独立）---
function nowTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}
function shortSessionId(id: string): string {
  return id.slice(0, 8);
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function readFileSafe(filePath: string): string | null {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}
function dailyPath(dailyDir: string, date: string): string {
  return path.join(dailyDir, `${date}.md`);
}
interface ScratchpadItem { done: boolean; text: string; meta: string; }
function parseScratchpad(content: string): ScratchpadItem[] {
  const items: ScratchpadItem[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^- \[([ xX])\] (.+)$/);
    if (match) {
      let meta = '';
      if (i > 0 && lines[i - 1].match(/^<!--.*-->$/)) meta = lines[i - 1];
      items.push({ done: match[1].toLowerCase() === 'x', text: match[2], meta });
    }
  }
  return items;
}
function serializeScratchpad(items: ScratchpadItem[]): string {
  const lines: string[] = ['# Scratchpad', ''];
  for (const item of items) {
    if (item.meta) lines.push(item.meta);
    lines.push(`- ${item.done ? '[x]' : '[ ]'} ${item.text}`);
  }
  return lines.join('\n') + '\n';
}
export default function (pi: ExtensionAPI) {
  const currentDir = process.cwd();
  const localDir = path.join(currentDir, '.pi-local-mem');
  const dailyDir = path.join(localDir, 'daily_local');
  const notesDir = path.join(localDir, 'notes_local');
  const memoryFile = path.join(localDir, 'MEMORY_local.md');
  const scratchpadFile = path.join(localDir, 'SCRATCHPAD_local.md');
  const configPath = path.join(localDir, 'pi_memory_local.json');
  // 1. 起動時に隠しフォルダと全ファイルを展開（存在時はスキップ・ユーザー設定保護）
  if (!fs.existsSync(localDir)) {
    try {
      fs.mkdirSync(dailyDir, { recursive: true });
      fs.mkdirSync(notesDir, { recursive: true });
      fs.writeFileSync(memoryFile, '# プロジェクト個別記憶\n\nここにこのプロジェクト特有の仕様・型定義・TODO・決定事項などを記録してください。\n', 'utf8');
      fs.writeFileSync(scratchpadFile, '# Scratchpad (local)\n', 'utf8');
      fs.writeFileSync(configPath, JSON.stringify({ injectLocal: true, injectGlobal: true }, null, 2), 'utf8');
    } catch (err) {
      console.error(`⚠️ pi-local-mem: 初期化に失敗しました: ${err.message}`);
    }
  }
  // 2. 設定ファイルの安全な読み込み
  let config: { injectLocal?: boolean; injectGlobal?: boolean } = { injectLocal: true, injectGlobal: true };
  if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) {
      console.warn('⚠️ pi-local-mem: 設定ファイルのパースに失敗したため、デフォルト(true)で起動します。');
    }
  }
  // 3. コンテキスト注入（ローカル記憶をAI頭脳へ自動マージ + Local Log Rule）
  //    pi-mem の Daily Log Rule と同基準・ツール名だけ差し替え。
  const localLogRule = [
    '### Local Log Rule',
    'After meaningful interactions, call write_local_memory(target="daily") with a brief 1-2 sentence summary.',
    '**Log when:** task completed, decision made, bug fixed, new info discovered, config changed.',
    '**Skip when:** greetings, goodbyes, chitchat, simple acks, trivial factual questions.',
    'Log the outcome, not the question (e.g. "Debugged import error — missing __init__.py" not "User asked about imports").',
    '',
    '### Local Memory Targets',
    '- Decisions, preferences, durable facts → write_local_memory(target="long_term")',
    '- Day-to-day notes → write_local_memory(target="daily")',
    '- Things to fix later → local_scratchpad tool',
    '- Scratchpad is NOT auto-loaded. Use read_local_memory(target="scratchpad") when needed.',
    '- If someone says "remember this," write it immediately.',
  ].join('\n');
  if (config.injectLocal !== false) {
    pi.on('before_agent_start', async (event, _ctx) => {
      try {
        const sections: string[] = [];
        const mem = readFileSafe(memoryFile)?.trim();
        if (mem) sections.push(`## MEMORY.md (long-term)\n\n${mem}`);
        const today = readFileSafe(dailyPath(dailyDir, todayStr()))?.trim();
        if (today) sections.push(`## Daily log: ${todayStr()} (today)\n\n${today}`);
        const yd = readFileSafe(dailyPath(dailyDir, yesterdayStr()))?.trim();
        if (yd) sections.push(`## Daily log: ${yesterdayStr()} (yesterday)\n\n${yd}`);
        const body = sections.length ? `# Memory\n\n${sections.join('\n\n---\n\n')}` : '';
        const section = body ? `${body}\n\n${localLogRule}` : localLogRule;
        return { systemPrompt: event.systemPrompt + `\n\n### [PROJECT LOCAL MEMORY - 優先]\n${section}\n` };
      } catch (e) { return {}; }
    });
  }
  // 4. グローバル記憶（pi-mem）の注入遮断 —— context 後段フィルタ
  if (config.injectGlobal === false) {
    pi.on('context', async (event) => {
      try {
        const messages = (event.messages as any[]).filter(m => {
          if (m.role === 'user' && typeof m.content === 'string') return !m.content.includes('<pi-mem-injected>');
          return true;
        });
        return { messages };
      } catch (e) { return {}; }
    });
  }
  // 5. セッションID取得ヘルパ（ctxから安全に取得）
  function getSid(ctx: any): string {
    try { return shortSessionId(String(ctx.sessionManager.getSessionId())); } catch { return '--------'; }
  }
  // 6. ツール: write_local_memory（pi-mem: memory_write 互換）
  pi.registerTool({
    name: 'write_local_memory',
    label: 'Write Local Memory',
    description: [
      '現在のプロジェクトの .pi-local-mem/ へ記憶を書き込むツール（pi-mem memory_write 互換・完全独立）。',
      'target: "long_term"→MEMORY.md / "daily"→daily/YYYY-MM-DD.md / "note"→notes/<filename>.md',
      'mode: "append"(既定) or "overwrite"。daily は常に append。タイムスタンプ+セッションID(先頭8桁)自動付与。',
    ].join('\n'),
    parameters: Type.Object({
      target: Type.String({ description: 'long_term | daily | note' }),
      content: Type.String({ description: '書き込む内容（Markdown）' }),
      mode: Type.Optional(Type.String({ description: 'append or overwrite. default: append' })),
      filename: Type.Optional(Type.String({ description: 'target=note の時に必須 (例: lessons.md)' })),
    }),
    async execute(_id, params, _s, _o, ctx) {
      try {
        fs.mkdirSync(dailyDir, { recursive: true });
        fs.mkdirSync(notesDir, { recursive: true });
        const ts = nowTimestamp();
        const sid = getSid(ctx);
        const stamped = `<!-- ${ts} [${sid}] -->\n${params.content}`;
        const { target, content, mode, filename } = params;
        if (target === 'daily') {
          const file = dailyPath(dailyDir, todayStr());
          const existing = readFileSafe(file) ?? '';
          const sep = existing.trim() ? '\n\n' : '';
          fs.writeFileSync(file, existing + sep + stamped, 'utf8');
          return { content: [{ type: 'text', text: `✅ daily/${todayStr()}.md に追記しました` }] };
        }
        if (target === 'note') {
          if (!filename) return { content: [{ type: 'text', text: "Error: 'filename' required for target 'note'." }] };
          const safe = path.basename(filename);
          const file = path.join(notesDir, safe);
          if (mode === 'overwrite') { fs.writeFileSync(file, stamped, 'utf8'); return { content: [{ type: 'text', text: `✅ notes/${safe} を上書きしました` }] }; }
          const existing = readFileSafe(file) ?? '';
          const sep = existing.trim() ? '\n\n' : '';
          fs.writeFileSync(file, existing + sep + stamped, 'utf8');
          return { content: [{ type: 'text', text: `✅ notes/${safe} に追記しました` }] };
        }
        // long_term
        if (mode === 'overwrite') { fs.writeFileSync(memoryFile, stamped, 'utf8'); return { content: [{ type: 'text', text: '✅ MEMORY.md を上書きしました' }] }; }
        const existing = readFileSafe(memoryFile) ?? '';
        const sep = existing.trim() ? '\n\n' : '';
        fs.writeFileSync(memoryFile, existing + sep + stamped, 'utf8');
        return { content: [{ type: 'text', text: '✅ MEMORY.md に追記しました' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ 保存失敗: ${err.message}` }], isError: true };
      }
    },
  });
  // 7. ツール: read_local_memory（pi-mem: memory_read 互換）
  pi.registerTool({
    name: 'read_local_memory',
    label: 'Read Local Memory',
    description: [
      'ローカル記憶を読むツール（pi-mem memory_read 互換）。',
      'target: long_term|scratchpad|daily|note|list。SCRATCHPAD/notes は手動read。',
    ].join('\n'),
    parameters: Type.Object({
      target: Type.String({ description: 'long_term | scratchpad | daily | note | list' }),
      date: Type.Optional(Type.String({ description: 'target=daily の日付(YYYY-MM-DD)。既定: 今日' })),
      filename: Type.Optional(Type.String({ description: 'target=note のファイル名' })),
    }),
    async execute(_id, params) {
      const { target, date, filename } = params;
      try {
        if (target === 'list') {
          const parts: string[] = [];
          const root = fs.readdirSync(localDir).filter((f: string) => f.endsWith('.md')).sort();
          if (root.length) parts.push(`Files:\n${root.map((f: string) => `- ${f}`).join('\n')}`);
          const dl = fs.readdirSync(dailyDir).filter((f: string) => f.endsWith('.md')).sort().reverse();
          if (dl.length) parts.push(`Daily (${dl.length}):\n${dl.slice(0, 10).map((f: string) => `- daily/${f}`).join('\n')}`);
          const nl = fs.readdirSync(notesDir).filter((f: string) => f.endsWith('.md')).sort();
          if (nl.length) parts.push(`Notes:\n${nl.map((f: string) => `- notes/${f}`).join('\n')}`);
          return { content: [{ type: 'text', text: parts.join('\n\n') || '空です' }] };
        }
        if (target === 'scratchpad') {
          const c = readFileSafe(scratchpadFile);
          return { content: [{ type: 'text', text: c?.trim() || 'SCRATCHPAD.md は空です' }] };
        }
        if (target === 'daily') {
          const d = date ?? todayStr();
          const c = readFileSafe(dailyPath(dailyDir, d));
          return { content: [{ type: 'text', text: c || `No daily log for ${d}` }] };
        }
        if (target === 'note') {
          if (!filename) return { content: [{ type: 'text', text: "Error: 'filename' required" }] };
          const c = readFileSafe(path.join(notesDir, path.basename(filename)));
          return { content: [{ type: 'text', text: c || `Not found: notes/${filename}` }] };
        }
        const c = readFileSafe(memoryFile);
        return { content: [{ type: 'text', text: c || 'MEMORY.md は空です' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }], isError: true };
      }
    },
  });
  // 8. ツール: local_scratchpad（pi-mem: scratchpad 互換・名前衝突回避）
  pi.registerTool({
    name: 'local_scratchpad',
    label: 'Local Scratchpad',
    description: 'チェックリスト管理。action: add|done|undo|clear_done|list。textはadd/done/undoで使用(substring一致)。',
    parameters: Type.Object({
      action: Type.String({ description: 'add | done | undo | clear_done | list' }),
      text: Type.Optional(Type.String({ description: 'add/done/undo の文字列' })),
    }),
    async execute(_id, params, _s, _o, ctx) {
      try {
        const existing = readFileSafe(scratchpadFile) ?? '';
        let items = parseScratchpad(existing);
        const { action, text } = params;
        const ts = nowTimestamp();
        const sid = getSid(ctx);
        if (action === 'list') {
          return { content: [{ type: 'text', text: items.length ? serializeScratchpad(items) : '空です' }] };
        }
        if (action === 'add') {
          if (!text) return { content: [{ type: 'text', text: "Error: 'text' required" }] };
          items.push({ done: false, text, meta: `<!-- ${ts} [${sid}] -->` });
          fs.writeFileSync(scratchpadFile, serializeScratchpad(items), 'utf8');
          return { content: [{ type: 'text', text: `Added: - [ ] ${text}` }] };
        }
        if (action === 'done' || action === 'undo') {
          if (!text) return { content: [{ type: 'text', text: `Error: 'text' required for ${action}` }] };
          const needle = text.toLowerCase();
          const targetDone = action === 'done';
          let matched = false;
          for (const item of items) {
            if (item.done !== targetDone && item.text.toLowerCase().includes(needle)) { item.done = targetDone; matched = true; break; }
          }
          if (!matched) return { content: [{ type: 'text', text: `No match: "${text}"` }] };
          fs.writeFileSync(scratchpadFile, serializeScratchpad(items), 'utf8');
          return { content: [{ type: 'text', text: 'Updated.' }] };
        }
        if (action === 'clear_done') {
          const before = items.length;
          items = items.filter(i => !i.done);
          fs.writeFileSync(scratchpadFile, serializeScratchpad(items), 'utf8');
          return { content: [{ type: 'text', text: `Cleared ${before - items.length} item(s).` }] };
        }
        return { content: [{ type: 'text', text: `Unknown action: ${action}` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }], isError: true };
      }
    },
  });
  // 9. ツール: search_local_memory（pi-mem: memory_search 互換・簡易grep）
  pi.registerTool({
    name: 'search_local_memory',
    label: 'Search Local Memory',
    description: '.pi-local-mem/ 配下の.mdをファイル名+内容の部分一致で検索（大文字小文字無視）。',
    parameters: Type.Object({
      query: Type.String({ description: '検索クエリ' }),
      max_results: Type.Optional(Type.Number({ description: '最大結果数(既定20)' })),
    }),
    async execute(_id, params) {
      try {
        const needle = params.query.toLowerCase();
        const limit = params.max_results ?? 20;
        const fileMatches: string[] = [];
        const lines: { file: string; line: number; text: string }[] = [];
        const searchFile = (file: string, disp: string) => {
          if (disp.toLowerCase().includes(needle) && !fileMatches.includes(disp)) fileMatches.push(disp);
          const c = readFileSafe(file);
          if (!c) return;
          const ls = c.split('\n');
          for (let i = 0; i < ls.length && lines.length < limit; i++) {
            if (ls[i].toLowerCase().includes(needle)) lines.push({ file: disp, line: i + 1, text: ls[i].trimEnd() });
          }
        };
        const searchDir = (dir: string, prefix: string) => {
          try {
            const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.md')).sort();
            for (const f of files) { if (lines.length >= limit) break; searchFile(path.join(dir, f), prefix ? `${prefix}/${f}` : f); }
          } catch {}
        };
        searchDir(localDir, '');
        searchDir(dailyDir, 'daily');
        searchDir(notesDir, 'notes');
        if (!fileMatches.length && !lines.length) return { content: [{ type: 'text', text: `No results for "${params.query}"` }] };
        const parts: string[] = [];
        if (fileMatches.length) parts.push(`Files:\n${fileMatches.map(f => `- ${f}`).join('\n')}`);
        if (lines.length) parts.push(`Content:\n${lines.map(r => `${r.file}:${r.line}: ${r.text}`).join('\n')}`);
        return { content: [{ type: 'text', text: parts.join('\n\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }], isError: true };
      }
    },
  });
}
