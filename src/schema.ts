import { z } from "zod";

export const Label = z.enum([
    "shipping_order",
    "invoice",
    "purchase_order",
    "report",
    "unknown",
]);
export type Label = z.infer<typeof Label>;

export const Product = z.object({
    name: z.string(),
    quantity: z.number().int(),
    unit_price: z.number(),
    product_id: z.string().nullable().optional(),
    total: z.number().nullable().optional(),
});
export type Product = z.infer<typeof Product>;

export const DocPayload = z.object({
    doc_id: z.string(),
    label: Label,
    text: z.string(),
    word_count: z.number().int(),

    // Order-like
    order_id: z.string().nullable().optional(),
    order_date: z.string().nullable().optional(),     // ISO YYYY-MM-DD
    shipped_date: z.string().nullable().optional(),
    customer_id: z.string().nullable().optional(),
    customer_name: z.string().nullable().optional(),
    employee_name: z.string().nullable().optional(),
    shipper_name: z.string().nullable().optional(),

    // Shipping address
    ship_country: z.string().nullable().optional(),
    ship_city: z.string().nullable().optional(),
    ship_region: z.string().nullable().optional(),

    // Money
    total_price: z.number().nullable().optional(),

    // Line items
    products: z.array(Product).default([]),

    // Reports
    report_category: z.string().nullable().optional(),
    report_period: z.string().nullable().optional(),
});
export type DocPayload = z.infer<typeof DocPayload>;

export function normalizeLabel(raw: string): Label {
    const k = raw.trim().toLowerCase().replace(/\s+/g, "");
    if (k === "shippingorder") return "shipping_order";
    if (k === "invoice") return "invoice";
    if (k === "purchaseorder") return "purchase_order";
    if (k === "report") return "report";
    return "unknown";
}