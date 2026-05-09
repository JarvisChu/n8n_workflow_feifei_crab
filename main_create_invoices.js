const fs = require('fs');
const path = require('path');

// 输入文件：默认 data_input.json
const inputFile = process.argv[2] || 'data_input.json';
// 输出文件：处理后的 invoices 结果
const outputFile = process.argv[3] || 'data_output.json';

const rawData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// 清理 item 上的多余字段：仅保留以下允许字段
// （n8n 实际运行时上游 parse_request 节点已经只产出这些字段，本地测试需要主动清理）
const ALLOWED_ITEM_FIELDS = [
  'headers',
  'params',
  'query',
  'body',
  'webhookUrl',
  'executionMode',
  'request_user_id',
  'request_organization_id',
  'request_file_list',
  'request_error_message'
];
for (const item of rawData) {
  for (const key of Object.keys(item)) {
    if (!ALLOWED_ITEM_FIELDS.includes(key)) delete item[key];
  }
}

// 模拟 n8n Code 节点的 $input
function makeInput(data) {
  return {
    all: () => data.map((d) => ({ json: d })),
    first: () => ({ json: data[0] })
  };
}

function runNode(filename, data) {
  const code = fs.readFileSync(filename, 'utf8');
  const fn = new Function('$input', code);
  const result = fn(makeInput(data));
  for (let i = 0; i < result.length; i++) {
    data[i] = result[i].json;
  }
}

runNode(path.join(__dirname, 'n8n_node_create_invoices.js'), rawData);

fs.writeFileSync(outputFile, JSON.stringify(rawData, null, 2), 'utf8');

// 摘要打印
console.log('输入文件:', inputFile);
console.log('输出文件:', outputFile);

let allMatch = true;
for (let i = 0; i < rawData.length; i++) {
  const r = rawData[i];
  console.log(`\n--- item[${i}] ---`);
  console.log('  request_error_message:', r.request_error_message || '(空)');
  if (!r.invoices) continue;
  for (const inv of r.invoices) {
    if (!inv.total_match) allMatch = false;
    console.log(`\n  [Invoice] ${inv.id}  (${inv.bill_to}, date=${inv.date})`);
    console.log('    items_total:  ', inv.items_total);
    console.log('    total_tax:    ', inv.total_tax);
    console.log('    grand_total:  ', inv.grand_total);
    console.log('    total_payment:', inv.total_payment);
    console.log('    total_diff:   ', inv.total_diff, '| match:', inv.total_match);
    console.log('    --- product_item_list ---');
    for (const p of inv.product_item_list) {
      console.log(`      ${pad(p.name, 28)} ${pad(p.total, 12)} ${p.tax_rate_str}`);
    }
    console.log(`      ${pad('items_total (合计)', 28)} ${pad(inv.items_total, 12)}`);
    console.log(`      ${pad('+ total_tax', 28)} ${pad(inv.total_tax, 12)}`);
    console.log(`      ${pad('= grand_total', 28)} ${pad(inv.grand_total, 12)}`);

    console.log('    --- payment_list ---');
    for (const p of inv.payment_list) {
      console.log(`      ${pad(p.pay_type, 28)} ${pad(p.total, 12)}`);
    }
    console.log(`      ${pad('total_payment (合计)', 28)} ${pad(inv.total_payment, 12)}`);
  }
}

// 总览：所有 invoice 的金额是否都对得上
console.log('\n========================================');
console.log(allMatch ? '✓ 所有 invoice 金额匹配' : '✗ 存在金额不匹配的 invoice');
console.log('========================================');

function pad(v, n) {
  const s = String(v);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
