// =============================================================
// 公共工具函数
// =============================================================

function isNullOrUndefined(value) {
  return value === null || value === undefined;
}

function isValidString(value) {
  return !isNullOrUndefined(value) && typeof value === 'string';
}

function isValidNotEmptyString(value) {
  return isValidString(value) && value.trim() !== '';
}

// 判断字符串是否能转成有效的数字（空字符串、null、undefined 都视为非数字）
// 注意：原生 Number('') === 0、Number(null) === 0、Number('  ') === 0 都不是 NaN，
// 这里显式排除掉，避免把空白当 0 处理
function isNumber(str) {
  if (str === null || str === undefined) return false;
  if (typeof str === 'string' && str.trim() === '') return false;
  return !Number.isNaN(Number(str));
}

// 转换为保留 fixed 位小数的 Number 类型
function toFixedNumber(num, fixed) {
  return Number(Number(num).toFixed(fixed));
}

// 忽略大小写比较两个字符串是否相等（仅对 ASCII 即可，无需 localeCompare）
function equalsIgnoreCase(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return a.toLowerCase() === b.toLowerCase();
}

// parseInvoiceDate 从 "Date: 01/07/2025 - 31/07/2025" 中获取 "31/07/2025" 对应的日期
function parseInvoiceDate(str) {
  if (typeof str !== 'string') return null;

  // 去掉多余空格
  const s = str.trim();

  // 必须以 Date: 开头
  if (!s.startsWith('Date:')) return null;

  // 拆 Date: 和内容
  const content = s.slice(5).trim();

  // 拆 start - end（允许多空格）
  const dashIndex = content.indexOf('-');
  if (dashIndex === -1) return null;

  const endStr = content.slice(dashIndex + 1).trim();

  // endStr 必须是 DD/MM/YYYY
  const parts = endStr.split('/');
  if (parts.length !== 3) return null;

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);

  if (!day || !month || !year) return null;

  const date = new Date(year, month - 1, day);

  // 校验合法日期
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

// formatDateDDMMYYYY 将日期转换为 DD/MM/YYYY 这种格式的字符串
function formatDateDDMMYYYY(date) {
  if (!(date instanceof Date) || isNaN(date)) return null;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// formatDateYYYYMMDD 将日期转换为 YYYYMMDD 这种格式的字符串
function formatDateYYYYMMDD(date) {
  if (!(date instanceof Date) || isNaN(date)) return null;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${year}${month}${day}`;
}

// 门店配置：新增门店时，在这里加一行即可
//   - id       ：内部使用的门店标识（也是 invoice.bill_to 的取值）
//   - keywords ：识别该门店的关键词，全部小写；任一关键词命中（substring 匹配）即视为该门店
const MERCHANTS = [
  { id: 'Austin', keywords: ['austin'] },
  { id: 'Sutera', keywords: ['sutera'] },
  { id: 'EcoBotanic', keywords: ['eco botanic', 'ecobotanic'] }
];

// 把所有 MERCHANTS 的 id 拼成 "Austin or Sutera or EcoBotanic"，用于错误提示
const MERCHANT_IDS_STR = MERCHANTS.map((m) => m.id).join(' or ');

// 根据任意若干个原始字符串（merchant 行 / shop name / shop location 等）匹配门店
// 返回 'Austin' / 'Sutera' / 'EcoBotanic' / ''；任一字符串包含任一 keyword 即命中
function matchMerchant(...rawTexts) {
  const lowers = rawTexts.map((s) => (s ?? '').toString().toLowerCase());
  for (const m of MERCHANTS) {
    if (m.keywords.some((kw) => lowers.some((s) => s.includes(kw)))) return m.id;
  }
  return '';
}

// 将 TransactionDate 转换为 "YYYYMMDD" 的格式
// 支持:
//  "7/1/25 14:41"        -> 20250701  # 2025年7月1日
//  "01/09/2025 13:50:12" -> 20250901  # 2025年9月1日
function parseTransactionDate(str) {
  if (typeof str !== 'string') return '';

  str = str.trim();
  if (!str) return '';

  const datePart = str.split(' ')[0];
  const parts = datePart.split('/');

  if (parts.length !== 3) return '';

  let [a, b, c] = parts;

  let day, month, year;

  // 判断年份位数
  if (c.length === 2) {
    // 格式: MM/DD/YY
    month = parseInt(a, 10);
    day = parseInt(b, 10);
    year = parseInt(c, 10) + 2000;
  } else if (c.length === 4) {
    // 格式: DD/MM/YYYY
    day = parseInt(a, 10);
    month = parseInt(b, 10);
    year = parseInt(c, 10);
  } else {
    return '';
  }

  if (isNaN(day) || isNaN(month) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');

  return `${year}${mm}${dd}`;
}

// =============================================================
// 通用：找 Header Row
// =============================================================

// findHeaderRow 找到同时包含 required_columns 中所有列名的行，作为 header row
// 返回 { row_index, columns: { 列名: 列号 } }；未找到返回 null
// 例如：findHeaderRow(rows, ['Time', 'Nett']) 会找第一行同时含 'Time' 和 'Nett' 的行
function findHeaderRow(rows, required_columns, start_index) {
  if (!Array.isArray(rows)) return null;
  const start = start_index || 0;
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    // 找到每个必须列在该行中的列号（比较时去掉两端空格）
    const cols = {};
    let allFound = true;
    for (const name of required_columns) {
      let col_index = -1;
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (typeof cell === 'string' && cell.trim() === name) {
          col_index = j;
          break;
        }
      }
      if (col_index < 0) {
        allFound = false; // 有任意列没找到 → 不是 header
        break;
      }
      cols[name] = col_index;
    }
    if (allFound) return { row_index: i, columns: cols };
  }

  return null;
}

// =============================================================
// 处理 feedme excel → invoices（每张表生成一个 invoice）
// =============================================================

// findFeedmeSummaryRow 找到 汇总行，返回该行的 index
function findFeedmeSummaryRow(rows, start_index) {
  for (let i = start_index; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;
    if (typeof row[0] === 'string' && row[0].trim() === '') return i; // 首次出现第一列是空
  }
  return -1;
}

function processFeedmeFile(file) {
  // 校验 sheets/rows 结构
  if (
    !Array.isArray(file?.data?.sheets) ||
    file.data.sheets.length === 0 ||
    !Array.isArray(file.data.sheets[0]?.rows)
  ) {
    return { error: file.name + ', no data' };
  }
  const rows = file.data.sheets[0].rows;

  // 从第二行，读取日期信息
  // 从 "Date: 01/07/2025 - 31/07/2025" 中获取 "31/07/2025"
  if (rows.length < 2) {
    return { error: file.name + " invalid, missing 'Date' row" };
  }
  const secondRow = rows[1];
  if (!Array.isArray(secondRow) || secondRow.length < 1) {
    return { error: file.name + " invalid, missing 'Date' information at second row" };
  }
  const date = parseInvoiceDate(secondRow[0]);
  if (!date) {
    return { error: file.name + " invalid 'Date' information at second row" };
  }
  const date_yymmdd = formatDateYYYYMMDD(date);

  // 从第四行，读取门店信息
  if (rows.length < 4) {
    return { error: file.name + " invalid, missing 'Merchant' row" };
  }
  const fourthRow = rows[3];
  if (!Array.isArray(fourthRow) || fourthRow.length < 1) {
    return { error: file.name + " invalid, missing 'Merchant' information at fourth row" };
  }
  const merchant = matchMerchant(fourthRow[0]);
  if (!merchant) {
    return {
      error: `${file.name} invalid, unknown 'Merchant' at fourth row, expect: ${MERCHANT_IDS_STR}`
    };
  }

  const invoice = {
    file_id: file.id,
    file_name: file.name,
    date: formatDateDDMMYYYY(date), // DD/MM/YYYY 格式
    date_yymmdd, // YYYYMMDD 格式
    bill_to: merchant,
    id: merchant + '_' + date_yymmdd,
    product_item_list: [],
    payment_list: [],

    // 最终的总税额，由 applyProductSalesToInvoice 用 computed_tax 写入
    total_tax: 0,

    // feedme summary 行的 SST / Gross / Discount / SC / Rounding 列汇总值，
    // 临时存放在 invoice 上（不进 product_item_list），
    // 给后续 applyProductSalesToInvoice 计算 Rounding/Tax Rounding 使用
    feedme_sst: 0,
    feedme_gross: 0,
    feedme_discount: 0,
    feedme_sc: 0,
    feedme_rounding: 0
  };

  // 找到 Header Row（从第5行 index=4 开始找）
  // feedme header 必须同时包含 'Time' 和 'Nett'（Nett 之前是 product 列、之后是 payment 列）
  const header = findHeaderRow(rows, ['Time', 'Nett'], 4);
  if (!header) return { error: file.name + " cannot find header row (need 'Time' and 'Nett')" };
  const header_row = rows[header.row_index];
  const nett_col_index = header.columns['Nett'];

  // 找到汇总行（header row 往后，第一次出现 Time 列为空的行）
  const summary_index = findFeedmeSummaryRow(rows, header.row_index + 1);
  if (summary_index < 0) return { error: file.name + ' cannot find summary row' };
  const summary_row = rows[summary_index];

  // 处理行中的每列数据：Nett 之前的列归入 products，之后的归入 payments，Nett 本列忽略
  const ignore_cols = ['', 'name', 'qty', 'pax']; // 忽略这些列
  for (let col_index = 0; col_index < header_row.length; col_index++) {
    if (col_index === nett_col_index) continue; // Nett 列本身忽略

    const col_value = String(header_row[col_index] ?? '').trim();
    if (ignore_cols.includes(col_value.toLowerCase())) continue;

    if (col_index >= summary_row.length) continue; // 没有对应的summary 列，跳过
    const summary_col_value = String(summary_row[col_index] ?? '').trim(); // summary 行对应的列的值
    if (summary_col_value === '' || !isNumber(summary_col_value)) {
      // 没有统计值，或者统计值不是数字，忽略
      continue;
    }

    const num = Number(summary_col_value) || 0;
    const lower = col_value.toLowerCase();

    // SST / Gross / Discount / SC / Rounding 列：临时存到 invoice 上（不进 product_item_list），
    // 留给 applyProductSalesToInvoice 计算 Rounding 和 Tax Rounding
    if (lower === 'sst') {
      invoice.feedme_sst = num;
      continue;
    }
    if (lower === 'gross') {
      invoice.feedme_gross = num;
      continue;
    }
    if (lower === 'discount') {
      invoice.feedme_discount = num;
      continue;
    }
    if (lower === 'sc') {
      invoice.feedme_sc = num;
      continue;
    }
    if (lower === 'rounding') {
      invoice.feedme_rounding = num;
      continue;
    }

    // Nett 列之前的列归入 product_item_list，之后的归入 payment_list
    if (col_index < nett_col_index) {
      invoice.product_item_list.push({
        name: col_value,
        total: num,
        qty: 1,
        price: num,
        tax_rate: 0,
        tax_rate_str: ''
      });
    } else {
      invoice.payment_list.push({
        pay_type: col_value,
        transactions: 1,
        total: num
      });
    }
  }

  return { error: '', invoice };
}

// =============================================================
// 处理 TNG → report_records
// =============================================================

function processTngFile(file) {
  const records = [];
  const rows = file?.data?.sheets?.[0]?.rows;
  if (!Array.isArray(rows)) return { error: file.name + ', no data', records };

  // TNG header 必须同时包含这几列
  const tng_required_cols = [
    'Transaction Datetime',
    'Shop/Outlet Name',
    'Shop/Outlet Location',
    'Transaction Amount (RM)'
  ];
  const header = findHeaderRow(rows, tng_required_cols);
  if (!header) return { error: file.name + ' cannot find TNG header row', records };
  const cols = header.columns;

  // 从 header row 开始，汇总数据
  for (let i = header.row_index + 1; i < rows.length; i++) {
    const row = rows[i];

    // 出现空行或者第一列为空的行，就认为遍历结束了
    if (!Array.isArray(row) || row.length === 0 || row[0] === '') break;

    records.push({
      date: parseTransactionDate(row[cols['Transaction Datetime']]), // 多种原始日期格式统一转换为 YYYYMMDD 格式
      shop: matchMerchant(row[cols['Shop/Outlet Name']], row[cols['Shop/Outlet Location']]), // Austin, Sutera, EcoBotanic
      transaction_amount: Number(row[cols['Transaction Amount (RM)']]) || 0
    });
  }

  return { error: '', records };
}

// =============================================================
// 汇总：将 TNG 记录并入 TOUCH N GO，差额放到 Delivery fee
// （逻辑参考 tmp_n8n_node_process.js）
// =============================================================

// TOUCH N GO 这个支付方式名在不同 feedme 表里可能大小写/空格略有差异，
// 这里用 equalsIgnoreCase 匹配，避免变体导致 TNG 数据静默丢失
const TOUCH_N_GO = 'TOUCH N GO';

function aggregateInvoices(invoices, report_records) {
  // 1. 将每个 invoice 中的 'TOUCH N GO' 项复制出来
  for (const inv of invoices) {
    inv.original_touch_n_go_amount = 0;
    for (const p of inv.payment_list) {
      if (equalsIgnoreCase(p.pay_type, TOUCH_N_GO)) {
        inv.original_touch_n_go_amount = p.total; // 复制出来
        p.total = 0; // 重置
      }
    }
  }

  // 2. report 中的记录，汇总到 invoices.payment_list 中的 'TOUCH N GO' 中
  for (const rec of report_records) {
    // 查找对应的 invoice，将 report 中的记录汇总到该 invoice 中
    for (const inv of invoices) {
      // 比较 shop 名字，找到对应的 inv
      if (!equalsIgnoreCase(inv.bill_to, rec.shop)) continue; // 不相同，跳过

      // 比较 date，判断是否是同一个月的
      if (rec.date.slice(0, 6) !== inv.date_yymmdd.slice(0, 6)) continue; // 前六位不等，即月份不相同，跳过

      // 找到 'TOUCH N GO'，汇总到该项中
      for (const p of inv.payment_list) {
        if (equalsIgnoreCase(p.pay_type, TOUCH_N_GO)) {
          p.total = toFixedNumber(p.total + rec.transaction_amount, 2);
          break;
        }
      }
    }
  }

  // 3. 计算每个 invoice 中 'TOUCH N GO' 的原始值和新值，
  // 将差额放到名为 'Delivery fee(cus paid)' 的 product_item 中
  for (const inv of invoices) {
    let cur = 0;
    for (const p of inv.payment_list) {
      if (equalsIgnoreCase(p.pay_type, TOUCH_N_GO)) cur = p.total;
    }

    // delivery_fee = cur - old
    const delivery_fee = toFixedNumber(cur - inv.original_touch_n_go_amount, 2);

    if (delivery_fee !== 0) {
      inv.product_item_list.push({
        name: 'Delivery fee(cus paid)',
        total: delivery_fee,
        qty: 1,
        price: delivery_fee,
        tax_rate: 0,
        tax_rate_str: 'no tax'
      });
    }
  }
}

// =============================================================
// 处理 product_sales_report：按税率(6%/8%)汇总，替换 Gross/Discount/SC
// =============================================================

// 处理一张 product_sales 表，返回该 merchant 的：
//   - merchant       : 门店标识（Austin / Sutera / EcoBotanic）
//   - yymm           : 数据所属年月（YYYYMM）
//   - summary_items  : 按 6%/8% 税率分组的 6 个汇总项（Non-Alchole/Alchole × Sales/Discount/SC）
//                      每项形如 { tax_rate, tax_rate_str, total }，将由
//                      applyProductSalesToInvoice 写入 invoice.product_item_list
function processProductSalesFile(file) {
  // 校验 sheets/rows 结构
  if (
    !Array.isArray(file?.data?.sheets) ||
    file.data.sheets.length === 0 ||
    !Array.isArray(file.data.sheets[0]?.rows)
  ) {
    return { error: file.name + ', no data' };
  }
  const rows = file.data.sheets[0].rows;

  // 从第二行，读取日期信息
  if (rows.length < 2) {
    return { error: file.name + " invalid, missing 'Date' row" };
  }
  const secondRow = rows[1];
  if (!Array.isArray(secondRow) || secondRow.length < 1) {
    return { error: file.name + " invalid, missing 'Date' information at second row" };
  }
  const date = parseInvoiceDate(secondRow[0]);
  if (!date) {
    return { error: file.name + " invalid 'Date' information at second row" };
  }
  const yymm = formatDateYYYYMMDD(date).slice(0, 6);

  // 从第四行，读取门店信息
  if (rows.length < 4) {
    return { error: file.name + " invalid, missing 'Merchant' row" };
  }
  const fourthRow = rows[3];
  if (!Array.isArray(fourthRow) || fourthRow.length < 1) {
    return { error: file.name + " invalid, missing 'Merchant' information at fourth row" };
  }
  const merchant = matchMerchant(fourthRow[0]);
  if (!merchant) {
    return {
      error: `${file.name} invalid, unknown 'Merchant' at fourth row, expect: ${MERCHANT_IDS_STR}`
    };
  }

  // product_sales header 必须同时包含这几列
  const ps_required_cols = ['Name', 'Gross', 'Bill discount', 'Item discount', 'SST', 'SC'];
  const header = findHeaderRow(rows, ps_required_cols);
  if (!header) return { error: file.name + ' cannot find header row' };
  const cols = header.columns;

  // 直接按需求中要求的 6 个统计项分别累加：
  //   Non-Alchole Sales    6%        Products Sales 表里所有 SST=6% 的项目的 Gross    汇总
  //   Non-Alchole Discount 6%        Products Sales 表里所有 SST=6% 的项目的 Discount 汇总
  //   Non-Alchole SC       no tax    Products Sales 表里所有 SST=6% 的项目的 SC       汇总
  //   Alchole Sales        8%        Products Sales 表里所有 SST=8% 的项目的 Gross    汇总
  //   Alchole Discount     8%        Products Sales 表里所有 SST=8% 的项目的 Discount 汇总
  //   Alchole SC           no tax    Products Sales 表里所有 SST=8% 的项目的 SC       汇总
  const summary_items = {
    'Non-Alchole Sales': { tax_rate: 0.06, tax_rate_str: '6%', total: 0 },
    'Non-Alchole Discount': { tax_rate: 0.06, tax_rate_str: '6%', total: 0 },
    'Non-Alchole SC': { tax_rate: 0, tax_rate_str: 'no tax', total: 0 },
    'Alchole Sales': { tax_rate: 0.08, tax_rate_str: '8%', total: 0 },
    'Alchole Discount': { tax_rate: 0.08, tax_rate_str: '8%', total: 0 },
    'Alchole SC': { tax_rate: 0, tax_rate_str: 'no tax', total: 0 }
  };

  for (let i = header.row_index + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const name = String(row[cols['Name']] ?? '').trim();
    if (name === '') continue; // 跳过 Name 列为空的行（小计/分类汇总行）

    const gross = Number(row[cols['Gross']]) || 0;
    const bill_discount = Number(row[cols['Bill discount']]) || 0;
    const item_discount = Number(row[cols['Item discount']]) || 0;
    const sst = Number(row[cols['SST']]) || 0;
    const sc = Number(row[cols['SC']]) || 0;
    const discount = bill_discount + item_discount;

    if (sst === 0) continue; // SST 为 0 的行忽略
    const net = gross + bill_discount + item_discount;
    if (net === 0) continue; // 避免除以 0

    // 税率 = SST / (Gross + Bill discount + Item discount)
    // 直接转成 "6%" / "8%" 这种百分比字符串再比较，避免浮点 === 的精度隐患
    const tax_rate_pct = Math.round((sst / net) * 100) + '%';

    if (tax_rate_pct === '6%') {
      summary_items['Non-Alchole Sales'].total += gross;
      summary_items['Non-Alchole Discount'].total += discount;
      summary_items['Non-Alchole SC'].total += sc;
    } else if (tax_rate_pct === '8%') {
      summary_items['Alchole Sales'].total += gross;
      summary_items['Alchole Discount'].total += discount;
      summary_items['Alchole SC'].total += sc;
    }
    // 非 6%/8% 的行忽略
  }

  return { error: '', merchant, yymm, summary_items };
}

// 把 product_sales 的 6 个统计项写入 invoice.product_item_list，并追加 Tax Rounding 和 Rounding
// 调用时 Gross/Discount/SC/SST/Rounding 已在 processFeedmeFile 中临时存到 invoice 上（不在列表里），
// 这里只负责追加新项；最后把 computed_tax 写入 invoice.total_tax
function applyProductSalesToInvoice(invoice, summary_items) {
  // 1. 把 summary_items 里的 6 个统计项放到 product_item_list 的最前面（按定义顺序）
  const new_items = [];
  for (const name of Object.keys(summary_items)) {
    const total = toFixedNumber(summary_items[name].total, 2);
    new_items.push({
      name,
      total,
      qty: 1,
      price: total,
      tax_rate: summary_items[name].tax_rate, // 数字，例如 0.06 / 0.08 / 0
      tax_rate_str: summary_items[name].tax_rate_str
    });
  }
  invoice.product_item_list.unshift(...new_items);

  // 2. Tax Rounding：no tax，= feedme 表里的 SST 和 我们按 product_item 算出来的 Tax 的差额
  //    具体计算：invoice.feedme_sst - sum(price * tax_rate) over product_item_list
  //    含义：feedme 原本的 SST 被换成了 computed_tax 当作 total_tax，
  //    为了让 grand_total + total_tax = total_payment 保持不变，
  //    需要在 product_item_list 里补回 feedme_sst - computed_tax
  let computed_tax = 0;
  for (const p of invoice.product_item_list) {
    computed_tax += (p.price || 0) * (p.tax_rate || 0);
  }
  const tax_rounding = toFixedNumber((invoice.feedme_sst || 0) - computed_tax, 2);
  invoice.product_item_list.push({
    name: 'Tax Rounding',
    total: tax_rounding,
    qty: 1,
    price: tax_rounding,
    tax_rate: 0,
    tax_rate_str: 'no tax'
  });

  // 3. Rounding：no tax
  //    = feedme 表里的 Rounding
  //      + (feedme.Gross    - product 里 Sales    之和)
  //      + (feedme.SC       - product 里 SC       之和)
  //      + (feedme.Discount - product 里 Discount 之和)
  const product_gross =
    summary_items['Non-Alchole Sales'].total + summary_items['Alchole Sales'].total;
  const product_discount =
    summary_items['Non-Alchole Discount'].total + summary_items['Alchole Discount'].total;
  const product_sc = summary_items['Non-Alchole SC'].total + summary_items['Alchole SC'].total;
  const rounding = toFixedNumber(
    (invoice.feedme_rounding || 0) +
      ((invoice.feedme_gross || 0) - product_gross) +
      ((invoice.feedme_sc || 0) - product_sc) +
      ((invoice.feedme_discount || 0) - product_discount),
    2
  );
  invoice.product_item_list.push({
    name: 'Rounding',
    total: rounding,
    qty: 1,
    price: rounding,
    tax_rate: 0,
    tax_rate_str: 'no tax'
  });

  // 4. invoice.total_tax 使用我们算出来的 computed_tax，而不是 feedme 表里的 SST
  invoice.total_tax = toFixedNumber(computed_tax, 2);
}

// 重新计算并校验每张 invoice 的总计：
//   - inv.items_total      : product_item_list 求和（不含税）
//   - inv.grand_total      : items_total + total_tax（含税合计，应等于 total_payment）
//   - inv.total_transactions / inv.total_payment : payment_list 笔数 / 求和
//   - inv.total_diff       : grand_total - total_payment（理论上应为 0）
//   - inv.total_match      : total_diff === 0
// （inv.total_tax 已在 applyProductSalesToInvoice 中用 computed_tax 填入，这里不动）
function finalizeInvoiceTotals(invoices) {
  for (const inv of invoices) {
    // inv.items_total = sum(product_item_list)，不含税
    inv.items_total = 0;
    for (const p of inv.product_item_list) {
      inv.items_total = toFixedNumber(inv.items_total + p.total, 2);
    }

    // inv.grand_total = items_total + total_tax，含税合计
    inv.grand_total = toFixedNumber(inv.items_total + inv.total_tax, 2);

    // inv.total_transactions / inv.total_payment
    inv.total_transactions = 0;
    inv.total_payment = 0;
    for (const p of inv.payment_list) {
      inv.total_transactions += p.transactions;
      inv.total_payment = toFixedNumber(inv.total_payment + p.total, 2);
    }

    // 校验 grand_total 是否等于 total_payment（方便人工核对）
    // total_match=true 表示账目对得上；diff 给出具体差额，便于排查
    inv.total_diff = toFixedNumber(inv.grand_total - inv.total_payment, 2);
    inv.total_match = inv.total_diff === 0;
  }
}

// =============================================================
// 为每张 invoice 渲染 HTML 模板（参考 tmp_n8n_node_create_html.js）
// =============================================================

const INVOICE_HTML_TEMPLATE = `<!DOCTYPE html>
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
              <th>TOTAL (BEFORE TAX)</th>
              <th>SST</th>
            </tr>
          </thead>
          <tbody>
            {{product_item_list}}
          </tbody>
        </table>

        <!-- 销售汇总 -->
        <div class="sales-summary">
          <div class="summary-box">
            <div class="summary-item">
              <span class="summary-label">SST:</span>
              <span class="summary-value">{{total_tax}}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Total:</span>
              <span class="summary-value">{{items_total}}</span>
            </div>
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

// 用 invoice 数据填充 INVOICE_HTML_TEMPLATE，返回完整 HTML 字符串
function buildInvoiceHtml(invoice) {
  let html = INVOICE_HTML_TEMPLATE;
  html = html.replaceAll('{{bill_to}}', invoice.bill_to);
  html = html.replaceAll('{{invoice_id}}', invoice.id);
  html = html.replaceAll('{{invoice_date}}', invoice.date);

  // product_item_list：每行一个 <tr>，total=0 的行跳过
  let product_item_html = '';
  for (const p of invoice.product_item_list) {
    if (p.total === 0) continue;
    product_item_html += `<tr>
              <td>${p.name}</td>
              <td>${p.price}</td>
              <td>${p.qty}</td>
              <td>${p.total}</td>
              <td>${p.tax_rate_str}</td>
            </tr>`;
  }
  html = html.replaceAll('{{product_item_list}}', product_item_html);
  html = html.replaceAll('{{total_transactions}}', String(invoice.total_transactions));
  html = html.replaceAll('{{total_tax}}', String(invoice.total_tax));
  html = html.replaceAll('{{items_total}}', String(invoice.items_total));
  html = html.replaceAll('{{grand_total}}', String(invoice.grand_total));

  // payment_list：每行一个 <tr>，total=0 的行跳过
  let payment_list_html = '';
  for (const p of invoice.payment_list) {
    if (p.total === 0) continue;
    payment_list_html += `<tr>
              <td>${p.pay_type}</td>
              <td>${p.transactions}</td>
              <td>${p.total}</td>
            </tr>`;
  }
  html = html.replaceAll('{{payment_list}}', payment_list_html);
  html = html.replaceAll('{{total_payment_count}}', ''); // tmp 模板里也是空字符串
  html = html.replaceAll('{{total_payment_amount}}', String(invoice.total_payment));

  return html;
}

// =============================================================
// 主入口
// =============================================================

for (const item of $input.all()) {
  // 前置：上游 parse_request 节点已校验通过（request_error_message === ''）
  // 且 request_file_list 必须存在
  if (item.json.request_error_message) continue;
  const file_list = item.json.request_file_list;
  if (!Array.isArray(file_list)) {
    item.json.request_error_message = 'request_file_list missing';
    continue;
  }

  // 1. 处理 feedme → invoices（每个 (merchant, 月份) 一张 invoice）
  //    支持同一 merchant 的多个月份；按 (merchant, yymm) 唯一去重
  const invoices = [];
  let step_error = '';
  for (const file of file_list) {
    if (file.id !== 'feedme_excels') continue;
    const res = processFeedmeFile(file);
    if (res.error) {
      step_error = res.error;
      break;
    }
    res.invoice.feedme_yymm = res.invoice.date_yymmdd.slice(0, 6); // 记录 feedme 月份
    if (
      invoices.some(
        (x) =>
          equalsIgnoreCase(x.bill_to, res.invoice.bill_to) &&
          x.feedme_yymm === res.invoice.feedme_yymm
      )
    ) {
      step_error =
        'duplicate feedme merchant+month: ' +
        res.invoice.bill_to +
        ' ' +
        res.invoice.feedme_yymm;
      break;
    }
    invoices.push(res.invoice);
  }
  if (isValidNotEmptyString(step_error)) {
    item.json.request_error_message = step_error;
    continue;
  }

  // 2. 处理 TNG → report_records  —— 暂不处理（保留以备后续启用）
  // const report_records = [];
  // for (const file of file_list) {
  //   if (file.id !== 'tng_merchant_report_excel') continue;
  //   const res = processTngFile(file);
  //   if (res.error) {
  //     step_error = res.error;
  //     break;
  //   }
  //   report_records.push(...res.records);
  // }
  // if (isValidNotEmptyString(step_error)) {
  //   item.json.request_error_message = step_error;
  //   continue;
  // }

  // 3. 汇总（TOUCH N GO 替换 / delivery fee 计算）—— 依赖 TNG 数据，暂不处理
  // aggregateInvoices(invoices, report_records);

  // 4. 处理 product_sales_report：按税率汇总，替换 Gross/Discount/SC
  //    顺便把对应 invoice 的 product_sales 月份记下来
  for (const file of file_list) {
    if (file.id !== 'product_sales_report_excels') continue;
    const res = processProductSalesFile(file);
    if (res.error) {
      step_error = res.error;
      break;
    }
    // 按 (merchant, yymm) 匹配对应的 feedme invoice
    const inv = invoices.find(
      (x) => equalsIgnoreCase(x.bill_to, res.merchant) && x.feedme_yymm === res.yymm
    );
    if (!inv) {
      step_error =
        'no matching feedme invoice for product_sales merchant+month: ' +
        res.merchant +
        ' ' +
        res.yymm;
      break;
    }
    // ps_yymm 已有值，说明之前已经有同一 (merchant, 月份) 的 product_sales 文件匹配过这张 invoice
    if (inv.ps_yymm) {
      step_error =
        'duplicate product_sales_report merchant+month: ' + res.merchant + ' ' + res.yymm;
      break;
    }
    inv.ps_yymm = res.yymm;
    applyProductSalesToInvoice(inv, res.summary_items);
  }
  if (isValidNotEmptyString(step_error)) {
    item.json.request_error_message = step_error;
    continue;
  }

  // 5. 校验：每个 (merchant, 月份) 必须同时有 feedme 和 product_sales
  //    （月份一致性由 step 4 的 (merchant, yymm) 匹配天然保证，无需再检查）
  for (const inv of invoices) {
    if (!inv.ps_yymm) {
      step_error =
        'merchant ' +
        inv.bill_to +
        ' month ' +
        inv.feedme_yymm +
        ' has feedme but missing product_sales_report';
      break;
    }
  }
  if (isValidNotEmptyString(step_error)) {
    item.json.request_error_message = step_error;
    continue;
  }

  // 6. 重新计算每张 invoice 的总计，并校验 grand_total + total_tax === total_payment
  finalizeInvoiceTotals(invoices);

  // 7. 为每张 invoice 渲染 HTML 模板，存到 invoice.html_template
  for (const inv of invoices) {
    inv.html_template = buildInvoiceHtml(inv);
  }

  item.json.invoices = invoices;
}

return $input.all();
