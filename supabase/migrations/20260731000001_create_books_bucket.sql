INSERT INTO storage.buckets (id, name, public) 
VALUES ('books', 'books', false)
ON CONFLICT (id) DO NOTHING;
