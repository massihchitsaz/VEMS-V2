"use client";

import { useCallback, useEffect, useState } from "react";
import {
  seedOpportunities,
  seedQuotations,
  seedSuppliers,
  seedTasks,
  type CommercialOpportunity,
  type CommercialQuotation,
  type CommercialSupplier,
  type CommercialTask,
} from "@/lib/commercial-data";

type CommercialState = {
  opportunities: CommercialOpportunity[];
  tasks: CommercialTask[];
  suppliers: CommercialSupplier[];
  quotations: CommercialQuotation[];
};

const STORAGE_KEY = "vtc-commercial-workspace-v1";
const initialState: CommercialState = {
  opportunities: seedOpportunities,
  tasks: seedTasks,
  suppliers: seedSuppliers,
  quotations: seedQuotations,
};

export function useCommercialStore() {
  const [state, setState] = useState<CommercialState>(initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setState(JSON.parse(raw) as CommercialState);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [ready, state]);

  const updateOpportunity = useCallback((id: string, patch: Partial<CommercialOpportunity>) => {
    setState((current) => ({
      ...current,
      opportunities: current.opportunities.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
      ),
    }));
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<CommercialTask>) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }, []);

  const addOpportunity = useCallback((input: Omit<CommercialOpportunity, "id" | "updatedAt">) => {
    const item: CommercialOpportunity = {
      ...input,
      id: `opp-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    setState((current) => ({ ...current, opportunities: [item, ...current.opportunities] }));
    return item;
  }, []);

  const resetStore = useCallback(() => setState(initialState), []);

  return { ...state, ready, updateOpportunity, updateTask, addOpportunity, resetStore };
}
