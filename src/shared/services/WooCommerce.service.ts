import { Injectable } from '@nestjs/common';
import axios from 'axios';

import {
  IWooCommerceOrder,
  IWooCommerceOrderResponse,
} from './interfaces/woocommerce.order.interface';

@Injectable()
export class WooCommerceService {
  private baseUrl = 'https://betterlsat.com/wp-json/wc/v3';
  private consumerKey = process.env.WOO_CONSUMER_KEY;
  private consumerSecret = process.env.WOO_CONSUMER_SECRET;

  async createOrder(
    orderData: IWooCommerceOrder,
  ): Promise<IWooCommerceOrderResponse> {
    const response = await axios.post(`${this.baseUrl}/orders`, orderData, {
      auth: {
        username: this.consumerKey ?? '',
        password: this.consumerSecret ?? '',
      },
    });
    return response.data;
  }

  async getOrders(): Promise<IWooCommerceOrderResponse[]> {
    const response = await axios.get(
      `${this.baseUrl}/orders?status=processing`,
      {
        auth: {
          username: this.consumerKey ?? '',
          password: this.consumerSecret ?? '',
        },
      },
    );
    return response.data;
  }
}
