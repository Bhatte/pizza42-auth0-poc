export const API_AUDIENCE = "https://api.pizza42.com";
export const CLAIM_NAMESPACE = "https://pizza42.com/";

export const CLAIMS = Object.freeze({
  emailVerified: `${CLAIM_NAMESPACE}email_verified`,
  orders: `${CLAIM_NAMESPACE}orders`,
  customerProfile: `${CLAIM_NAMESPACE}customer_profile`,
});
