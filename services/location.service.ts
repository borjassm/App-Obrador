import { supabase } from '@/lib/supabase';

export const locationService = {
  async listAll() {
    return supabase.from('locations').select('id,name').eq('is_active', true).order('name');
  }
};
