// WooCommerce Order Interfaces

export interface IWooCommerceOrder {
  payment_method: string; // e.g., "bacs", "cheque", "cod", "paypal"
  payment_method_title?: string; // e.g., "Direct Bank Transfer"
  set_paid?: boolean; // true if already paid

  billing: IWooCommerceAddress; // required billing details
  shipping?: IWooCommerceAddress; // optional shipping details

  lineItems: IWooCommerceLineItem[]; // products added to order
  shippingLines?: IWooCommerceShippingLine[]; // shipping methods

  customerId?: number; // WP user ID (optional if guest)
  customerNote?: string; // any note attached
  transactionId?: string; // for payment gateway tracking
  couponLines?: IWooCommerceCouponLine[]; // applied coupons
  feeLines?: IWooCommerceFeeLine[]; // custom fees
  metaData?: IWooCommerceMetaData[]; // custom metadata
}

export interface WooCommerceOrderResponse {
  id: number;
  parent_id: number;
  number: string;
  order_key: string;
  created_via: string;
  version: string;
  status: string; // e.g., "processing", "completed"
  currency: string;

  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;

  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;

  prices_include_tax: boolean;

  customer_id: number;
  customer_ip_address: string;
  customer_user_agent: string;
  customer_note: string;

  billing: WooCommerceAddress;
  shipping: WooCommerceAddress;

  payment_method: string;
  payment_method_title: string;
  transaction_id: string;

  date_paid?: string | null;
  date_paid_gmt?: string | null;
  date_completed?: string | null;
  date_completed_gmt?: string | null;

  cart_hash: string;

  meta_data: WooCommerceResponseMetaData[];

  line_items: WooCommerceResponseLineItem[];
  tax_lines: WooCommerceTaxLine[];
  shipping_lines: WooCommerceResponseShippingLine[];
  fee_lines: WooCommerceFeeLine[];
  coupon_lines: WooCommerceCouponLine[];
  refunds: WooCommerceRefund[];

  _links: WooCommerceLinks;
}

export interface WooCommerceResponseLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  tax_class: string;
  subtotal: string;
  subtotal_tax: string;
  total: string;
  total_tax: string;
  taxes: WooCommerceTax[];
  meta_data: WooCommerceResponseMetaData[];
  sku: string;
  price: number;
}

export interface WooCommerceResponseShippingLine {
  id: number;
  method_title: string;
  method_id: string;
  total: string;
  total_tax: string;
  taxes: WooCommerceTax[];
  meta_data: WooCommerceResponseMetaData[];
}

export interface WooCommerceTaxLine {
  id: number;
  rate_code: string;
  rate_id: number;
  label: string;
  compound: boolean;
  tax_total: string;
  shipping_tax_total: string;
  meta_data: WooCommerceResponseMetaData[];
}

export interface WooCommerceResponseMetaData {
  id: number;
  key: string;
  value: any;
}

export interface WooCommerceTax {
  id: number;
  total: string;
  subtotal: string;
}

export interface WooCommerceRefund {
  id: number;
  reason?: string;
  total: string;
}

export interface WooCommerceLinks {
  self: { href: string }[];
  collection: { href: string }[];
}

// Reusable sub-types

export interface WooCommerceAddress {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface WooCommerceLineItem {
  product_id: number; // WooCommerce product ID
  variation_id?: number;
  quantity: number;
  total?: string; // optional, WooCommerce can calculate
  subtotal?: string;
  meta_data?: WooCommerceMetaData[];
}

export interface WooCommerceShippingLine {
  method_id: string; // e.g., "flat_rate"
  method_title: string; // e.g., "Flat Rate"
  total: string; // shipping cost
}

export interface WooCommerceCouponLine {
  code: string; // coupon code
  discount?: string;
  discount_tax?: string;
}

export interface WooCommerceFeeLine {
  name: string; // fee name
  total: string;
  tax_class?: string;
  tax_status?: string;
}

export interface WooCommerceMetaData {
  key: string;
  value: any;
}
