import type { DocPayload, Label } from "../schema";
import { extractRegex } from "./regex";
import { extractLLM } from "./llm";

const isIncomplete = (p: DocPayload): boolean => {
    if (p.label === "shipping_order") return !p.order_id || !p.order_date || !p.ship_country || p.total_price == null;
    if (p.label === "invoice")         return !p.order_id || !p.order_date || p.total_price == null;
    if (p.label === "purchase_order")  return !p.order_id || !p.order_date;
    if (p.label === "report")          return !p.report_period || !p.report_category;
    return true;
};

const mergeNull = <T>(a: T | null | undefined, b: T | null | undefined): T | null | undefined =>
    a ?? b ?? null;

function merge(dst: DocPayload, src: DocPayload): void {
    dst.order_id      = mergeNull(dst.order_id, src.order_id);
    dst.order_date    = mergeNull(dst.order_date, src.order_date);
    dst.shipped_date  = mergeNull(dst.shipped_date, src.shipped_date);
    dst.customer_id   = mergeNull(dst.customer_id, src.customer_id);
    dst.customer_name = mergeNull(dst.customer_name, src.customer_name);
    dst.employee_name = mergeNull(dst.employee_name, src.employee_name);
    dst.shipper_name  = mergeNull(dst.shipper_name, src.shipper_name);
    dst.ship_country  = mergeNull(dst.ship_country, src.ship_country);
    dst.ship_city     = mergeNull(dst.ship_city, src.ship_city);
    dst.ship_region   = mergeNull(dst.ship_region, src.ship_region);
    dst.total_price   = dst.total_price ?? src.total_price ?? null;
    dst.report_category = mergeNull(dst.report_category, src.report_category);
    dst.report_period   = mergeNull(dst.report_period, src.report_period);
    if (dst.products.length === 0 && src.products.length > 0) dst.products = src.products;
}

export async function extract(text: string, label: Label): Promise<{ payload: DocPayload; usedLlm: boolean }> {
    const p = extractRegex(text, label);
    if (!isIncomplete(p)) return { payload: p, usedLlm: false };
    const llmP = await extractLLM(text, label);
    merge(p, llmP);
    return { payload: p, usedLlm: true };
}