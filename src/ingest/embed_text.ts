import type { DocPayload } from "../schema";

export function docEmbedText(p: DocPayload): string {
    const parts: string[] = [p.label];
    if (p.customer_name) parts.push(`Customer: ${p.customer_name}`);
    if (p.ship_country)  parts.push(`Country: ${p.ship_country}`);
    if (p.ship_city)     parts.push(`City: ${p.ship_city}`);
    if (p.order_date)    parts.push(`Date: ${p.order_date}`);
    if (p.employee_name) parts.push(`Employee: ${p.employee_name}`);
    if (p.shipper_name)  parts.push(`Shipper: ${p.shipper_name}`);
    for (const prod of p.products) {
        parts.push(`Product: ${prod.name} (qty ${prod.quantity}, unit ${prod.unit_price.toFixed(2)})`);
    }
    if (p.total_price != null) parts.push(`Total: ${p.total_price.toFixed(2)}`);
    if (p.report_category) parts.push(`Report category: ${p.report_category}`);
    if (p.report_period)   parts.push(`Report period: ${p.report_period}`);
    return parts.join("\n");
}