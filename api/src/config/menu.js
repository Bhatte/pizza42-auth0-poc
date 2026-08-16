export const stores = Object.freeze([
  "Dublin Camden Street",
  "Dublin Rathmines",
  "Dublin Smithfield",
]);

export const menu = Object.freeze({
  "PIZ-MARG-L": Object.freeze({
    sku: "PIZ-MARG-L",
    name: "Margherita",
    description: "Tomato, mozzarella and basil",
    size: "Large",
    price: 14.5,
    category: "pizza",
  }),
  "PIZ-VEG-L": Object.freeze({
    sku: "PIZ-VEG-L",
    name: "Garden Veg",
    description: "Roasted peppers, mushroom, red onion and mozzarella",
    size: "Large",
    price: 15.5,
    category: "pizza",
  }),
  "SID-GARL": Object.freeze({
    sku: "SID-GARL",
    name: "Garlic Bread",
    description: "Baked with garlic butter and parsley",
    price: 4.5,
    category: "side",
  }),
});

export function getPublicMenu() {
  return {
    currency: "EUR",
    stores: [...stores],
    items: Object.values(menu),
  };
}
