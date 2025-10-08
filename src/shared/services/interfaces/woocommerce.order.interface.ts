// WooCommerce Order Interfaces

export interface IWooCommerceOrder {
  payment_method: string; // e.g., "bacs", "cheque", "cod", "paypal"
  payment_method_title?: string; // e.g., "Direct Bank Transfer"
  set_paid?: boolean; // true if already paid

  billing: IWooCommerceAddress; // required billing details
  shipping?: IWooCommerceAddress; // optional shipping details

  line_items: IWooCommerceLineItem[]; // products added to order
  shipping_lines?: IWooCommerceShippingLine[]; // shipping methods

  customer_id?: number; // WP user ID (optional if guest)
  customer_note?: string; // any note attached
  transactionId?: string; // for payment gateway tracking
  couponLines?: IWooCommerceCouponLine[]; // applied coupons
  feeLines?: IWooCommerceFeeLine[]; // custom fees
  metaData?: IWooCommerceMetaData[]; // custom metadata
}

export interface IWooCommerceOrderResponse {
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

  billing: IWooCommerceAddress;
  shipping: IWooCommerceAddress;

  payment_method: string;
  payment_method_title: string;
  transaction_id: string;

  date_paid?: string | null;
  date_paid_gmt?: string | null;
  date_completed?: string | null;
  date_completed_gmt?: string | null;

  cart_hash: string;

  meta_data: IWooCommerceResponseMetaData[];

  line_items: IWooCommerceResponseLineItem[];
  tax_lines: IWooCommerceTaxLine[];
  shipping_lines: IWooCommerceResponseShippingLine[];
  fee_lines: IWooCommerceFeeLine[];
  coupon_lines: IWooCommerceCouponLine[];
  refunds: IWooCommerceRefund[];

  _links: IWooCommerceLinks;
}

export interface IWooCommerceResponseLineItem {
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
  taxes: IWooCommerceTax[];
  meta_data: IWooCommerceResponseMetaData[];
  sku: string;
  price: number;
}

export interface IWooCommerceResponseShippingLine {
  id: number;
  method_title: string;
  method_id: string;
  total: string;
  total_tax: string;
  taxes: IWooCommerceTax[];
  meta_data: IWooCommerceResponseMetaData[];
}

export interface IWooCommerceTaxLine {
  id: number;
  rate_code: string;
  rate_id: number;
  label: string;
  compound: boolean;
  tax_total: string;
  shipping_tax_total: string;
  meta_data: IWooCommerceResponseMetaData[];
}

export interface IWooCommerceResponseMetaData {
  id: number;
  key: string;
  value: any;
}

export interface IWooCommerceTax {
  id: number;
  total: string;
  subtotal: string;
}

export interface IWooCommerceRefund {
  id: number;
  reason?: string;
  total: string;
}

export interface IWooCommerceLinks {
  self: { href: string }[];
  collection: { href: string }[];
}

// Reusable sub-types

export interface IWooCommerceAddress {
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

export interface IWooCommerceLineItem {
  product_id: number; // WooCommerce product ID
  variation_id?: number;
  quantity: number;
  total?: string; // optional, WooCommerce can calculate
  subtotal?: string;
  meta_data?: IWooCommerceMetaData[];
}

export interface IWooCommerceShippingLine {
  method_id: string; // e.g., "flat_rate"
  method_title: string; // e.g., "Flat Rate"
  total: string; // shipping cost
}

export interface IWooCommerceCouponLine {
  code: string; // coupon code
  discount?: string;
  discount_tax?: string;
}

export interface IWooCommerceFeeLine {
  name: string; // fee name
  total: string;
  tax_class?: string;
  tax_status?: string;
}

export interface IWooCommerceMetaData {
  key: string;
  value: any;
}
