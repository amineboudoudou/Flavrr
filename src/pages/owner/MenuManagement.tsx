import React, { useEffect, useState } from 'react';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { api } from '../../lib/api';
import { Allergen } from '../../types';

interface Category {
    id: string;
    name_fr: string;
    name_en: string;
    sort_order: number;
    is_active: boolean;
}

type ItemFormState = {
    name: string;
    description: string;
    price: string;
    category_id: string;
    image_url: string;
    is_best_seller: boolean;
    ingredients: string[];
    allergens: Allergen[];
};

const ALLERGEN_OPTIONS: Allergen[] = ['Gluten', 'Dairy', 'Nuts', 'Vegan', 'Spicy', 'Shellfish'];

interface MenuItem {
    id: string;
    category_id: string;
    name_fr: string;
    name_en: string;
    description_fr: string;
    description_en: string;
    price_cents: number;
    image_url: string;
    is_active: boolean;
    is_best_seller: boolean;
    allergens: string[];
    ingredients: string[];
    sort_order: number;
}

// Simple auto-translation function (you can replace with Google Translate API later)
const autoTranslate = async (text: string, toLang: 'fr' | 'en'): Promise<string> => {
    // For now, just return the same text
    // TODO: Integrate with Google Translate API or DeepL
    return text;
};

export const MenuManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
    const [categories, setCategories] = useState<Category[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [showItemModal, setShowItemModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'item' | 'category'; id: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [itemsData, categoriesData] = await Promise.all([
                api.ownerListMenuItems(),
                api.ownerListCategories()
            ]);
            setMenuItems(itemsData);
            setCategories(categoriesData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteItem = async (id: string) => {
        try {
            await api.ownerDeleteMenuItem(id);
            await loadData();
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Failed to delete item:', error);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        try {
            await api.ownerDeleteCategory(id);
            await loadData();
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Failed to delete category:', error);
        }
    };

    const filteredItems = selectedCategory === 'all'
        ? menuItems
        : menuItems.filter(item => item.category_id === selectedCategory);

    if (loading) {
        return (
            <OwnerLayout>
                <div className="flex items-center justify-center h-screen">
                    <div className="text-white">Loading...</div>
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-white text-2xl font-bold mb-2">Menu Management</h1>
                    <p className="text-white/60 text-sm">
                        Manage your menu items and categories
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-white/10">
                    <button
                        onClick={() => setActiveTab('items')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'items'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-white/60 hover:text-white'
                            }`}
                    >
                        Menu Items ({menuItems.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'categories'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-white/60 hover:text-white'
                            }`}
                    >
                        Categories ({categories.length})
                    </button>
                </div>

                {/* Content */}
                {activeTab === 'items' ? (
                    <div>
                        {/* Toolbar */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white"
                            >
                                <option value="all">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name_en}</option>
                                ))}
                            </select>

                            <button
                                onClick={() => {
                                    setEditingItem(null);
                                    setShowItemModal(true);
                                }}
                                className="bg-primary hover:bg-accent text-white px-6 py-2 rounded-lg transition-colors font-medium"
                            >
                                + Add Menu Item
                            </button>
                        </div>

                        {/* Items Grid */}
                        {filteredItems.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-white/60">No menu items yet. Create your first one!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredItems.map(item => (
                                    <div key={item.id} className="bg-neutral-800 border border-white/10 rounded-xl overflow-hidden">
                                        {item.image_url && (
                                            <img
                                                src={item.image_url}
                                                alt={item.name_en}
                                                className="w-full h-48 object-cover"
                                            />
                                        )}
                                        <div className="p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <h3 className="text-white font-semibold">{item.name_en}</h3>
                                                    {item.is_best_seller && (
                                                        <span className="inline-block mt-1 bg-primary/20 text-primary text-xs px-2 py-1 rounded">
                                                            ⭐ Best Seller
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-primary font-bold">${(item.price_cents / 100).toFixed(2)}</span>
                                            </div>
                                            <p className="text-white/60 text-sm mb-3 line-clamp-2">{item.description_en}</p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingItem(item);
                                                        setShowItemModal(true);
                                                    }}
                                                    className="flex-1 bg-white/5 hover:bg-white/10 text-white text-sm px-3 py-2 rounded-lg transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm({ type: 'item', id: item.id })}
                                                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <button
                            onClick={() => setShowCategoryModal(true)}
                            className="bg-primary hover:bg-accent text-white px-6 py-2 rounded-lg transition-colors font-medium mb-6"
                        >
                            + Add Category
                        </button>

                        {categories.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-white/60">No categories yet. Create your first one!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {categories.map(cat => (
                                    <div key={cat.id} className="bg-neutral-800 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-white font-semibold">{cat.name_en}</h3>
                                            <p className="text-white/60 text-sm">{cat.name_fr}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setDeleteConfirm({ type: 'category', id: cat.id })}
                                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Item Modal */}
                {showItemModal && (
                    <ItemModal
                        item={editingItem}
                        categories={categories}
                        onClose={() => {
                            setShowItemModal(false);
                            setEditingItem(null);
                        }}
                        onSave={loadData}
                    />
                )}

                {/* Category Modal */}
                {showCategoryModal && (
                    <CategoryModal
                        onClose={() => setShowCategoryModal(false)}
                        onSave={loadData}
                    />
                )}

                {/* Delete Confirmation */}
                {deleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-neutral-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
                            <h3 className="text-white text-lg font-bold mb-4">Confirm Delete</h3>
                            <p className="text-white/70 mb-6">
                                Are you sure you want to delete this {deleteConfirm.type}? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (deleteConfirm.type === 'item') {
                                            handleDeleteItem(deleteConfirm.id);
                                        } else {
                                            handleDeleteCategory(deleteConfirm.id);
                                        }
                                    }}
                                    className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
};

// Item Modal Component - SIMPLIFIED (single language)
const ItemModal: React.FC<{
    item: MenuItem | null;
    categories: Category[];
    onClose: () => void;
    onSave: () => void;
}> = ({ item, categories, onClose, onSave }) => {
    const [formData, setFormData] = useState<ItemFormState>({
        name: item?.name_en || '',
        description: item?.description_en || '',
        price: item ? (item.price_cents / 100).toString() : '',
        category_id: item?.category_id || categories[0]?.id || '',
        image_url: item?.image_url || '',
        is_best_seller: item?.is_best_seller || false,
        ingredients: item?.ingredients || [],
        allergens: (item?.allergens as Allergen[]) || [],
    });
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [ingredientInput, setIngredientInput] = useState('');

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImage(true);
        try {
            // TODO: Upload to Supabase Storage
            // For now, we'll use a placeholder
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, image_url: reader.result as string });
                setUploadingImage(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Failed to upload image:', error);
            setUploadingImage(false);
        }
    };

    const addIngredient = () => {
        const value = ingredientInput.trim();
        if (!value) return;
        setFormData(prev => {
            if (prev.ingredients.some(ing => ing.toLowerCase() === value.toLowerCase())) {
                return prev;
            }
            return { ...prev, ingredients: [...prev.ingredients, value] };
        });
        setIngredientInput('');
    };

    const removeIngredient = (ingredient: string) => {
        setFormData(prev => ({
            ...prev,
            ingredients: prev.ingredients.filter(ing => ing !== ingredient)
        }));
    };

    const toggleAllergen = (allergen: Allergen) => {
        setFormData(prev => ({
            ...prev,
            allergens: prev.allergens.includes(allergen)
                ? prev.allergens.filter(a => a !== allergen)
                : [...prev.allergens, allergen]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const normalizedIngredients = Array.from(
                new Set(formData.ingredients.map(ing => ing.trim()).filter(Boolean))
            );
            const normalizedAllergens = Array.from(new Set(formData.allergens));
            // Auto-translate to French (for now, just copy the English)
            // TODO: Integrate with translation API
            const data = {
                name_en: formData.name,
                name_fr: formData.name, // Auto-translated
                description_en: formData.description,
                description_fr: formData.description, // Auto-translated
                price_cents: Math.round(parseFloat(formData.price) * 100),
                category_id: formData.category_id,
                image_url: formData.image_url,
                is_best_seller: formData.is_best_seller,
                ingredients: normalizedIngredients,
                allergens: normalizedAllergens,
            };

            if (item) {
                await api.ownerUpdateMenuItem(item.id, data);
            } else {
                await api.ownerCreateMenuItem(data);
            }

            onSave();
            onClose();
        } catch (error) {
            console.error('Failed to save item:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-neutral-800 border border-white/10 rounded-xl p-6 max-w-2xl w-full my-8">
                <h3 className="text-white text-lg font-bold mb-6">
                    {item ? 'Edit Menu Item' : 'Add Menu Item'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-white/70 text-sm mb-2">Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-white"
                            placeholder="e.g., Griot"
                        />
                        <p className="text-white/40 text-xs mt-1">Will be auto-translated to French</p>
                    </div>

                    <div>
                        <label className="block text-white/70 text-sm mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-white h-24"
                            placeholder="Describe your dish..."
                        />
                        <p className="text-white/40 text-xs mt-1">Will be auto-translated to French</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-white/70 text-sm mb-2">Price ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-white"
                                placeholder="25.00"
                            />
                        </div>
                        <div>
                            <label className="block text-white/70 text-sm mb-2">Category</label>
                            <select
                                required
                                value={formData.category_id}
                                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-white"
                            >
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name_en}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-white/70 text-sm mb-2">Image</label>
                        <div className="space-y-2">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white file:cursor-pointer"
                            />
                            {formData.image_url && (
                                <img src={formData.image_url} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-white/70 text-sm">Key Ingredients</label>
                            <span className="text-white/40 text-xs">Press Enter to add</span>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={ingredientInput}
                                onChange={(e) => setIngredientInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addIngredient();
                                    }
                                }}
                                className="flex-1 bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-white"
                                placeholder="e.g., porc, ail, agrumes"
                            />
                            <button
                                type="button"
                                onClick={addIngredient}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg"
                            >
                                Add
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {formData.ingredients.map((ingredient) => (
                                <span
                                    key={ingredient}
                                    className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/80"
                                >
                                    {ingredient}
                                    <button
                                        type="button"
                                        onClick={() => removeIngredient(ingredient)}
                                        className="text-white/40 hover:text-white"
                                        aria-label={`Remove ${ingredient}`}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                            {formData.ingredients.length === 0 && (
                                <span className="text-white/40 text-xs">No ingredients added yet.</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-white/70 text-sm mb-2">Allergens</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {ALLERGEN_OPTIONS.map((option) => (
                                <label
                                    key={option}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${formData.allergens.includes(option)
                                        ? 'border-primary text-white bg-primary/10'
                                        : 'border-white/10 text-white/70 bg-white/5'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.allergens.includes(option)}
                                        onChange={() => toggleAllergen(option)}
                                        className="accent-primary"
                                    />
                                    {option}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="best_seller"
                            checked={formData.is_best_seller}
                            onChange={(e) => setFormData({ ...formData, is_best_seller: e.target.checked })}
                            className="w-4 h-4"
                        />
                        <label htmlFor="best_seller" className="text-white/70 text-sm">⭐ Mark as Best Seller</label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || uploadingImage}
                            className="flex-1 bg-primary hover:bg-accent text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : uploadingImage ? 'Uploading...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Category Modal Component - SIMPLIFIED
const CategoryModal: React.FC<{
    onClose: () => void;
    onSave: () => void;
}> = ({ onClose, onSave }) => {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            // Auto-translate to French (for now, just copy)
            await api.ownerCreateCategory({
                name_en: name,
                name_fr: name, // Auto-translated
            });
            onSave();
            onClose();
        } catch (error) {
            console.error('Failed to create category:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
                <h3 className="text-white text-lg font-bold mb-6">Add Category</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-white/70 text-sm mb-2">Category Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-white"
                            placeholder="e.g., Main Dishes"
                        />
                        <p className="text-white/40 text-xs mt-1">Will be auto-translated to French</p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 bg-primary hover:bg-accent text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
