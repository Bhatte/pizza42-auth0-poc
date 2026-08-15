import { Router } from "express";

import { CLAIMS } from "../config/contracts.js";
import { menu } from "../config/menu.js";
import { buildOrder } from "../domain/orders.js";
import { requireVerifiedEmail } from "../middleware/verified-email.js";

export function createOrdersRouter({
  checkJwt,
  requireCreateOrders,
  requireReadOrders,
  ordersRepository,
}) {
  const router = Router();

  router.get(
    "/",
    checkJwt,
    requireReadOrders,
    async (request, response, next) => {
      try {
        const orders = await ordersRepository.listForUser(
          request.auth.payload.sub,
        );
        response.status(200).json({ orders });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/",
    checkJwt,
    requireCreateOrders,
    requireVerifiedEmail(CLAIMS.emailVerified),
    async (request, response, next) => {
      try {
        const order = buildOrder(request.body, menu);
        await ordersRepository.appendForUser(request.auth.payload.sub, order);
        response.status(201).json(order);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
