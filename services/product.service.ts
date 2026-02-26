import { supabase } from '@/lib/supabase';

export const productService = {
  async list() {
    return supabase.from('products').select('id,name,family,is_weekend_special,is_christmas_special').eq('is_active', true).order('name');
  }
};
