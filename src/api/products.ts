// BI_CLIENT_COVERAGE_v4
import { api } from "@/api/client";

export type Product = {
  code: string;
  display_name: string;
  carrier: string;
  coverage_category: string;
  description: string;
  sort_order: number;
};

export type Selected = Product & { source: "contract" | "recommended" | "client_added" };

export type SelectionResult = {
  applicationId: string;
  country: "CA" | "US";
  selected: Selected[];
};

export function listProducts(country: "CA" | "US", industry?: string) {
  const query = new URLSearchParams({ country });
  if (industry) query.set("industry", industry);
  return api.get<{ country: string; industry?: string; kind?: "products" | "categories"; products: Product[] }>(
    `/applicants/products?${query.toString()}`,
  );
}

// "me" resolves server-side to the caller's in-flight application, so the
// no-contract path works before an application id is ever shown to the client.
export function getSelection(applicationId: string) {
  return api.get<SelectionResult>(
    `/applicants/applications/${encodeURIComponent(applicationId)}/products`,
  );
}

export function saveSelection(applicationId: string, codes: string[]) {
  return api.post<SelectionResult>(
    `/applicants/applications/${encodeURIComponent(applicationId)}/products`,
    { codes },
  );
}
