import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Pizza42App } from "./Pizza42App.jsx";
import "./styles.css";

const menu = {
  currency: "EUR",
  items: [
    {
      sku: "PIZ-MARG-L",
      name: "Margherita",
      description: "Tomato, mozzarella and basil",
      size: "Large",
      price: 14.5,
      category: "pizza",
    },
    {
      sku: "PIZ-VEG-L",
      name: "Garden Veg",
      description: "Roasted peppers, mushroom, red onion and mozzarella",
      size: "Large",
      price: 15.5,
      category: "pizza",
    },
    {
      sku: "SID-GARL",
      name: "Garlic Bread",
      description: "Baked with garlic butter and parsley",
      price: 4.5,
      category: "side",
    },
  ],
};

const auth = {
  isAuthenticated: true,
  isLoading: false,
  user: { name: "Maya", email: "maya@example.com" },
  idTokenClaims: {
    sub: "auth0|preview-customer",
    "https://pizza42.com/email_verified": false,
    "https://pizza42.com/orders": [
      {
        id: "ord_01J8X2K3",
        placed_at: "2026-08-09T18:22:00.000Z",
        store: "Dublin Camden Street",
        total: 21.4,
        currency: "EUR",
      },
    ],
    "https://pizza42.com/customer_profile": {
      customer_segment: "Returning Regular",
      order_count: 7,
      favourite_item: "Margherita",
      favourite_store: "Dublin Camden Street",
      average_order_value: 21.4,
    },
  },
  loginWithRedirect() {},
  logout() {},
  async getAccessTokenSilently() {
    return "local-preview-token";
  },
  async refreshVerification() {
    return true;
  },
};

const api = {
  async getMenu() {
    return menu;
  },
  async createOrder() {
    return { id: "ord_preview", total: 14.5, currency: "EUR" };
  },
  async identifyCustomer() {
    return {
      type: "identify",
      userId: "auth0|preview-customer",
      traits: auth.idTokenClaims["https://pizza42.com/customer_profile"],
      context: { source: "pizza42-poc" },
      timestamp: "2026-08-15T19:42:00.000Z",
    };
  },
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Pizza42App auth={auth} api={api} />
  </StrictMode>,
);
