import { createClient } from "@/lib/supabase/client";

export type CustomerType =
  | "customer"
  | "supplier"
  | "both"
  | "agent"
  | "shipping_line"
  | "warehouse";

export type CustomerStatus =
  | "lead"
  | "active"
  | "inactive"
  | "blocked";

export type Customer = {
  id: string;
  customer_code: string | null;
  company_name: string;
  customer_type: CustomerType;
  status: CustomerStatus;

  contact_person: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;

  country: string | null;
  city: string | null;
  address: string | null;

  tax_number: string | null;
  registration_number: string | null;

  industry: string | null;
  source: string | null;

  credit_limit: number;
  currency: string;

  notes: string | null;

  created_by: string | null;
  assigned_to: string | null;

  created_at: string;
  updated_at: string;
};

export type CreateCustomerInput = {
  customer_code?: string;
  company_name: string;
  customer_type: CustomerType;
  status: CustomerStatus;

  contact_person?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;

  country?: string;
  city?: string;
  address?: string;

  tax_number?: string;
  registration_number?: string;

  industry?: string;
  source?: string;

  credit_limit?: number;
  currency?: string;

  notes?: string;
  created_by?: string;
  assigned_to?: string;
};

export async function getCustomers(): Promise<Customer[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Customer[];
}

export async function createCustomer(
  values: CreateCustomerInput
): Promise<Customer> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authenticated user was not found.");
  }

  const payload = {
    ...values,
    customer_code: values.customer_code?.trim() || null,
    company_name: values.company_name.trim(),
    contact_person: values.contact_person?.trim() || null,
    email: values.email?.trim() || null,
    phone: values.phone?.trim() || null,
    mobile: values.mobile?.trim() || null,
    website: values.website?.trim() || null,
    country: values.country?.trim() || null,
    city: values.city?.trim() || null,
    address: values.address?.trim() || null,
    tax_number: values.tax_number?.trim() || null,
    registration_number:
      values.registration_number?.trim() || null,
    industry: values.industry?.trim() || null,
    source: values.source?.trim() || null,
    notes: values.notes?.trim() || null,
    currency: values.currency?.trim() || "AED",
    credit_limit: values.credit_limit ?? 0,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Customer;
}

export async function updateCustomer(
  id: string,
  values: Partial<CreateCustomerInput>
): Promise<Customer> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("customers")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}
