import { randomUUID } from "node:crypto";

import { z } from "zod";

const requestedOrderSchema = z
  .object({
    store: z.enum([
      "Dublin Camden Street",
      "Dublin Rathmines",
      "Dublin Smithfield",
    ]),
    items: z
      .array(
        z
          .object({
            sku: z.string().min(1),
            qty: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

export class OrderInputError extends Error {
  constructor(code) {
    super(code);
    this.name = "OrderInputError";
    this.code = code;
  }
}

function money(value) {
  return Math.round(value * 100) / 100;
}

export function buildOrder(requestedOrder, catalogue) {
  const parsedOrder = requestedOrderSchema.safeParse(requestedOrder);

  if (!parsedOrder.success) {
    throw new OrderInputError("invalid_order");
  }

  const items = parsedOrder.data.items.map(({ sku, qty }) => {
    const menuItem = catalogue[sku];

    if (!menuItem) {
      throw new OrderInputError("unknown_sku");
    }

    const lineTotal = money(menuItem.price * qty);

    return {
      sku: menuItem.sku,
      name: menuItem.name,
      ...(menuItem.size ? { size: menuItem.size } : {}),
      qty,
      unit_price: menuItem.price,
      line_total: lineTotal,
    };
  });

  return {
    id: `ord_${randomUUID()}`,
    placed_at: new Date().toISOString(),
    store: parsedOrder.data.store,
    items,
    total: money(items.reduce((sum, item) => sum + item.line_total, 0)),
    currency: "EUR",
  };
}
