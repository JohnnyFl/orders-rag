import type { DocPayload, Label, Product } from "../schema";

// Patterns — be tolerant of double-space separators in the source.
const RE = {
    orderId:      /\border id\s+(\d+)/i,
    customerId:   /\bcustomer id\s+(\S+)/i,
    customerName: /\bcustomer name\s+(.+?)\s+(?:employee details|customer details|order details|address|$)/i,
    employeeName: /\bemployee name\s+(.+?)\s+(?:shipper details|order details|products|$)/i,
    shipperName:  /\bshipper name\s+(.+?)\s+(?:order details|products|$)/i,
    orderDate:    /\border date\s+(\d{4}-\d{1,2}-\d{1,2})/i,
    shippedDate:  /\bshipped date\s+(\d{4}-\d{1,2}-\d{1,2})/i,
    shipCountry:  /\bship country\s+([a-z][a-z\s\-.]*?)\s+(?:customer details|order details|$)/i,
    shipCity:     /\bship city\s+([a-z][a-z\s\-.]*?)\s+(?:ship region|ship postal code|ship country|$)/i,
    shipRegion:   /\bship region\s+([a-z][a-z\s\-.]*?)\s+(?:ship postal code|ship country|$)/i,
    totalPrice:   /\btotal price\s+(?:total price\s+)?([\d\s]+?)(?:\s+page|$)/i,
    reportPeriod: /\bstock report for\s+(\d{4}-\d{2})/i,
    reportCat:    /\bcategory\s+([a-z\s]+?)\s+id category\s+\d+/i,
    product:      /product\s+(.+?)\s+quantity\s+(\d+)\s+unit price\s+([\d\s]+?)(?:\s+total\s+([\d\s]+?))?(?:\s+(?:product|total price|page|$))/gi,
};

/** "38 0" → 38.00; "1368 0" → 1368.00; round to 2 decimals. */
export function parseLooseFloat(s: string | undefined): number | null {
    if (!s) return null;
    const t = s.trim();
    if (!t) return null;
    const direct = Number(t);
    if (!Number.isNaN(direct)) return Math.round(direct * 100) / 100;
    const parts = t.split(/\s+/);
    if (parts.length < 2) return null;
    const intPart = parts.slice(0, -1).join("");
    const fracPart = parts[parts.length - 1];
    const v = Number(`${intPart}.${fracPart}`);
    if (Number.isNaN(v)) return null;
    return Math.round(v * 100) / 100;
}

/** Date validator — returns ISO YYYY-MM-DD or null. */
function parseDate(s: string | undefined): string | null {
    if (!s) return null;
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (!m) return null;
    const [, y, mo, d] = m;
    const iso = `${y}-${mo!.padStart(2,"0")}-${d!.padStart(2,"0")}`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
}

export function extractRegex(text: string, label: Label): DocPayload {
    const t = text.toLowerCase();
    const p: DocPayload = {
        doc_id: "",  // caller fills
        label,
        text,
        word_count: text.split(/\s+/).length,
        products: [],
    };
    const get = (re: RegExp): string | null => re.exec(t)?.[1]?.trim() ?? null;

    p.order_id      = get(RE.orderId);
    p.customer_id   = get(RE.customerId);
    p.customer_name = get(RE.customerName);
    p.employee_name = get(RE.employeeName);
    p.shipper_name  = get(RE.shipperName);
    p.ship_country  = get(RE.shipCountry);
    p.ship_city     = get(RE.shipCity);
    p.ship_region   = get(RE.shipRegion);
    p.order_date    = parseDate(get(RE.orderDate) ?? undefined);
    p.shipped_date  = parseDate(get(RE.shippedDate) ?? undefined);

    const tp = parseLooseFloat(get(RE.totalPrice) ?? undefined);
    if (tp !== null && tp >= 0 && tp < 1e9) p.total_price = tp;

    if (label === "report") {
        p.report_period = get(RE.reportPeriod);
        p.report_category = get(RE.reportCat);
    }
    p.products = extractProducts(t);
    return p;
}

function extractProducts(t: string): Product[] {
    // Crop to the product block
    let block = t;
    const start = block.indexOf("products");
    if (start >= 0) block = block.slice(start);
    const end = block.indexOf("total price");
    if (end >= 0) block = block.slice(0, end);

    const out: Product[] = [];
    RE.product.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE.product.exec(block)) !== null) {
        const name = m[1]!.trim();
        const qty = Number(m[2]);
        const unit = parseLooseFloat(m[3]);
        if (!name || Number.isNaN(qty) || qty === 0 || unit === null) continue;
        const prod: Product = { name, quantity: qty, unit_price: unit };
        const total = parseLooseFloat(m[4]);
        if (total !== null) prod.total = total;
        out.push(prod);
    }
    return out;
}