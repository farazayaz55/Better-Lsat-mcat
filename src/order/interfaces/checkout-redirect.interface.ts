export interface RedirectUrls {
  success: string;
  cancel: string;
}

export interface CheckoutRedirectConfig {
  baseUrl: string;
  successPath: string;
  cancelPath: string;
  includeOrderId?: boolean;
  includeSessionId?: boolean;
}
