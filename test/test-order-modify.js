#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

// Test the order modification endpoint
async function testOrderModification() {
  try {
    console.log('Testing Order Modification Endpoint...\n');

    // First, let's get an existing order to modify
    console.log('1. Getting existing orders...');
    const ordersResponse = await axios.get(`${BASE_URL}/orders?limit=1`);
    console.log('Orders response status:', ordersResponse.status);

    if (ordersResponse.data.data && ordersResponse.data.data.length > 0) {
      const order = ordersResponse.data.data[0];
      console.log('Found order:', order.id, 'Customer:', order.customerId);

      // Test the modify endpoint
      console.log('\n2. Testing order modification...');
      const modifyData = {
        originalOrderId: order.id,
        newOrderItems: [
          {
            name: '10x Package',
            quantity: 1,
            price: 15000,
          },
        ],
        refundReason: 'customer_request',
        reasonDetails: 'Customer wanted 10x package instead of current package',
      };

      try {
        const modifyResponse = await axios.post(
          `${BASE_URL}/orders/modify`,
          modifyData,
        );
        console.log('Modify response status:', modifyResponse.status);
        console.log(
          'Modify response data:',
          JSON.stringify(modifyResponse.data, null, 2),
        );
      } catch (modifyError) {
        console.log(
          'Modify error:',
          modifyError.response?.status,
          modifyError.response?.data,
        );
      }
    } else {
      console.log('No orders found to modify');
    }
  } catch (error) {
    console.error(
      'Test error:',
      error.response?.status,
      error.response?.data || error.message,
    );
  }
}

// Run the test
testOrderModification();
