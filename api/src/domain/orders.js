import { randomUUID } from "node:crypto";

import { z } from "zod";

import { MAX_LINE_QUANTITY, MAX_ORDER_LINES } from "../config/contracts.js";
import { stores } from "../config/menu.js";

const requestedOrderSchema = z
  .object({
    store: z.enum(stores),
    items: z
      .array(
        z
          .object({
            sku: z.string().min(1),
            qty: z.number().int().min(1).max(MAX_LINE_QUANTITY),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_ORDER_LINES),
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
    // Own-property check only. A bare `catalogue[sku]` resolves inherited
    // Object.prototype members, so SKUs like "toString" or "__proto__" would
    // pass the unknown-item guard and produce an order with a NaN total.
    if (!Object.hasOwn(catalogue, sku)) {
      throw new OrderInputError("unknown_sku");
    }

    const menuItem = catalogue[sku];

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
