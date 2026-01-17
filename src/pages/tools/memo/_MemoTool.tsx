import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { cardStyles, buttonStyles, inputStyles } from '@/components/ui';

interface SubItem {
    text: string;
    completed: boolean;
}

interface Todo {
    id: string;
    title: string;
    completed: boolean;
    notes: string;
    subItems: SubItem[];
}

const STORAGE_KEY = 'wemee_todos';

export default function MemoTool() {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [newItem, setNewItem] = useState('');
    const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newSubItem, setNewSubItem] = useState('');

    // Load todos from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) setTodos(JSON.parse(stored));
        } catch (e) {
            console.error('Failed to load todos:', e);
        }
    }, []);

    // Save todos to localStorage
    const saveTodos = useCallback((newTodos: Todo[]) => {
        setTodos(newTodos);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newTodos));
    }, []);

    // Add new todo
    const addTodo = useCallback(() => {
        if (!newItem.trim()) return;

        const todo: Todo = {
            id: Date.now().toString(),
            title: newItem.trim(),
            completed: false,
            notes: '',
            subItems: [],
        };

        saveTodos([todo, ...todos]);
        setNewItem('');
    }, [newItem, todos, saveTodos]);

    // Toggle todo completion
    const toggleTodo = useCallback((id: string) => {
        saveTodos(todos.map(t =>
            t.id === id ? { ...t, completed: !t.completed } : t
        ));
    }, [todos, saveTodos]);

    // Delete todo
    const deleteTodo = useCallback((id: string) => {
        saveTodos(todos.filter(t => t.id !== id));
        if (editingTodo?.id === id) {
            setIsModalOpen(false);
            setEditingTodo(null);
        }
    }, [todos, saveTodos, editingTodo]);

    // Clear completed
    const clearCompleted = useCallback(() => {
        saveTodos(todos.filter(t => !t.completed));
    }, [todos, saveTodos]);

    // Open edit modal
    const openEditModal = useCallback((todo: Todo) => {
        setEditingTodo({ ...todo });
        setIsModalOpen(true);
    }, []);

    // Save edit
    const saveEdit = useCallback(() => {
        if (!editingTodo) return;
        saveTodos(todos.map(t =>
            t.id === editingTodo.id ? editingTodo : t
        ));
        setIsModalOpen(false);
        setEditingTodo(null);
    }, [editingTodo, todos, saveTodos]);

    // Add sub-item
    const addSubItem = useCallback(() => {
        if (!newSubItem.trim() || !editingTodo) return;
        setEditingTodo({
            ...editingTodo,
            subItems: [...editingTodo.subItems, { text: newSubItem.trim(), completed: false }],
        });
        setNewSubItem('');
    }, [newSubItem, editingTodo]);

    // Toggle sub-item
    const toggleSubItem = useCallback((index: number) => {
        if (!editingTodo) return;
        const newSubItems = [...editingTodo.subItems];
        newSubItems[index] = { ...newSubItems[index], completed: !newSubItems[index].completed };
        setEditingTodo({ ...editingTodo, subItems: newSubItems });
    }, [editingTodo]);

    // Delete sub-item
    const deleteSubItem = useCallback((index: number) => {
        if (!editingTodo) return;
        setEditingTodo({
            ...editingTodo,
            subItems: editingTodo.subItems.filter((_, i) => i !== index),
        });
    }, [editingTodo]);

    const completedCount = todos.filter(t => t.completed).length;

    return (
        <>
            {/* Main Card */}
            <div className={cardStyles.container}>
                <div className={`${cardStyles.header} flex justify-between items-center`}>
                    <span className="text-base-50 font-medium">待辦事項</span>
                    <span className="px-2 py-1 bg-base-600 rounded text-sm text-base-400">
                        {todos.length} 項
                    </span>
                </div>

                <div className={cardStyles.body}>
                    {/* Input */}
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={newItem}
                            onChange={(e) => setNewItem(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && addTodo()}
                            className={inputStyles.base + ' flex-1'}
                            placeholder="輸入後按 Enter 新增..."
                        />
                        <button className={buttonStyles.primary} onClick={addTodo}>
                            新增
                        </button>
                    </div>

                    {/* Todo List */}
                    {todos.length > 0 ? (
                        <ul className="space-y-2">
                            {todos.map((todo) => (
                                <li
                                    key={todo.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer hover:bg-base-600/30 ${todo.completed
                                            ? 'border-base-600/50 bg-base-600/10'
                                            : 'border-base-600'
                                        }`}
                                    onClick={() => openEditModal(todo)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={todo.completed}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            toggleTodo(todo.id);
                                        }}
                                        className="w-5 h-5 rounded border-base-600 bg-base-900 text-accent-blue cursor-pointer"
                                    />
                                    <span className={`flex-1 ${todo.completed ? 'line-through opacity-60' : 'text-base-50'}`}>
                                        {todo.title}
                                    </span>
                                    {(todo.notes || todo.subItems.length > 0) && (
                                        <span className="text-xs text-base-600">📝</span>
                                    )}
                                    <button
                                        className="opacity-0 group-hover:opacity-100 text-accent-red hover:text-accent-red/80 transition"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteTodo(todo.id);
                                        }}
                                    >
                                        ×
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-8 text-base-600">
                            <div className="text-4xl mb-2">📝</div>
                            <p>還沒有任何事項，開始新增吧！</p>
                        </div>
                    )}
                </div>

                <div className={`${cardStyles.footer} flex justify-between items-center`}>
                    <span className="text-sm text-base-600">點擊項目可編輯細項</span>
                    {completedCount > 0 && (
                        <button className={buttonStyles.secondary + ' text-sm'} onClick={clearCompleted}>
                            清除已完成 ({completedCount})
                        </button>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={saveEdit}
                title="編輯事項"
                footer={
                    <>
                        <button
                            className={buttonStyles.danger}
                            onClick={() => editingTodo && deleteTodo(editingTodo.id)}
                        >
                            刪除事項
                        </button>
                        <button className={buttonStyles.primary} onClick={saveEdit}>
                            完成
                        </button>
                    </>
                }
            >
                {editingTodo && (
                    <div className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-sm text-base-400 mb-1">標題</label>
                            <input
                                type="text"
                                value={editingTodo.title}
                                onChange={(e) => setEditingTodo({ ...editingTodo, title: e.target.value })}
                                className={inputStyles.base}
                            />
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm text-base-400 mb-1">備註</label>
                            <textarea
                                value={editingTodo.notes}
                                onChange={(e) => setEditingTodo({ ...editingTodo, notes: e.target.value })}
                                className={inputStyles.base}
                                rows={2}
                                placeholder="可選：補充說明..."
                            />
                        </div>

                        {/* Sub-items */}
                        <div>
                            <label className="block text-sm text-base-400 mb-1">細項</label>
                            {editingTodo.subItems.length > 0 && (
                                <ul className="space-y-2 mb-2">
                                    {editingTodo.subItems.map((sub, index) => (
                                        <li
                                            key={index}
                                            className="flex items-center gap-2 p-2 rounded border border-base-600 bg-base-900"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={sub.completed}
                                                onChange={() => toggleSubItem(index)}
                                                className="w-4 h-4 rounded border-base-600 bg-base-900 text-accent-blue cursor-pointer"
                                            />
                                            <span className={`flex-1 text-sm ${sub.completed ? 'line-through opacity-60' : ''}`}>
                                                {sub.text}
                                            </span>
                                            <button
                                                className="text-accent-red hover:text-accent-red/80 text-sm"
                                                onClick={() => deleteSubItem(index)}
                                            >
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newSubItem}
                                    onChange={(e) => setNewSubItem(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && addSubItem()}
                                    className={inputStyles.base + ' flex-1 text-sm'}
                                    placeholder="新增細項..."
                                />
                                <button className={buttonStyles.secondary + ' text-sm'} onClick={addSubItem}>
                                    +
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
