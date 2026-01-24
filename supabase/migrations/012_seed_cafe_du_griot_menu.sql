-- Seed Café Du Griot Menu
BEGIN;

-- 1. Variables
DO $$
DECLARE
    v_org_id UUID := '00000000-0000-0000-0000-000000000001';
    v_cat_mains UUID;
    v_cat_specials UUID;
    v_cat_sides UUID;
    v_cat_drinks UUID;
BEGIN
    -- 2. Insert Categories
    INSERT INTO menu_categories (org_id, name_fr, name_en, sort_order, is_active)
    VALUES 
        (v_org_id, 'Plats principaux', 'Main Dishes', 1, true)
    RETURNING id INTO v_cat_mains;

    INSERT INTO menu_categories (org_id, name_fr, name_en, sort_order, is_active)
    VALUES 
        (v_org_id, 'Repas spéciaux', 'Specials', 2, true)
    RETURNING id INTO v_cat_specials;

    INSERT INTO menu_categories (org_id, name_fr, name_en, sort_order, is_active)
    VALUES 
        (v_org_id, 'Accompagnements', 'Sides', 3, true)
    RETURNING id INTO v_cat_sides;

    INSERT INTO menu_categories (org_id, name_fr, name_en, sort_order, is_active)
    VALUES 
        (v_org_id, 'Boissons', 'Drinks', 4, true)
    RETURNING id INTO v_cat_drinks;

    -- 3. Insert Items (Main Dishes)
    INSERT INTO menu_items (org_id, category_id, name_fr, name_en, description_fr, description_en, price_cents, image_url, allergens, ingredients, sort_order)
    VALUES 
        (v_org_id, v_cat_mains, 'Griot', 'Griot', 'Porc mariné et frit, croustillant à l’extérieur, tendre à l’intérieur.', 'Marinated and fried pork, crispy outside and tender inside.', 2500, '/images/menu/griot.jpg', '{}', '{"porc", "ail", "agrumes", "épices"}', 1),
        (v_org_id, v_cat_mains, 'Tassot de bœuf', 'Beef Tassot', 'Bœuf frit et mariné, servi avec riz, banane plantain et salade.', 'Marinated and fried beef, served with rice, plantain and salad.', 2500, '/images/menu/tassot-boeuf.jpg', '{}', '{"boeuf", "epices"}', 2),
        (v_org_id, v_cat_mains, 'Tassot cabrit (chèvre)', 'Goat Tassot', 'Chèvre marinée et frite, saveur intense et authentique.', 'Marinated and fried goat, intense and authentic flavor.', 3500, '/images/menu/tassot-cabrit.jpg', '{}', '{"chevre", "epices"}', 3),
        (v_org_id, v_cat_mains, 'Poulet frit', 'Fried Chicken', 'Poulet frit haïtien, bien assaisonné et doré.', 'Haitian fried chicken, well seasoned and golden brown.', 2300, '/images/menu/poulet-frit.jpg', '{}', '{"poulet", "epices"}', 4);

    -- 4. Insert Items (Specials)
    INSERT INTO menu_items (org_id, category_id, name_fr, name_en, description_fr, description_en, price_cents, image_url, sort_order)
    VALUES 
        (v_org_id, v_cat_specials, 'Riz Djon Djon', 'Djon Djon Rice', 'Riz noir aux champignons djon djon, parfumé et riche en goût.', 'Traditional black mushroom rice with deep earthy flavor.', 2300, '/images/menu/riz-djon-djon.jpg', 1),
        (v_org_id, v_cat_specials, 'Riz collé (haricots rouges)', 'Red Bean Rice', 'Riz mijoté avec haricots rouges, servi avec viande au choix.', 'Rice simmered with red beans, served with your choice of meat.', 2000, '/images/menu/riz-colle.jpg', 2);

    -- 5. Insert Items (Sides)
    INSERT INTO menu_items (org_id, category_id, name_fr, name_en, description_fr, description_en, price_cents, image_url, sort_order)
    VALUES 
        (v_org_id, v_cat_sides, 'Banane plantain & Pikliz', 'Plantain & Pikliz', 'Banane plantain frite accompagnée de pikliz épicé.', 'Fried plantain served with spicy pikliz.', 150, '/images/menu/plantain-pikliz.jpg', 1),
        (v_org_id, v_cat_sides, 'Salade de macaroni', 'Macaroni Salad', 'Salade crémeuse de macaroni à la haïtienne.', 'Creamy Haitian-style macaroni salad.', 500, '/images/menu/salade-macaroni.jpg', 2),
        (v_org_id, v_cat_sides, 'Salade russe', 'Russian Salad', 'Pommes de terre, betteraves, carottes, mayonnaise.', 'Potato, beet, carrot, and mayonnaise salad.', 500, '/images/menu/salade-russe.jpg', 3);

    -- 6. Insert Items (Drinks)
    INSERT INTO menu_items (org_id, category_id, name_fr, name_en, description_fr, description_en, price_cents, image_url, sort_order)
    VALUES 
        (v_org_id, v_cat_drinks, 'Jus de fruits', 'Fruit Juice', 'Jus de fruits frais et rafraîchissant.', 'Fresh and refreshing fruit juice.', 300, '/images/menu/jus-fruits.jpg', 1),
        (v_org_id, v_cat_drinks, 'Thé glacé', 'Iced Tea', 'Thé glacé servi bien froid.', 'Iced tea served chilled.', 300, '/images/menu/the-glace.jpg', 2),
        (v_org_id, v_cat_drinks, 'Jus d’orange', 'Orange Juice', 'Jus d’orange frais.', 'Fresh orange juice.', 300, '/images/menu/jus-orange.jpg', 3);

END $$;

COMMIT;
