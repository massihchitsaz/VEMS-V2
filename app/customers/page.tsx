"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createCustomer,
  getCustomers,
  type Customer,
  type CustomerStatus,
  type CustomerType,
} from "@/lib/customers";

type CustomerForm = {
  company_name: string;
  customer_code: string;
  customer_type: CustomerType;
  status: CustomerStatus;
  contact_person: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  industry: string;
  currency: string;
  credit_limit: string;
  notes: string;
};

const initialForm: CustomerForm = {
  company_name: "",
  customer_code: "",
  customer_type: "customer",
  status: "active",
  contact_person: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  industry: "",
  currency: "AED",
  credit_limit: "0",
  notes: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>(initialForm);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | CustomerStatus>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    void loadCustomers();
  }, []);

  async function loadCustomers() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error(error);
      setErrorMessage("Unable to load customers.");
    } finally {
      setIsLoading(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesStatus =
        statusFilter === "all" ||
        customer.status === statusFilter;

      const searchableText = [
        customer.company_name,
        customer.customer_code,
        customer.contact_person,
        customer.email,
        customer.phone,
        customer.country,
        customer.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        searchableText.includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [customers, search, statusFilter]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!form.company_name.trim()) {
      setErrorMessage("Company name is required.");
      return;
    }

    setIsSaving(true);

    try {
      const createdCustomer = await createCustomer({
        company_name: form.company_name,
        customer_code: form.customer_code,
        customer_type: form.customer_type,
        status: form.status,
        contact_person: form.contact_person,
        email: form.email,
        phone: form.phone,
        country: form.country,
        city: form.city,
        industry: form.industry,
        currency: form.currency,
        credit_limit: Number(form.credit_limit) || 0,
        notes: form.notes,
      });

      setCustomers((currentCustomers) => [
        createdCustomer,
        ...currentCustomers,
      ]);

      setForm(initialForm);
      setIsFormOpen(false);
      setSuccessMessage("Customer created successfully.");
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to create customer.";

      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  function updateForm<K extends keyof CustomerForm>(
    key: K,
    value: CustomerForm[K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  }

  return (
    <main className="min-h-screen bg-[#070b14] p-6 text-white md:p-8">
      <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-blue-400">
            VTC ONE CRM
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Customers & Suppliers
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Manage companies, customers, suppliers and business contacts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsFormOpen((current) => !current);
            setErrorMessage("");
            setSuccessMessage("");
          }}
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500"
        >
          {isFormOpen ? "Close Form" : "+ Add Customer"}
        </button>
      </header>

      {errorMessage && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {successMessage}
        </div>
      )}

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-2xl border border-white/10 bg-[#0d1422] p-6"
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              New Customer
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Register a customer, supplier, agent or logistics partner.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Company Name" required>
              <input
                required
                value={form.company_name}
                onChange={(event) =>
                  updateForm(
                    "company_name",
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="Company legal name"
              />
            </Field>

            <Field label="Customer Code">
              <input
                value={form.customer_code}
                onChange={(event) =>
                  updateForm(
                    "customer_code",
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="VTC-CUS-001"
              />
            </Field>

            <Field label="Business Type">
              <select
                value={form.customer_type}
                onChange={(event) =>
                  updateForm(
                    "customer_type",
                    event.target.value as CustomerType
                  )
                }
                className={inputClass}
              >
                <option value="customer">Customer</option>
                <option value="supplier">Supplier</option>
                <option value="both">
                  Customer & Supplier
                </option>
                <option value="agent">Agent</option>
                <option value="shipping_line">
                  Shipping Line
                </option>
                <option value="warehouse">
                  Warehouse
                </option>
              </select>
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(event) =>
                  updateForm(
                    "status",
                    event.target.value as CustomerStatus
                  )
                }
                className={inputClass}
              >
                <option value="lead">Lead</option>
                <option value="active">Active</option>
                <option value="inactive">
                  Inactive
                </option>
                <option value="blocked">Blocked</option>
              </select>
            </Field>

            <Field label="Contact Person">
              <input
                value={form.contact_person}
                onChange={(event) =>
                  updateForm(
                    "contact_person",
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="Full name"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateForm("email", event.target.value)
                }
                className={inputClass}
                placeholder="contact@company.com"
              />
            </Field>

            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(event) =>
                  updateForm("phone", event.target.value)
                }
                className={inputClass}
                placeholder="+971..."
              />
            </Field>

            <Field label="Industry">
              <input
                value={form.industry}
                onChange={(event) =>
                  updateForm(
                    "industry",
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="Trading, Logistics..."
              />
            </Field>

            <Field label="Country">
              <input
                value={form.country}
                onChange={(event) =>
                  updateForm(
                    "country",
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="United Arab Emirates"
              />
            </Field>

            <Field label="City">
              <input
                value={form.city}
                onChange={(event) =>
                  updateForm("city", event.target.value)
                }
                className={inputClass}
                placeholder="Dubai"
              />
            </Field>

            <Field label="Currency">
              <select
                value={form.currency}
                onChange={(event) =>
                  updateForm(
                    "currency",
                    event.target.value
                  )
                }
                className={inputClass}
              >
                <option value="AED">AED</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="CNY">CNY</option>
                <option value="INR">INR</option>
              </select>
            </Field>

            <Field label="Credit Limit">
              <input
                type="number"
                min="0"
                value={form.credit_limit}
                onChange={(event) =>
                  updateForm(
                    "credit_limit",
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field label="Notes">
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) =>
                  updateForm("notes", event.target.value)
                }
                className={inputClass}
                placeholder="Commercial notes, payment terms or other details..."
              />
            </Field>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setForm(initialForm);
                setIsFormOpen(false);
              }}
              className="rounded-lg border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:bg-white/5"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Create Customer"}
            </button>
          </div>
        </form>
      )}

      <section className="rounded-2xl border border-white/10 bg-[#0d1422]">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 md:flex-row">
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search company, contact, email, country..."
            className={`${inputClass} md:max-w-md`}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | "all"
                  | CustomerStatus
              )
            }
            className={`${inputClass} md:max-w-48`}
          >
            <option value="all">All Statuses</option>
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blocked">Blocked</option>
          </select>

          <button
            type="button"
            onClick={() => void loadCustomers()}
            className="rounded-lg border border-white/10 px-5 py-3 text-sm transition hover:bg-white/5"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-262.5 w-full ...">
            <thead className="bg-[#111b2d] text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="p-4">Company</th>
                <th className="p-4">Type</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Location</th>
                <th className="p-4">Credit Limit</th>
                <th className="p-4">Status</th>
                <th className="p-4">Created</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-10 text-center text-slate-400"
                  >
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-10 text-center text-slate-400"
                  >
                    No customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition hover:bg-white/3"
                  >
                    <td className="p-4">
                      <p className="font-semibold">
                        {customer.company_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {customer.customer_code ||
                          "No customer code"}
                      </p>
                    </td>

                    <td className="p-4 text-sm capitalize text-slate-300">
                      {customer.customer_type.replace(
                        "_",
                        " "
                      )}
                    </td>

                    <td className="p-4">
                      <p className="text-sm">
                        {customer.contact_person || "-"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {customer.email ||
                          customer.phone ||
                          "-"}
                      </p>
                    </td>

                    <td className="p-4 text-sm text-slate-300">
                      {[customer.city, customer.country]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </td>

                    <td className="p-4 text-sm font-medium">
                      {customer.currency}{" "}
                      {Number(
                        customer.credit_limit
                      ).toLocaleString()}
                    </td>

                    <td className="p-4">
                      <StatusBadge
                        status={customer.status}
                      />
                    </td>

                    <td className="p-4 text-sm text-slate-400">
                      {new Date(
                        customer.created_at
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-white/10 px-5 py-4 text-sm text-slate-400">
          Showing {filteredCustomers.length} of{" "}
          {customers.length} companies
        </div>
      </section>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#080d17] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-300">
        {label}
        {required && (
          <span className="ml-1 text-red-400">*</span>
        )}
      </span>

      {children}
    </label>
  );
}

function StatusBadge({
  status,
}: {
  status: CustomerStatus;
}) {
  const styles: Record<CustomerStatus, string> = {
    lead: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    active:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    inactive:
      "border-slate-500/30 bg-slate-500/10 text-slate-300",
    blocked:
      "border-red-500/30 bg-red-500/10 text-red-300",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}