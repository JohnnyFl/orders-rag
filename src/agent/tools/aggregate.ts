import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { qdrant, COLLECTION_V2_HYBRID } from "../../clients/qdrant";

const Args = z.object({
  metric: z.enum(["count","sum_total_price","avg_total_price"]),
  group_by: z.enum(["","label","ship_country","customer_id","employee_name"]).default(""),
  label: z.enum(["shipping_order","invoice","purchase_order","report"]).optional(),
  country: z.string().optional(),
  customer_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

function buildFilter(a: z.infer<typeof Args>): any | undefined {
  const must: any[] = [];
  if (a.label)       must.push({ key: "label",        match: { value: a.label } });
  if (a.country)     must.push({ key: "ship_country", match: { value: a.country } });
  if (a.customer_id) must.push({ key: "customer_id",  match: { value: a.customer_id } });
  if (a.date_from || a.date_to) {
    must.push({
      key: "order_date",
      range: {
        ...(a.date_from && { gte: a.date_from }),
        ...(a.date_to && { lte: a.date_to }),
      },
    });
  }
  return must.length ? { must } : undefined;
}

export const aggregateDocuments = tool(
  async (a: z.infer<typeof Args>): Promise<string> => {
    const flt = buildFilter(a);
    const groups = new Map<string, { n: number; sum: number }>();

    let offset: any = undefined;
    while (true) {
      const r: any = await qdrant().scroll(COLLECTION_V2_HYBRID, {
        filter: flt,
        limit: 200,
        with_payload: true,
        with_vector: false,
        offset,
      });
      for (const p of r.points) {
        const key = a.group_by ? String(p.payload?.[a.group_by] ?? "") : "";
        const g = groups.get(key) ?? { n: 0, sum: 0 };
        g.n += 1;
        const tp = p.payload?.total_price;
        if (typeof tp === "number") g.sum += tp;
        groups.set(key, g);
      }
      if (!r.next_page_offset) break;
      offset = r.next_page_offset;
    }

    const rows = [...groups.entries()].map(([k, g]) => {
      let v = 0;
      if (a.metric === "count") v = g.n;
      else if (a.metric === "sum_total_price") v = g.sum;
      else if (a.metric === "avg_total_price") v = g.n ? g.sum / g.n : 0;
      return { key: k, value: v };
    }).sort((x, y) => y.value - x.value);

    if (rows.length === 0) return "No documents matched the filter.";
    if (!a.group_by && rows.length === 1) return `${a.metric}: ${rows[0]!.value.toFixed(2)}`;
    return `${a.metric}, grouped by ${a.group_by}:\n` + rows.map(r => `  ${r.key}: ${r.value.toFixed(2)}`).join("\n");
  },
  {
    name: "aggregate_documents",
    description: "Count/sum/average across a filtered subset. Use for 'how many', 'total of', 'average of' questions. Optionally group by one field.",
    schema: Args,
  }
);