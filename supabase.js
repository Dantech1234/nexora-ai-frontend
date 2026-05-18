import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "https://vqkwqjaynzaezumvqtmu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxa3dxamF5bnphZXp1bXZxdG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODQ5MjMsImV4cCI6MjA5NDQ2MDkyM30.J1OYlqoZiFWUaFJIWE0wzRI9kOuxa8qA3GA9TRrnZio",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
