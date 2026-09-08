-- Bag offer configuration
INSERT INTO settings (key, value, description) VALUES
  ('bag_offer', '{
    "enabled": true,
    "daily_price": 500,
    "original_price": 700,
    "max_items": 15,
    "title": "شنطة Laundry Bag",
    "subtitle": "املأ الشنطة غسيل ومكوي بحد أقصى 15 قطعة",
    "badge_text": "الحق العرض"
  }', 'إعدادات عرض شنطة Laundry Bag اليومي')
ON CONFLICT (key) DO NOTHING;
