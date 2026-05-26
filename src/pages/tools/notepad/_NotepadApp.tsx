import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { buttonStyles, inputStyles } from '@/components/ui';
import {
    KEEP_STYLES_KEY,
    sanitizeFragmentToHtml,
    sanitizePastedHtml,
    findSoleImage,
    writeImageToClipboard,
} from '@/lib/notepad/clipboard';

// IndexedDB Configuration
const DB_NAME = 'WemeeQuickMemo';
const DB_VERSION = 1;
const STORE_NAME = 'notes';
const AUTO_SAVE_DELAY = 1000;

interface Note {
    id: string;
    content: string;
    updatedAt: number;
}

// IndexedDB helpers
async function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
        };
    });
}

async function getAllNotes(db: IDBDatabase): Promise<Note[]> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('updatedAt');
        const request = index.openCursor(null, 'prev');
        const notes: Note[] = [];

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                notes.push(cursor.value);
                cursor.continue();
            } else {
                resolve(notes);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

async function saveNote(db: IDBDatabase, note: Note): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(note);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function deleteNote(db: IDBDatabase, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// contentEditable "empty" is a fuzzy concept — browsers leave behind
// stray <br> / <div><br></div> markers even when the user has cleared
// everything. Treat those as empty too.
function isEditorEmpty(html: string | undefined): boolean {
    if (!html) return true;
    const stripped = html.replace(/<br\s*\/?>/gi, '').replace(/<div>\s*<\/div>/gi, '').trim();
    return stripped === '';
}

// Get title from HTML content
function getTitleFromContent(html: string): string {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const text = temp.textContent?.trim() || '';
    if (!text) return '無標題筆記';
    return text.length > 20 ? text.substring(0, 20) + '...' : text;
}

export default function NotepadApp() {
    const [db, setDb] = useState<IDBDatabase | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'hidden'>('hidden');
    const [searchTerm, setSearchTerm] = useState('');
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [keepStyles, setKeepStyles] = useState<boolean>(true);
    // Mirror of "is the editor visually empty" — drives the placeholder overlay.
    // We can't derive this from editorRef during render: refs don't trigger
    // re-renders, so a ref-based check would only update when something else
    // (e.g. auto-save status flip) happens to re-render — leaving the
    // placeholder stuck on top of freshly typed text for ~1s.
    const [isEmpty, setIsEmpty] = useState<boolean>(true);

    const editorRef = useRef<HTMLDivElement>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Ref mirror so the copy handler always reads the latest toggle without
    // having to be re-bound (and re-attached to the editor) on every change.
    const keepStylesRef = useRef(keepStyles);
    keepStylesRef.current = keepStyles;

    // Load persisted toggle on mount
    useEffect(() => {
        const stored = localStorage.getItem(KEEP_STYLES_KEY);
        if (stored !== null) setKeepStyles(stored === 'true');
    }, []);

    // Persist toggle on change
    useEffect(() => {
        localStorage.setItem(KEEP_STYLES_KEY, String(keepStyles));
    }, [keepStyles]);

    // Initialize IndexedDB
    useEffect(() => {
        openDB()
            .then(async (database) => {
                setDb(database);
                const allNotes = await getAllNotes(database);
                setNotes(allNotes);

                if (allNotes.length > 0) {
                    setCurrentNoteId(allNotes[0].id);
                    if (editorRef.current) {
                        editorRef.current.innerHTML = allNotes[0].content;
                    }
                    setIsEmpty(isEditorEmpty(allNotes[0].content));
                } else {
                    createNewNote(database, false);
                }
            })
            .catch((err) => {
                console.error('IndexedDB error:', err);
                alert('無法初始化儲存空間。您可能正在使用隱私瀏覽模式。');
            });
    }, []);

    // Create new note
    const createNewNote = useCallback(async (database: IDBDatabase, shouldSave = true) => {
        const newId = 'note_' + Date.now();
        setCurrentNoteId(newId);
        if (editorRef.current) {
            editorRef.current.innerHTML = '';
        }
        setIsEmpty(true);

        if (shouldSave) {
            const note: Note = { id: newId, content: '', updatedAt: Date.now() };
            await saveNote(database, note);
            const allNotes = await getAllNotes(database);
            setNotes(allNotes);
        }

        editorRef.current?.focus();
    }, []);

    // Save current note
    const performSave = useCallback(async () => {
        if (!db || !currentNoteId || !editorRef.current) return;

        setSaveStatus('saving');
        const note: Note = {
            id: currentNoteId,
            content: editorRef.current.innerHTML,
            updatedAt: Date.now(),
        };

        await saveNote(db, note);
        const allNotes = await getAllNotes(db);
        setNotes(allNotes);

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('hidden'), 2000);
    }, [db, currentNoteId]);

    // Handle editor input with debounce
    const handleEditorInput = useCallback(() => {
        // Synchronously flip the placeholder the instant the editor changes —
        // don't wait for the auto-save tick to incidentally re-render us.
        setIsEmpty(isEditorEmpty(editorRef.current?.innerHTML));
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        setSaveStatus('hidden');
        saveTimeoutRef.current = setTimeout(performSave, AUTO_SAVE_DELAY);
    }, [performSave]);

    // Intercept copy so we control exactly what lands on the clipboard:
    //   - text/plain  : selection.toString()  (always)
    //   - text/html   : sanitized HTML (background-color always stripped;
    //                   other text styling stripped iff keepStyles=false;
    //                   <img> always preserved)
    //   - image/png   : single-image selections additionally write a raw PNG
    //                   so the image is pastable into Photoshop/Figma/chats
    const handleCopy = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();
        const plainText = selection.toString();
        const html = sanitizeFragmentToHtml(fragment, keepStylesRef.current);
        const soleImage = findSoleImage(fragment);

        e.preventDefault();
        e.clipboardData.setData('text/plain', plainText);
        e.clipboardData.setData('text/html', html);

        if (soleImage) {
            // Fire-and-forget async write; the sync HTML/plain are already set.
            void writeImageToClipboard(soleImage);
        }
    }, []);

    // Intercept paste so external clipboards (Google Sheets, Word, web pages)
    // can't override the notepad's dark theme with their own color/font
    // declarations. The classic failure mode: gsheet's black-text cells get
    // pasted with `color: #000` inline, rendering invisible against the
    // editor's dark background. We sanitize HTML to drop all inline styling
    // but keep structure; image-only pastes (screenshots) fall through to
    // the browser's native handling so the <img> is inserted as-is.
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        const dt = e.clipboardData;

        for (let i = 0; i < dt.items.length; i++) {
            if (dt.items[i].kind === 'file' && dt.items[i].type.startsWith('image/')) {
                return;
            }
        }

        const html = dt.getData('text/html');
        const text = dt.getData('text/plain');
        if (!html && !text) return;

        e.preventDefault();
        const payload = html ? sanitizePastedHtml(html) : text;
        // execCommand is deprecated but remains the only cross-browser path
        // to insert into a contentEditable while preserving the native undo
        // stack. The notepad is small and pragmatic — accept the trade-off.
        document.execCommand(html ? 'insertHTML' : 'insertText', false, payload);
        handleEditorInput();
    }, [handleEditorInput]);

    // Cut = copy + delete selection. preventDefault() in handleCopy suppresses
    // the native deletion too, so we restore it via execCommand to keep undo
    // history intact and fire the input event for auto-save.
    const handleCut = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
        handleCopy(e);
        document.execCommand('delete');
    }, [handleCopy]);

    // Load note
    const loadNote = useCallback(async (note: Note) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            await performSave();
        }

        setCurrentNoteId(note.id);
        if (editorRef.current) {
            editorRef.current.innerHTML = note.content;
        }
        setIsEmpty(isEditorEmpty(note.content));

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            setSidebarOpen(false);
        }
    }, [performSave]);

    // Delete note
    const handleDeleteNote = useCallback(async (id: string) => {
        if (!db) return;
        if (!confirm('確定要刪除這則筆記嗎？')) return;

        await deleteNote(db, id);
        const allNotes = await getAllNotes(db);
        setNotes(allNotes);

        if (currentNoteId === id) {
            if (allNotes.length > 0) {
                loadNote(allNotes[0]);
            } else {
                createNewNote(db, false);
            }
        }
    }, [db, currentNoteId, loadNote, createNewNote]);

    // Filter notes by search
    const filteredNotes = notes.filter((note) => {
        const title = getTitleFromContent(note.content).toLowerCase();
        return title.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
            {/* Toolbar */}
            <div className="bg-base-700 border-b border-base-600 p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        className={buttonStyles.secondary + ' text-sm'}
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        <span className="hidden md:inline">☰ 列表</span>
                        <span className="md:hidden">☰</span>
                    </button>
                    <h1 className="text-lg font-bold text-base-50 whitespace-nowrap">📝 快速記事本</h1>
                    <span
                        className={`px-2 py-1 text-xs rounded bg-accent-green text-base-50 transition-opacity ${saveStatus === 'saved' ? 'opacity-100' : 'opacity-0'
                            }`}
                    >
                        已儲存
                    </span>
                </div>
                <div className="flex gap-2">
                    <button
                        className={buttonStyles.ghost + ' text-sm'}
                        onClick={() => setIsHelpOpen(true)}
                    >
                        ❔
                    </button>
                    <button
                        className={buttonStyles.secondary + ' text-sm whitespace-nowrap'}
                        onClick={() => setKeepStyles((v) => !v)}
                        title={keepStyles
                            ? '複製時保留文字樣式（永遠不含背景色）。點擊切換為純文字'
                            : '複製時剝除文字樣式，圖片保留。點擊切換為帶樣式'}
                        aria-pressed={keepStyles}
                    >
                        <span>{keepStyles ? '🎨' : '🅰️'}</span>
                        <span className="hidden md:inline ml-1">
                            {keepStyles ? '帶樣式' : '純文字'}
                        </span>
                    </button>
                    <button
                        className={buttonStyles.primary + ' text-sm'}
                        onClick={() => db && createNewNote(db)}
                    >
                        + 新筆記
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div
                    className={`bg-base-700 border-r border-base-600 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0 -ml-64'
                        } md:relative absolute inset-y-0 left-0 z-10`}
                    style={{ top: 'auto' }}
                >
                    <div className="p-2 border-b border-base-600">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={inputStyles.base + ' text-sm'}
                            placeholder="搜尋筆記..."
                        />
                    </div>
                    <div className="flex-1 overflow-auto">
                        {filteredNotes.length === 0 ? (
                            <div className="p-4 text-center text-base-600 text-sm">沒有筆記</div>
                        ) : (
                            filteredNotes.map((note) => (
                                <div
                                    key={note.id}
                                    onClick={() => loadNote(note)}
                                    className={`group px-3 py-2 cursor-pointer border-l-2 flex items-center justify-between transition ${note.id === currentNoteId
                                            ? 'bg-base-600/50 border-accent-blue text-base-50'
                                            : 'border-transparent hover:bg-base-600/30 text-base-400'
                                        }`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="font-medium truncate text-sm">
                                            {getTitleFromContent(note.content)}
                                        </div>
                                        <div className="text-xs text-base-600">
                                            {new Date(note.updatedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteNote(note.id);
                                        }}
                                        className="text-accent-red hover:text-accent-red/80 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Editor */}
                <div className="flex-1 relative bg-base-800 flex flex-col">
                    <div
                        ref={editorRef}
                        contentEditable
                        onInput={handleEditorInput}
                        onCopy={handleCopy}
                        onCut={handleCut}
                        onPaste={handlePaste}
                        className="flex-1 p-4 outline-none overflow-auto text-base-50"
                        spellCheck={false}
                        style={{ minHeight: 0 }}
                    />
                    {isEmpty && (
                        <div className="absolute top-0 left-0 p-4 text-base-600 pointer-events-none text-lg">
                            開始打字...<br />
                            <small>支援貼上截圖 (Ctrl+V)</small>
                        </div>
                    )}
                </div>
            </div>

            {/* Help Modal */}
            <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="關於快速記事本">
                <div className="space-y-4">
                    <div>
                        <h6 className="font-bold text-base-50 mb-1">🚀 這是什麼？</h6>
                        <p>
                            這是一個<strong className="text-base-50">免登入、免註冊</strong>的極簡線上記事本。
                            專為「暫存靈感」與「快速筆記」設計。
                        </p>
                    </div>

                    <div>
                        <h6 className="font-bold text-base-50 mb-1">✨ 特色功能</h6>
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong>秒開即用</strong>：沒有登入畫面，打開就是筆記本</li>
                            <li><strong>自動儲存</strong>：內容自動存在瀏覽器 (IndexedDB)</li>
                            <li><strong>支援圖片</strong>：直接貼上截圖 (Ctrl+V)</li>
                            <li><strong>離線可用</strong>：不需網路連線也能正常運作</li>
                            <li><strong>隱私安全</strong>：資料只存在你的裝置上，<strong>不會上傳</strong></li>
                        </ul>
                    </div>

                    <div className="bg-accent-yellow/20 border border-accent-yellow rounded p-3 text-sm">
                        ⚠️ 注意：若清除瀏覽器快取，筆記可能會消失。重要資料請記得自行備份。
                    </div>
                </div>
            </Modal>
        </div>
    );
}
