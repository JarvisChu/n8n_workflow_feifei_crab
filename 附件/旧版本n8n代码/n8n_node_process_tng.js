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

// 找到 Header Row，并且返回行号以及每个必须列的列号
function FindHeaderRow(rows) {
  if (!Array.isArray(rows)) return null;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!Array.isArray(row)) continue;

    const idx = {
      row_index: i,
      no: row.indexOf('No'),
      transaction_date: row.indexOf('Transaction Datetime'),
      shop_name: row.indexOf('Shop/Outlet Name'),
      shop_location: row.indexOf('Shop/Outlet Location'),
      transaction_amount: row.indexOf('Transaction Amount (RM)'),
      settlement_amount: row.indexOf('Settlement Amount (RM)')
    };

    // 有任意列没找到 → 不是 header
    var isHeader = true;
    for (const k in idx) {
      if (idx[k] < 0) isHeader = false;
    }

    if (isHeader) return idx;
  }

  return null;
}

// ParseShopName 确定门店名称 Austin/Sutera/EcoBotanic
function ParseShopName(rawShopName, rawShopLocation) {
  rawShopName = (rawShopName ?? '').toLowerCase();
  rawShopLocation = (rawShopLocation ?? '').toLowerCase();

  if (rawShopLocation.includes('austin') || rawShopName.includes('austin')) {
    return 'Austin';
  } else if (rawShopLocation.includes('sutera') || rawShopName.includes('sutera')) {
    return 'Sutera';
  } else if (
    rawShopLocation.includes('eco botanic') ||
    rawShopName.includes('eco botanic') ||
    rawShopLocation.includes('ecobotanic') ||
    rawShopName.includes('ecobotanic')
  ) {
    return 'EcoBotanic';
  }

  return '';
}

// 主入口
for (const item of $input.all()) {
  item.json.report_records = [];
  for (const file of item.json.request_file_list) {
    if (file.id != 'tng_merchant_report_excel') continue;
    if (
      !Array.isArray(file.data?.sheets) ||
      file.data.sheets.length == 0 ||
      !Array.isArray(file.data?.sheets[0]?.rows)
    ) {
      item.json.request_error_message = file.name + ', no data';
      break;
    }

    var rows = file.data.sheets[0].rows;

    // 找到 Header Row
    var idx_info = FindHeaderRow(rows);
    if (!idx_info) {
      item.json.request_error_message = file.name + ' invalid, cannot find header row';
      break;
    }
    var header_index = idx_info.row_index;

    // 从 header row 开始，汇总数据
    for (var row_index = header_index + 1; row_index < rows.length; row_index++) {
      var row = rows[row_index];

      // 出现空行或者第一列为空的行，就认为遍历结束了
      if (!Array.isArray(row) || row.length == 0 || (row.length >= 1 && row[0] === '')) {
        break;
      }

      item.json.report_records.push({
        date: parseTransactionDate(row[idx_info.transaction_date]), // 多种原始日期格式统一转换为 YYYYMMDD 格式
        shop: ParseShopName(row[idx_info.shop_name], row[idx_info.shop_location]), // Austin, Sutera, EcoBotanic
        transaction_amount: Number(row[idx_info.transaction_amount]) || 0
      });
    }
  }
}

return $input.all();
