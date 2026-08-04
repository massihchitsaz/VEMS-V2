"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  createDeal,
  type DealInput,
} from "@/lib/deals";

import {
  getCustomers,
  type Customer,
} from "@/lib/customers";

const initialForm: DealInput = {
  customer_id: null,
  supplier_id: null,

  commodity: "",
  origin_country: "",
  destination_country: "",
  incoterm: "FOB",

  quantity: 0,
  unit: "MT",

  buy_currency: "USD",
  sell_currency: "USD",

  buy_price: 0,
  sell_price: 0,

  payment_status: "Pending",
  shipment_status: "Planning",

  etd: null,
  eta: null,

  container_no: "",
  bl_no: "",
  notes: "",
};

export default function NewDealPage() {
  const router = useRouter();

  const [form, setForm] =
    useState<DealInput>(initialForm);

  const [companies, setCompanies] =
    useState<Customer[]>([]);

  const [isLoadingCompanies, setIsLoadingCompanies] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    async function loadCompanies() {
      try {
        const data = await getCustomers();
        setCompanies(data);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          "Unable to load customers and suppliers."
        );
      } finally {
        setIsLoadingCompanies(false);
      }
    }

    void loadCompanies();
  }, []);

  const customers = useMemo(
    () =>
      companies.filter((company) =>
        ["customer", "both"].includes(
          company.customer_type
        )
      ),
    [companies]
  );

  const suppliers = useMemo(
    () =>
      companies.filter((company) =>
        ["supplier", "both"].includes(
          company.customer_type
        )
      ),
    [companies]
  );

  const totalSale =
    Number(form.quantity || 0) *
    Number(form.sell_price || 0);

  const totalCost =
    Number(form.quantity || 0) *
    Number(form.buy_price || 0);

  const grossProfit = totalSale - totalCost;

  function updateForm<K extends keyof DealInput>(
    key: K,
    value: DealInput[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!form.customer_id) {
      setErrorMessage(
        "Please select a customer."
      );
      return;
    }

    if (!form.commodity.trim()) {
      setErrorMessage(
        "Commodity is required."
      );
      return;
    }

    if (form.quantity <= 0) {
      setErrorMessage(
        "Quantity must be greater than zero."
      );
      return;
    }

    setIsSaving(true);

    try {
      const deal = await createDeal(form);

      setSuccessMessage(
        `Deal ${deal.deal_no} created successfully.`
      );

      setForm(initialForm);

      setTimeout(() => {
        router.push("/deals");
      }, 1200);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create deal."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070b14] p-6 text-white md:p-8">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-blue-400">
          VTC GROUP TRADING
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Create New Deal
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Register commercial, financial and shipment information.
        </p>
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

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <Section title="Commercial Information">
          <Field label="Customer" required>
            <select
              required
              disabled={isLoadingCompanies}
              value={form.customer_id ?? ""}
              onChange={(event) =>
                updateForm(
                  "customer_id",
                  event.target.value || null
                )
              }
              className={inputClass}
            >
              <option value="">
                Select customer
              </option>

              {customers.map((customer) => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
                  {customer.company_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Supplier">
            <select
              disabled={isLoadingCompanies}
              value={form.supplier_id ?? ""}
              onChange={(event) =>
                updateForm(
                  "supplier_id",
                  event.target.value || null
                )
              }
              className={inputClass}
            >
              <option value="">
                Select supplier
              </option>

              {suppliers.map((supplier) => (
                <option
                  key={supplier.id}
                  value={supplier.id}
                >
                  {supplier.company_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Commodity" required>
            <input
              required
              value={form.commodity}
              onChange={(event) =>
                updateForm(
                  "commodity",
                  event.target.value
                )
              }
              className={inputClass}
              placeholder="Copper Scrap, Solar Panels..."
            />
          </Field>

          <Field label="Incoterm">
            <select
              value={form.incoterm}
              onChange={(event) =>
                updateForm(
                  "incoterm",
                  event.target.value
                )
              }
              className={inputClass}
            >
              <option value="EXW">EXW</option>
              <option value="FCA">FCA</option>
              <option value="FOB">FOB</option>
              <option value="CFR">CFR</option>
              <option value="CIF">CIF</option>
              <option value="DAP">DAP</option>
              <option value="DDP">DDP</option>
            </select>
          </Field>

          <Field label="Origin">
            <input
              value={form.origin_country}
              onChange={(event) =>
                updateForm(
                  "origin_country",
                  event.target.value
                )
              }
              className={inputClass}
              placeholder="China"
            />
          </Field>

          <Field label="Destination">
            <input
              value={form.destination_country}
              onChange={(event) =>
                updateForm(
                  "destination_country",
                  event.target.value
                )
              }
              className={inputClass}
              placeholder="United Arab Emirates"
            />
          </Field>
        </Section>

        <Section title="Financial Information">
          <Field label="Quantity" required>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={form.quantity}
              onChange={(event) =>
                updateForm(
                  "quantity",
                  Number(event.target.value)
                )
              }
              className={inputClass}
            />
          </Field>

          <Field label="Unit">
            <select
              value={form.unit}
              onChange={(event) =>
                updateForm(
                  "unit",
                  event.target.value
                )
              }
              className={inputClass}
            >
              <option value="MT">MT</option>
              <option value="KG">KG</option>
              <option value="PCS">PCS</option>
              <option value="CBM">CBM</option>
              <option value="Container">
                Container
              </option>
            </select>
          </Field>

          <Field label="Buy Currency">
            <CurrencySelect
              value={form.buy_currency}
              onChange={(value) =>
                updateForm(
                  "buy_currency",
                  value
                )
              }
            />
          </Field>

          <Field label="Buy Price">
            <input
              type="number"
              min="0"
              step="any"
              value={form.buy_price}
              onChange={(event) =>
                updateForm(
                  "buy_price",
                  Number(event.target.value)
                )
              }
              className={inputClass}
            />
          </Field>

          <Field label="Sell Currency">
            <CurrencySelect
              value={form.sell_currency}
              onChange={(value) =>
                updateForm(
                  "sell_currency",
                  value
                )
              }
            />
          </Field>

          <Field label="Sell Price">
            <input
              type="number"
              min="0"
              step="any"
              value={form.sell_price}
              onChange={(event) =>
                updateForm(
                  "sell_price",
                  Number(event.target.value)
                )
              }
              className={inputClass}
            />
          </Field>
        </Section>

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Total Cost"
            value={`${form.buy_currency} ${totalCost.toLocaleString()}`}
          />

          <SummaryCard
            label="Total Sale"
            value={`${form.sell_currency} ${totalSale.toLocaleString()}`}
          />

          <SummaryCard
            label="Gross Profit"
            value={`${form.sell_currency} ${grossProfit.toLocaleString()}`}
          />
        </section>

        <Section title="Shipment & Payment">
          <Field label="Payment Status">
            <select
              value={form.payment_status}
              onChange={(event) =>
                updateForm(
                  "payment_status",
                  event.target.value
                )
              }
              className={inputClass}
            >
              <option value="Pending">
                Pending
              </option>
              <option value="Partial">
                Partial
              </option>
              <option value="Paid">Paid</option>
              <option value="Overdue">
                Overdue
              </option>
            </select>
          </Field>

          <Field label="Shipment Status">
            <select
              value={form.shipment_status}
              onChange={(event) =>
                updateForm(
                  "shipment_status",
                  event.target.value
                )
              }
              className={inputClass}
            >
              <option value="Planning">
                Planning
              </option>
              <option value="Booked">Booked</option>
              <option value="In Transit">
                In Transit
              </option>
              <option value="Delivered">
                Delivered
              </option>
            </select>
          </Field>

          <Field label="ETD">
            <input
              type="date"
              value={form.etd ?? ""}
              onChange={(event) =>
                updateForm(
                  "etd",
                  event.target.value || null
                )
              }
              className={inputClass}
            />
          </Field>

          <Field label="ETA">
            <input
              type="date"
              value={form.eta ?? ""}
              onChange={(event) =>
                updateForm(
                  "eta",
                  event.target.value || null
                )
              }
              className={inputClass}
            />
          </Field>

          <Field label="Container Number">
            <input
              value={form.container_no}
              onChange={(event) =>
                updateForm(
                  "container_no",
                  event.target.value
                )
              }
              className={inputClass}
            />
          </Field>

          <Field label="BL Number">
            <input
              value={form.bl_no}
              onChange={(event) =>
                updateForm(
                  "bl_no",
                  event.target.value
                )
              }
              className={inputClass}
            />
          </Field>
        </Section>

        <Section title="Notes">
          <textarea
            rows={5}
            value={form.notes}
            onChange={(event) =>
              updateForm(
                "notes",
                event.target.value
              )
            }
            className={inputClass}
          />
        </Section>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-white/10 px-6 py-3 text-sm text-slate-300"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {isSaving
              ? "Creating Deal..."
              : "Create Deal"}
          </button>
        </div>
      </form>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#080d17] px-4 py-3 text-sm text-white outline-none focus:border-blue-500";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-6">
      <h2 className="mb-5 text-lg font-semibold">
        {title}
      </h2>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

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
    <label>
      <span className="mb-2 block text-sm text-slate-300">
        {label}
        {required && (
          <span className="ml-1 text-red-400">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

function CurrencySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className={inputClass}
    >
      <option value="AED">AED</option>
      <option value="USD">USD</option>
      <option value="EUR">EUR</option>
      <option value="CNY">CNY</option>
      <option value="INR">INR</option>
    </select>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1422] p-5">
      <p className="text-sm text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-xl font-bold">
        {value}
      </p>
    </div>
  );
}
