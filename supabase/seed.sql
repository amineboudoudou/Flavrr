-- Seed data for Café Du Griot demo restaurant
-- This file should be run AFTER all migrations

-- Insert demo organization
INSERT INTO organizations (id, name, slug, phone, email, street, city, region, postal_code, country, timezone, currency, settings) 
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Café Du Griot',
  'cafe-du-griot',
  '+1-514-555-0100',
  'info@cafedugriot.com',
  '123 Rue Saint-Laurent',
  'Montreal',
  'QC',
  'H2X 2T3',
  'CA',
  'America/Montreal',
  'CAD',
  '{
    "prep_time_default": 30,
    "taxes": {
      "gst": 5,
      "qst": 9.975
    },
    "tips": {
      "enabled": true,
      "presets": [10, 15, 20, 25]
    },
    "hours": {
      "monday": {"open": "11:00", "close": "22:00"},
      "tuesday": {"open": "11:00", "close": "22:00"},
      "wednesday": {"open": "11:00", "close": "22:00"},
      "thursday": {"open": "11:00", "close": "22:00"},
      "friday": {"open": "11:00", "close": "23:00"},
      "saturday": {"open": "10:00", "close": "23:00"},
      "sunday": {"open": "10:00", "close": "22:00"}
    },
    "minimum_order_cents": 1500,
    "delivery_zones": [
      {"name": "Downtown", "radius_km": 5, "fee_cents": 500}
    ]
  }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Insert menu categories
INSERT INTO menu_categories (id, org_id, name_fr, name_en, sort_order, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Entrées', 'Appetizers', 1, true),
  ('10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Plats Principaux', 'Main Courses', 2, true),
  ('10000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Desserts', 'Desserts', 3, true),
  ('10000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Boissons', 'Beverages', 4, true)
ON CONFLICT (id) DO NOTHING;

-- Insert menu items
INSERT INTO menu_items (id, org_id, category_id, name_fr, name_en, description_fr, description_en, price_cents, is_active, allergens, ingredients, sort_order) VALUES
  -- Appetizers
  (
    '20000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Salade de Crevettes Grillées',
    'Grilled Shrimp Salad',
    'Crevettes marinées, légumes frais, vinaigrette citron-basilic',
    'Marinated shrimp, fresh vegetables, lemon-basil vinaigrette',
    1495,
    true,
    ARRAY['shellfish', 'garlic'],
    ARRAY['shrimp', 'lettuce', 'tomatoes', 'lemon', 'basil', 'olive oil'],
    1
  ),
  (
    '20000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Accras de Morue',
    'Salt Cod Fritters',
    'Beignets de morue croustillants, sauce piquante créole',
    'Crispy cod fritters, spicy Creole sauce',
    1095,
    true,
    ARRAY['fish', 'eggs', 'gluten'],
    ARRAY['salt cod', 'flour', 'eggs', 'herbs', 'peppers'],
    2
  ),
  (
    '20000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Soupe Joumou',
    'Pumpkin Soup',
    'Soupe traditionnelle haïtienne au giraumon, légumes et viandes',
    'Traditional Haitian pumpkin soup with vegetables and meats',
    895,
    true,
    ARRAY['gluten'],
    ARRAY['pumpkin', 'beef', 'cabbage', 'carrots', 'pasta'],
    3
  ),
  
  -- Main Courses
  (
    '20000000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    'Griot & Riz Collé',
    'Fried Pork & Rice & Beans',
    'Porc mariné et frit, riz aux pois rouges, bananes plantains',
    'Marinated fried pork, red beans & rice, fried plantains',
    1895,
    true,
    ARRAY[],
    ARRAY['pork', 'rice', 'red beans', 'plantains', 'garlic', 'spices'],
    1
  ),
  (
    '20000000-0000-0000-0000-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    'Poulet Créole',
    'Creole Chicken',
    'Poulet mijoté sauce tomate créole, légumes, riz blanc',
    'Chicken stewed in Creole tomato sauce, vegetables, white rice',
    1695,
    true,
    ARRAY[],
    ARRAY['chicken', 'tomatoes', 'peppers', 'onions', 'rice', 'spices'],
    2
  ),
  (
    '20000000-0000-0000-0000-000000000006'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    'Poisson Gros Sel',
    'Salt-Crusted Fish',
    'Poisson entier cuit au gros sel, légumes grillés, sauce ti-malice',
    'Whole fish salt-crusted, grilled vegetables, ti-malice sauce',
    2295,
    true,
    ARRAY['fish'],
    ARRAY['whole fish', 'sea salt', 'vegetables', 'peppers', 'onions'],
    3
  ),
  (
    '20000000-0000-0000-0000-000000000007'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    'Legim (Végétarien)',
    'Vegetable Stew',
    'Ragoût de légumes haïtiens, épinards, aubergines, riz',
    'Haitian vegetable stew, spinach, eggplant, rice',
    1495,
    true,
    ARRAY[],
    ARRAY['eggplant', 'spinach', 'cabbage', 'carrots', 'rice', 'spices'],
    4
  ),
  
  -- Desserts
  (
    '20000000-0000-0000-0000-000000000008'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000003'::uuid,
    'Pain Patate',
    'Sweet Potato Bread',
    'Gâteau traditionnel à la patate douce, cannelle, noix de coco',
    'Traditional sweet potato cake, cinnamon, coconut',
    695,
    true,
    ARRAY['eggs', 'dairy'],
    ARRAY['sweet potato', 'coconut', 'cinnamon', 'eggs', 'milk'],
    1
  ),
  (
    '20000000-0000-0000-0000-000000000009'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000003'::uuid,
    'Tablet Pistache',
    'Peanut Brittle',
    'Confiserie croquante aux arachides caramélisées',
    'Crunchy caramelized peanut candy',
    495,
    true,
    ARRAY['peanuts'],
    ARRAY['peanuts', 'sugar', 'vanilla'],
    2
  ),
  (
    '20000000-0000-0000-0000-000000000010'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000003'::uuid,
    'Glace Coco',
    'Coconut Ice Cream',
    'Crème glacée artisanale à la noix de coco fraîche',
    'Homemade fresh coconut ice cream',
    595,
    true,
    ARRAY['dairy'],
    ARRAY['coconut', 'cream', 'sugar', 'vanilla'],
    3
  ),
  
  -- Beverages
  (
    '20000000-0000-0000-0000-000000000011'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    'Jus de Fruit de la Passion',
    'Passion Fruit Juice',
    'Jus naturel de fruit de la passion',
    'Natural passion fruit juice',
    495,
    true,
    ARRAY[],
    ARRAY['passion fruit', 'sugar', 'water'],
    1
  ),
  (
    '20000000-0000-0000-0000-000000000012'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    'Akasan',
    'Corn Beverage',
    'Boisson crémeuse au maïs, cannelle, lait de coco',
    'Creamy corn drink, cinnamon, coconut milk',
    595,
    true,
    ARRAY['corn'],
    ARRAY['corn flour', 'coconut milk', 'cinnamon', 'sugar', 'vanilla'],
    2
  ),
  (
    '20000000-0000-0000-0000-000000000013'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    'Café Haïtien',
    'Haitian Coffee',
    'Café corsé du terroir haïtien',
    'Strong Haitian coffee',
    395,
    true,
    ARRAY[],
    ARRAY['coffee beans', 'water'],
    3
  ),
  (
    '20000000-0000-0000-0000-000000000014'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    'Cola Lacaye',
    'Cola Lacaye',
    'Soda traditionnel haïtien',
    'Traditional Haitian soda',
    395,
    true,
    ARRAY[],
    ARRAY['carbonated water', 'sugar', 'natural flavors'],
    4
  )
ON CONFLICT (id) DO NOTHING;

-- Note: Auth users must be created via Supabase Auth UI or API
-- After creating a user, insert profile manually or via trigger:
-- 
-- INSERT INTO profiles (user_id, org_id, role, full_name) VALUES
--   ('<auth_user_uuid>', '00000000-0000-0000-0000-000000000001', 'owner', 'Restaurant Owner');
