import { createClient } from "@/lib/supabase/client";

export async function getUsers() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function updateUser(id: string, values: any) {
  const supabase = createClient();

  const { error } = await supabase
    .from("profiles")
    .update(values)
    .eq("id", id);

  if (error) throw error;
}

export async function disableUser(id: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      active: false,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function enableUser(id: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      active: true,
    })
    .eq("id", id);

  if (error) throw error;
}
