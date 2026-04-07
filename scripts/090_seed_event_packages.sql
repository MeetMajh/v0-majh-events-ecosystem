-- Seed Sample Event Packages for CARBARDMV
-- Run this script to populate the event booking system with sample data

-- Clear existing data (comment out if you want to keep existing data)
-- DELETE FROM cb_event_addons;
-- DELETE FROM cb_event_packages;
-- DELETE FROM cb_catering_categories;
-- DELETE FROM cb_catering_items;

-- ============================================
-- EVENT PACKAGES
-- ============================================

INSERT INTO cb_event_packages (name, slug, description, base_price_cents, duration_hours, max_guests, min_guests, category, includes, is_active) VALUES
(
  'Birthday Bash',
  'birthday-bash',
  'The ultimate gaming birthday party! Perfect for kids and adults who want an unforgettable celebration with gaming tournaments, custom decorations, and dedicated party hosts.',
  49900,
  3,
  30,
  10,
  'party',
  '["Dedicated party host", "Custom tournament setup", "Birthday decorations", "Winner trophies/medals", "Party playlist", "Photo opportunities"]',
  true
),
(
  'Corporate Team Building',
  'corporate-team-building',
  'Boost team morale with competitive gaming! Includes tournament organization, team-based challenges, and networking-friendly setup perfect for company events.',
  99900,
  4,
  50,
  15,
  'corporate',
  '["Professional event coordinator", "Custom team brackets", "Company branding options", "Achievement awards", "Networking lounge setup", "Post-event analytics report"]',
  true
),
(
  'Tournament Night',
  'tournament-night',
  'Host your own esports tournament with professional-grade setup. Ideal for competitive gaming groups, gaming cafes, or community events.',
  149900,
  6,
  64,
  16,
  'tournament',
  '["Professional bracket system", "Stream-ready setup", "Commentary station", "Prize pool management", "Player check-in system", "Live leaderboard display"]',
  true
),
(
  'Private Gaming Session',
  'private-gaming',
  'Exclusive venue access for intimate gatherings. Perfect for small groups who want a premium gaming experience without the crowds.',
  29900,
  2,
  12,
  4,
  'private',
  '["Exclusive venue access", "Premium gaming stations", "Complimentary drinks", "Flexible game selection", "Comfortable lounge seating"]',
  true
),
(
  'Watch Party',
  'watch-party',
  'The ultimate sports or esports viewing experience! Big screens, great atmosphere, and gaming entertainment during breaks.',
  39900,
  4,
  40,
  10,
  'watch_party',
  '["Multiple large screens", "Premium sound system", "Gaming stations for halftime", "Sports bar atmosphere", "Dedicated seating areas"]',
  true
),
(
  'All-Day Gaming Marathon',
  'gaming-marathon',
  'For the hardcore gamers! Full day access with unlimited gaming, meals included, and special marathon challenges.',
  199900,
  10,
  30,
  8,
  'marathon',
  '["10 hours of gaming", "Breakfast, lunch & dinner included", "Energy drinks & snacks", "Marathon achievements", "Comfort stations", "Priority game selection"]',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price_cents = EXCLUDED.base_price_cents,
  duration_hours = EXCLUDED.duration_hours,
  max_guests = EXCLUDED.max_guests,
  min_guests = EXCLUDED.min_guests,
  category = EXCLUDED.category,
  includes = EXCLUDED.includes,
  is_active = EXCLUDED.is_active;

-- ============================================
-- EVENT ADD-ONS
-- ============================================

INSERT INTO cb_event_addons (name, description, price_cents, price_type, category, is_active) VALUES
-- Equipment
('Extra Gaming Station', 'Additional gaming setup with console, monitor, and accessories', 5000, 'flat', 'equipment', true),
('VR Experience Station', 'Immersive VR gaming station with popular VR titles', 7500, 'flat', 'equipment', true),
('Racing Simulator', 'Professional racing sim with wheel, pedals, and seat', 10000, 'flat', 'equipment', true),
('Streaming Setup', 'Professional streaming kit with camera, lighting, and capture card', 15000, 'flat', 'equipment', true),

-- Entertainment
('DJ / Music', 'Professional DJ for background music and event hype', 20000, 'flat', 'entertainment', true),
('Professional Photography', 'Event photographer for candid shots and group photos', 25000, 'flat', 'entertainment', true),
('Video Highlights', 'Edited highlight reel of your event', 35000, 'flat', 'entertainment', true),
('Live Commentary', 'Professional esports commentator for tournaments', 30000, 'flat', 'entertainment', true),

-- Decorations
('Custom Banners', 'Personalized banners with your event branding', 5000, 'flat', 'decoration', true),
('LED Lighting Package', 'Ambient RGB lighting setup throughout venue', 7500, 'flat', 'decoration', true),
('Balloon Decoration', 'Themed balloon arrangements and arches', 10000, 'flat', 'decoration', true),
('Photo Booth', 'Custom themed photo booth with props and instant prints', 15000, 'flat', 'decoration', true),

-- Services
('Extra Hour', 'Extend your event by one additional hour', 10000, 'per_hour', 'service', true),
('Extra Guests', 'Additional capacity above package maximum', 1500, 'per_person', 'service', true),
('Dedicated Host', 'Additional dedicated event host/coordinator', 15000, 'flat', 'service', true),
('Cleanup Service', 'Post-event cleanup so you can leave worry-free', 5000, 'flat', 'service', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- CATERING CATEGORIES
-- ============================================

INSERT INTO cb_catering_categories (name, slug, description, sort_order) VALUES
('Appetizers', 'appetizers', 'Start your event right with tasty finger foods', 1),
('Main Courses', 'mains', 'Satisfying entrees for hungry gamers', 2),
('Sides', 'sides', 'Perfect complements to any meal', 3),
('Desserts', 'desserts', 'Sweet treats to celebrate', 4),
('Beverages', 'beverages', 'Stay hydrated and energized', 5),
('Snacks', 'snacks', 'Gaming fuel for marathon sessions', 6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- CATERING ITEMS
-- ============================================

-- Get category IDs for inserts
WITH cats AS (
  SELECT id, slug FROM cb_catering_categories
)
INSERT INTO cb_catering_items (name, description, price_cents, price_type, dietary_tags, category_id, is_active)
SELECT * FROM (VALUES
  -- Appetizers
  ('Loaded Nachos Platter', 'Tortilla chips with cheese, jalapeños, salsa, and sour cream', 2500, 'per_serving', ARRAY['vegetarian'], (SELECT id FROM cats WHERE slug = 'appetizers')),
  ('Chicken Wings (24pc)', 'Crispy wings with your choice of sauce: buffalo, BBQ, or garlic parmesan', 3500, 'flat', ARRAY[]::text[], (SELECT id FROM cats WHERE slug = 'appetizers')),
  ('Mozzarella Sticks', 'Golden fried mozzarella with marinara dipping sauce', 1800, 'per_serving', ARRAY['vegetarian'], (SELECT id FROM cats WHERE slug = 'appetizers')),
  ('Veggie Platter', 'Fresh vegetables with hummus and ranch dip', 2200, 'per_serving', ARRAY['vegetarian', 'vegan', 'gluten-free'], (SELECT id FROM cats WHERE slug = 'appetizers')),
  
  -- Main Courses
  ('Pizza Party (3 Large)', 'Three large pizzas - cheese, pepperoni, and supreme', 5500, 'flat', ARRAY[]::text[], (SELECT id FROM cats WHERE slug = 'mains')),
  ('Burger Sliders (12pc)', 'Mini beef burgers with all the fixings', 4500, 'flat', ARRAY[]::text[], (SELECT id FROM cats WHERE slug = 'mains')),
  ('Taco Bar', 'Build-your-own taco station with beef, chicken, and veggie options', 1200, 'per_person', ARRAY[]::text[], (SELECT id FROM cats WHERE slug = 'mains')),
  ('BBQ Pulled Pork Sliders', 'Slow-cooked pulled pork with tangy BBQ sauce', 4000, 'flat', ARRAY[]::text[], (SELECT id FROM cats WHERE slug = 'mains')),
  
  -- Sides
  ('Fries Basket', 'Crispy golden fries with dipping sauces', 1500, 'per_serving', ARRAY['vegetarian', 'vegan'], (SELECT id FROM cats WHERE slug = 'sides')),
  ('Mac & Cheese', 'Creamy homestyle macaroni and cheese', 1200, 'per_serving', ARRAY['vegetarian'], (SELECT id FROM cats WHERE slug = 'sides')),
  ('Coleslaw', 'Classic creamy coleslaw', 800, 'per_serving', ARRAY['vegetarian', 'gluten-free'], (SELECT id FROM cats WHERE slug = 'sides')),
  
  -- Desserts
  ('Brownie Bites (24pc)', 'Rich chocolate brownies cut into bite-sized pieces', 2800, 'flat', ARRAY['vegetarian'], (SELECT id FROM cats WHERE slug = 'desserts')),
  ('Cookie Platter', 'Assorted freshly baked cookies', 2200, 'flat', ARRAY['vegetarian'], (SELECT id FROM cats WHERE slug = 'desserts')),
  ('Ice Cream Sundae Bar', 'Build-your-own sundae station with toppings', 500, 'per_person', ARRAY['vegetarian', 'gluten-free'], (SELECT id FROM cats WHERE slug = 'desserts')),
  ('Birthday Cake', 'Custom decorated cake for your celebration', 4500, 'flat', ARRAY['vegetarian'], (SELECT id FROM cats WHERE slug = 'desserts')),
  
  -- Beverages
  ('Soda Package', 'Unlimited fountain drinks for your group', 300, 'per_person', ARRAY['vegetarian', 'vegan', 'gluten-free'], (SELECT id FROM cats WHERE slug = 'beverages')),
  ('Energy Drink Pack (12)', 'Assorted energy drinks to keep the gaming going', 3600, 'flat', ARRAY['vegetarian', 'vegan', 'gluten-free'], (SELECT id FROM cats WHERE slug = 'beverages')),
  ('Coffee & Tea Station', 'Self-serve hot beverage station', 400, 'per_person', ARRAY['vegetarian', 'vegan', 'gluten-free'], (SELECT id FROM cats WHERE slug = 'beverages')),
  ('Water Bottles (24pk)', 'Stay hydrated with bottled water', 2000, 'flat', ARRAY['vegetarian', 'vegan', 'gluten-free'], (SELECT id FROM cats WHERE slug = 'beverages')),
  
  -- Snacks
  ('Chips & Dip Assortment', 'Variety of chips with salsa, guac, and queso', 2000, 'per_serving', ARRAY['vegetarian', 'gluten-free'], (SELECT id FROM cats WHERE slug = 'snacks')),
  ('Candy Bar', 'Assorted candies and chocolates', 1500, 'flat', ARRAY['vegetarian'], (SELECT id FROM cats WHERE slug = 'snacks')),
  ('Popcorn Station', 'Freshly popped popcorn with seasoning options', 1000, 'flat', ARRAY['vegetarian', 'vegan', 'gluten-free'], (SELECT id FROM cats WHERE slug = 'snacks')),
  ('Trail Mix Cups', 'Healthy snack mix portions', 200, 'per_person', ARRAY['vegetarian', 'vegan', 'gluten-free'], (SELECT id FROM cats WHERE slug = 'snacks'))
) AS v(name, description, price_cents, price_type, dietary_tags, category_id)
WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFY DATA
-- ============================================
SELECT 'Event Packages' as table_name, COUNT(*) as count FROM cb_event_packages WHERE is_active = true
UNION ALL
SELECT 'Event Addons', COUNT(*) FROM cb_event_addons WHERE is_active = true
UNION ALL
SELECT 'Catering Categories', COUNT(*) FROM cb_catering_categories
UNION ALL
SELECT 'Catering Items', COUNT(*) FROM cb_catering_items WHERE is_active = true;
