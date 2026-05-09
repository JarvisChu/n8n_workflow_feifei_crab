var html_template = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>每日销售发票</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Arial', sans-serif;
        background-color: #ffffff;
        color: #333;
        line-height: 1.4;
      }

      .invoice-container {
        max-width: 800px;
        margin: 20px auto;
        padding: 30px;
        background: white;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      }

      /* 顶部标题区域 */
      .invoice-header {
        text-align: center;
        margin-bottom: 30px;
      }

      .invoice-title {
        font-size: 28px;
        font-weight: bold;
        color: #2c3e50;
        margin-bottom: 5px;
      }

      .invoice-subtitle {
        font-size: 14px;
        color: #7f8c8d;
      }

      .invoice-info {
        text-align: center;
        font-size: 14px;
        color: #34495e;
        font-weight: bold;
        margin-top: 10px;
      }

      .invoice-info div {
        margin-bottom: 3px;
      }

      /* 销售项目表格 */
      .sales-section {
        margin-bottom: 40px;
      }

      .sales-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }

      .sales-table th {
        background-color: #f8f9fa;
        color: #6c757d;
        font-size: 12px;
        font-weight: 500;
        padding: 12px 8px;
        text-align: left;
        border-bottom: 1px solid #dee2e6;
      }

      .sales-table td {
        padding: 12px 8px;
        border-bottom: 1px solid #e9ecef;
        font-size: 14px;
      }

      .sales-table tr:last-child td {
        border-bottom: none;
      }

      /* 销售汇总 */
      .sales-summary {
        display: flex;
        justify-content: flex-end;
        margin-top: 20px;
      }

      .summary-box {
        background-color: #f8f9fa;
        padding: 15px 20px;
        border-radius: 4px;
        min-width: 200px;
      }

      .summary-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 14px;
      }

      .summary-item:last-child {
        margin-bottom: 0;
        font-weight: bold;
        font-size: 16px;
        padding-top: 8px;
        border-top: 1px solid #dee2e6;
      }

      .summary-label {
        color: #6c757d;
      }

      .summary-value {
        color: #2c3e50;
        font-weight: 500;
      }

      /* 分隔线 */
      .divider {
        height: 1px;
        background-color: #dee2e6;
        margin: 30px 0;
      }

      /* 支付汇总区域 */
      .payment-section {
        margin-top: 30px;
      }

      .payment-header {
        margin-bottom: 20px;
      }

      .payment-title {
        font-size: 24px;
        font-weight: bold;
        color: #2c3e50;
        margin-bottom: 5px;
      }

      .payment-subtitle {
        font-size: 14px;
        color: #7f8c8d;
      }

      .payment-stats {
        display: flex;
        gap: 20px;
      }

      .stat-box {
        background-color: #f8f9fa;
        padding: 12px 16px;
        border-radius: 4px;
        text-align: center;
        min-width: 120px;
      }

      .stat-label {
        font-size: 12px;
        color: #6c757d;
        margin-bottom: 4px;
      }

      .stat-value {
        font-size: 16px;
        font-weight: bold;
        color: #2c3e50;
      }

      /* 支付方式表格 */
      .payment-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }

      .payment-table th {
        background-color: #f8f9fa;
        color: #6c757d;
        font-size: 12px;
        font-weight: 500;
        padding: 12px 8px;
        text-align: left;
        border-bottom: 1px solid #dee2e6;
      }

      .payment-table td {
        padding: 12px 8px;
        border-bottom: 1px solid #e9ecef;
        font-size: 14px;
      }

      .payment-table tr:last-child td {
        border-bottom: none;
        font-weight: bold;
        background-color: #f8f9fa;
      }

      /* 时间时段汇总样式 */
      .time-slot-section {
        margin-top: 30px;
      }

      .time-slot-header {
        margin-bottom: 20px;
      }

      .time-slot-title {
        font-size: 24px;
        font-weight: bold;
        color: #2c3e50;
        margin-bottom: 5px;
      }

      .time-slot-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }

      .time-slot-table th {
        background-color: #f8f9fa;
        color: #6c757d;
        font-size: 12px;
        font-weight: 500;
        padding: 12px 8px;
        text-align: left;
        border-bottom: 1px solid #dee2e6;
      }

      .time-slot-table td {
        padding: 12px 8px;
        border-bottom: 1px solid #e9ecef;
        font-size: 14px;
      }

      .time-slot-table tr:last-child td {
        border-bottom: none;
        font-weight: bold;
        background-color: #f8f9fa;
      }

      /* 响应式设计 */
      @media (max-width: 768px) {
        .invoice-container {
          margin: 10px;
          padding: 20px;
        }

        .sales-summary {
          justify-content: flex-start;
        }

        .payment-stats {
          flex-direction: column;
          gap: 10px;
        }
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      <!-- 顶部标题区域 -->
      <div class="invoice-header">
        <div class="invoice-title">Daily Sales Summary</div>
        <div class="invoice-info">
          <div>BILL TO: {{bill_to}}</div>
          <div>Invoice ID: {{invoice_id}}</div>
          <div>Invoice Date: {{invoice_date}}</div>
          <!--<div>Store ID: {{store_id}}</div>-->
        </div>
      </div>

      <!-- 销售项目区域 -->
      <div class="sales-section">
        <table class="sales-table">
          <thead>
            <tr>
              <th>ITEM</th>
              <th>PRICE</th>
              <th>QTY</th>
              <!--<th>TAX RATE</th>-->
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {{product_item_list}}
          </tbody>
        </table>

        <!-- 销售汇总 -->
        <div class="sales-summary">
          <div class="summary-box">
            <!--<div class="summary-item">
              <span class="summary-label">Total Transactions:</span>
              <span class="summary-value">{{total_transactions}}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Total TAX:</span>
              <span class="summary-value">{{total_tax}}</span>
            </div>-->
            <div class="summary-item">
              <span class="summary-label">Grand Total:</span>
              <span class="summary-value">{{grand_total}}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="divider"></div>

      <!-- 支付汇总区域 -->
      <div class="payment-section">
        <div class="payment-header">
          <div>
            <div class="payment-title">Payment Summary</div>
          </div>
        </div>

        <table class="payment-table">
          <thead>
            <tr>
              <th>PAYMENT TYPE</th>
              <th>TRANSACTIONS</th>
              <th>TOTAL AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {{payment_list}}
            <tr>
              <td>TOTAL PAYMENTS</td>
              <td>{{total_payment_count}}</td>
              <td>{{total_payment_amount}}</td>
            </tr>
          </tbody>
        </table>
        
      </div>
    </div>
  </body>
</html>
`;

for (const item of $input.all()) {
  // 使用实际的数据，替代 HTML 模板中的占位符
  html_template = html_template.replace('{{bill_to}}', item.json.invoices.bill_to);
  html_template = html_template.replace('{{invoice_id}}', item.json.invoices.id);
  html_template = html_template.replace('{{invoice_date}}', item.json.invoices.date);
  //html_template = html_template.replace('{{store_id}}', item.json.invoice.store_id.toString())

  var product_item_html = '';
  for (const product_item of item.json.invoices.product_item_list) {
    if (product_item.total == 0) continue;
    product_item_html += `<tr>
              <td>${product_item.name}</td>
              <td>${product_item.price}</td>
              <td>${product_item.qty}</td>
              <!--<td>${product_item.tax_rate_str}</td>-->
              <td>${product_item.total}</td>
            </tr>`;
  }
  html_template = html_template.replace('{{product_item_list}}', product_item_html);
  html_template = html_template.replace(
    '{{total_transactions}}',
    item.json.invoices.total_transactions.toString()
  );
  html_template = html_template.replace('{{total_tax}}', item.json.invoices.total_tax.toString());
  html_template = html_template.replace(
    '{{grand_total}}',
    item.json.invoices.grand_total.toString()
  );

  var payment_list_html = '';
  for (const payment of item.json.invoices.payment_list) {
    payment_list_html += `<tr>
              <td>${payment.pay_type}</td>
              <td>${payment.transactions}</td>
              <td>${payment.total}</td>
            </tr>`;
  }
  html_template = html_template.replace('{{payment_list}}', payment_list_html);
  html_template = html_template.replace('{{total_payment_count}}', '');
  html_template = html_template.replace(
    '{{total_payment_amount}}',
    item.json.invoices.total_payment.toString()
  );

  item.json.html_template = html_template;
}

// return {
//   html_template: $input.first().json.html_template
// }

return $input.all();
