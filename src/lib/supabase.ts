import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://liupxejfsdkzcuxtvqhp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdXB4ZWpmc2RremN1eHR2cWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzU0MjksImV4cCI6MjA4OTU1MTQyOX0.m-L0ELu_DlVAB4fLqMae0EfWgFP4utlweARrkN-1pD8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
