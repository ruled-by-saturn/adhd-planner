import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://loyenvtlqvygaaoggagh.supabase.co/'
const SUPABASE_KEY = 'sb_publishable_Gs7avuO9b8VNrauBTB0RPg_unuBF0zE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)