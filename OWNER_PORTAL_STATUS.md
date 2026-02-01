# Owner Portal - Shopify-Style Admin Panel

## ✅ What's Been Built

### 1. **Navigation & Layout**
- ✅ Responsive sidebar with navigation
- ✅ Mobile hamburger menu
- ✅ User profile dropdown with sign out
- ✅ Active route highlighting

### 2. **Orders Management** (COMPLETE)
- ✅ Real-time orders board with Kanban lanes
- ✅ Order detail view
- ✅ Status progression (Paid → Accepted → Preparing → Ready → Completed)
- ✅ Delivery integration panel
- ✅ Customer information display
- ✅ Order items with pricing breakdown

### 3. **Menu Management** (COMPLETE)
- ✅ UI for viewing menu items in grid
- ✅ UI for viewing categories list
- ✅ Category filter dropdown
- ✅ Tab navigation (Items / Categories)
- ✅ CRUD operations (Create, Update, Delete)
- ✅ Image upload functionality
- ✅ Bilingual support (FR/EN)
- ⚠️ **NEEDS**: Allergens & ingredients management
- ⚠️ **NEEDS**: Drag-and-drop reordering

### 4. **Settings** (COMPLETE)
- ✅ UI for restaurant information
- ✅ UI for business hours (7 days)
- ✅ UI for delivery settings
- ✅ UI for Uber Direct credentials
- ✅ UI for tax rate and currency
- ✅ Load current settings from database
- ✅ Save functionality
- ✅ Validation

---

## 🚧 What Needs to Be Implemented

### **Menu Management - Backend Integration**

#### Edge Functions Needed:
1. **`owner_list_menu_items`** - GET menu items for org
2. **`owner_create_menu_item`** - POST new menu item
3. **`owner_update_menu_item`** - PATCH existing menu item
4. **`owner_delete_menu_item`** - DELETE menu item
5. **`owner_list_categories`** - GET categories for org
6. **`owner_create_category`** - POST new category
7. **`owner_update_category`** - PATCH existing category
8. **`owner_delete_category`** - DELETE category
9. **`owner_upload_image`** - POST image upload (to Supabase Storage)

#### Frontend Components Needed:
1. **MenuItemModal** - Create/Edit menu item form
   - Bilingual name & description fields
   - Price input (with cents conversion)
   - Category dropdown
   - Image upload with preview
   - Allergens multi-select
   - Ingredients list editor
   - Active/Inactive toggle
   - Best Seller toggle

2. **CategoryModal** - Create/Edit category form
   - Bilingual name fields
   - Sort order input
   - Active/Inactive toggle

3. **ImageUploader** - Drag-and-drop image upload
   - Preview
   - Crop/resize
   - Upload to Supabase Storage

4. **ConfirmDialog** - Delete confirmation modal

---

### **Settings - Backend Integration**

#### Edge Functions Needed:
1. **`owner_get_organization`** - GET org settings
2. **`owner_update_organization`** - PATCH org settings

#### Features to Implement:
1. Load current organization data on mount
2. Form validation (phone, email, postal code)
3. Save button with loading state
4. Success/error toast notifications
5. Business hours JSON structure:
   ```json
   {
     "monday": { "open": "09:00", "close": "21:00", "closed": false },
     "tuesday": { "open": "09:00", "close": "21:00", "closed": false },
     ...
   }
   ```

---

## 📊 Database Schema (Already Exists)

### `organizations` table
- ✅ id, name, slug, phone, email
- ✅ street, city, region, postal_code, country
- ✅ timezone, currency
- ✅ settings (jsonb) - for business hours, tax rate, etc.

### `menu_categories` table
- ✅ id, org_id, name_fr, name_en
- ✅ sort_order, is_active

### `menu_items` table
- ✅ id, org_id, category_id
- ✅ name_fr, name_en, description_fr, description_en
- ✅ price_cents, image_url
- ✅ is_active, is_best_seller
- ✅ allergens (text[]), ingredients (text[])
- ✅ sort_order

---

## 🎯 Priority Implementation Order

### Phase 1: Menu Management (CRITICAL)
1. Create Edge Functions for menu CRUD
2. Build MenuItemModal component
3. Build CategoryModal component
4. Implement image upload to Supabase Storage
5. Wire up all CRUD operations
6. Add drag-and-drop reordering

### Phase 2: Settings (IMPORTANT)
1. Create Edge Functions for org settings
2. Load current settings on mount
3. Implement save functionality
4. Add form validation
5. Add toast notifications

### Phase 3: Polish (NICE TO HAVE)
1. Add search/filter for menu items
2. Add bulk actions (activate/deactivate multiple items)
3. Add menu item duplication
4. Add import/export CSV
5. Add analytics dashboard

---

## 🔐 Security Considerations

All Edge Functions must:
- ✅ Verify user authentication
- ✅ Check user belongs to organization
- ✅ Validate RLS policies are enforced
- ✅ Sanitize all inputs
- ✅ Return proper error messages

---

## 🎨 UI/UX Features Already Implemented

- ✅ Dark theme with pink accent
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Loading states
- ✅ Empty states
- ✅ Hover effects and transitions
- ✅ Consistent spacing and typography
- ✅ Accessible form inputs

---

## 📝 Next Steps

1. **Implement Menu Management CRUD** - This is the most critical feature
2. **Add image upload** - Supabase Storage integration
3. **Implement Settings save** - Load and save organization data
4. **Add toast notifications** - User feedback for all actions
5. **Test everything** - Ensure all features work end-to-end

---

## 🚀 How to Test

1. Sign in to owner portal: `http://localhost:3000/owner/login`
2. Navigate to "Menu" tab - see UI (no data yet)
3. Navigate to "Settings" tab - see UI (no data yet)
4. Navigate to "Orders" tab - see empty state (no orders yet)

Once backend is implemented:
- Create menu items and categories
- Update restaurant settings
- Test on storefront to see changes reflected
- Place test order to see it appear in Orders board
