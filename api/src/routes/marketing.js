import { Router } from "express";

import {
  deriveCustomerProfile,
  identityProviderFromSubject,
} from "../domain/customer-profile.js";

export function createMarketingRouter({
  checkJwt,
  requireReadOrders,
  ordersRepository,
  marketingEventsRepository,
  now = () => new Date(),
}) {
  const router = Router();

  router.post(
    "/identify",
    checkJwt,
    requireReadOrders,
    async (request, response, next) => {
      try {
        const subject = request.auth.payload.sub;
        const orders = await ordersRepository.listForUser(subject);
        const event = {
          type: "identify",
          userId: subject,
          traits: deriveCustomerProfile(orders, {
            identityProvider: identityProviderFromSubject(subject),
          }),
          context: { source: "pizza42-poc" },
          timestamp: now().toISOString(),
        };

        await marketingEventsRepository.append(event);
        response.status(202).json({ accepted: true, event });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/events",
    checkJwt,
    requireReadOrders,
    async (request, response, next) => {
      try {
        const events = await marketingEventsRepository.listForUser(
          request.auth.payload.sub,
        );
        response.status(200).json({ events });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
