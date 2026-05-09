// 将 "31/07/2025" 格式的日期，格式化成 "20250731"
function formatInvoiceDate(str) {
  const [day, month, year] = str.split('/');

  return year + month.padStart(2, '0') + day.padStart(2, '0');
}

// 忽略大小写，比较两个字符串是否相等
function equalsIgnoreCaseSafe(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
}

// 转换为保留 fixed 位小数的 Number 类型
function toFixedNumber(num, fixed) {
  return Number(Number(num).toFixed(fixed));
}

// --------------------------------------------------
// 主处理流程
// --------------------------------------------------
for (const item of $input.all()) {
  // 1. 将每个 invoice 中的 'TOUCH N GO' 项复制出来
  for (const inv of item.json.invoices) {
    inv.original_touch_n_go_amount = 0;
    for (const payment of inv.payment_list) {
      if (payment.pay_type == 'TOUCH N GO') {
        inv.original_touch_n_go_amount = payment.total; // 复制出来
        payment.total = 0; // 重置
      }
    }
  }

  // 2. report 中的记录，汇总到 invoices.payment_list 中的 'TOUCH N GO' 中
  for (const record of item.json.report_records) {
    // 查找对应的 invoice，将 report 中的记录汇总到该 invoice 中
    for (const inv of item.json.invoices) {
      // 比较 shop 名字，找到对应的 inv
      if (!equalsIgnoreCaseSafe(inv.bill_to, record.shop)) continue; // 不相同，跳过

      // 比较 date，判断是否是同一个月的
      if (record.date.slice(0, 6) != inv.date_yymmdd.slice(0, 6)) continue; // 前六位不等，即月份不相同，跳过

      // 找到 'TOUCH N GO'，汇总到该项中
      for (const payment of inv.payment_list) {
        if (payment.pay_type == 'TOUCH N GO') {
          payment.total = toFixedNumber(payment.total + record.transaction_amount, 2);
          break;
        }
      }
    }
  }

  // 3.计算每个 invoice 中 'TOUCH N GO' 的原始值和新值，
  // 将差额放到名为 'Delivery fee(cus paid)' 的 product_item 中
  for (const inv of item.json.invoices) {
    var cur_touch_n_go_amount = 0;
    for (const payment of inv.payment_list) {
      if (payment.pay_type == 'TOUCH N GO') {
        cur_touch_n_go_amount = payment.total;
      }
    }

    // delivery_fee = cur - old
    var delivery_fee = toFixedNumber(cur_touch_n_go_amount - inv.original_touch_n_go_amount, 2);

    if (delivery_fee != 0) {
      inv.product_item_list.push({
        name: 'Delivery fee(cus paid)',
        total: delivery_fee,
        qty: 1,
        price: delivery_fee,
        tax_rate_str: ''
      });
    }
  }

  // 4. 重新计算每张 invoice 的total 信息
  for (const inv of item.json.invoices) {
    // inv.grand_total
    inv.grand_total = 0;
    for (const product of inv.product_item_list) {
      inv.grand_total = toFixedNumber(inv.grand_total + product.total, 2);
    }
    inv.total_tax = 0;

    // inv.total_transactions/inv.total_payment
    inv.total_transactions = 0;
    inv.total_payment = 0;
    for (const payment of inv.payment_list) {
      inv.total_transactions += payment.transactions;
      inv.total_payment = toFixedNumber(inv.total_payment + payment.total, 2);
    }
  }
}

return $input.all();
