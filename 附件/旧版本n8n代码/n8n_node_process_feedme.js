function isNumber(str) {
  return !Number.isNaN(Number(str));
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

// formatDateDDMMYYY 将日期转换为 DD/MM/YYYY 这种格式的字符串
function formatDateDDMMYYY(date) {
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

// FindHeaderRow 找到 HeaderRow，返回 header row 的 index
function FindHeaderRow(start_index, rows) {
  if (!Array.isArray(rows)) return null;
  for (var i = 0; i < rows.length; i++) {
    if (i < start_index) continue;

    var row = rows[i];
    if (!Array.isArray(row)) continue;
    if (row.length == 0) continue;

    var col_value = row[0].trim();
    if (col_value == 'Time') return i;
  }

  return null;
}

// FindSummaryRow 找到 汇总行，返回该行的 index
function FindSummaryRow(start_index, rows) {
  if (!Array.isArray(rows)) return null;
  for (var i = 0; i < rows.length; i++) {
    if (i < start_index) continue;

    var row = rows[i];
    if (!Array.isArray(row)) continue;
    if (row.length == 0) continue;

    var col_value = row[0].trim();
    if (col_value == '') return i; // 首次出现第一列是空
  }

  return null;
}

// 主入口
for (const item of $input.all()) {
  item.json.invoices = [];
  for (const file of item.json.request_file_list) {
    if (file.id != 'feedme_excels') continue;
    if (
      !Array.isArray(file.data?.sheets) ||
      file.data.sheets.length == 0 ||
      !Array.isArray(file.data?.sheets[0]?.rows)
    ) {
      item.json.request_error_message = file.name + ', no data';
      break;
    }

    var invoice = {
      file_id: file.id,
      file_name: file.name
    };

    var rows = file.data.sheets[0].rows;

    // 从第二行，读取日期信息
    // 从 "Date: 01/07/2025 - 31/07/2025" 中获取 "31/07/2025"
    if (rows.length < 2) {
      item.json.request_error_message = file.name + " invalid, missing 'Date' row";
      break;
    }
    var secondRow = rows[1];
    if (secondRow.length < 1) {
      item.json.request_error_message =
        file.name + " invalid, missing 'Date' information at second row";
      break;
    }
    var invoice_date = parseInvoiceDate(secondRow[0]);
    if (!invoice_date) {
      item.json.request_error_message = file.name + " invalid 'Date' information at second row";
      break;
    }
    invoice['date'] = formatDateDDMMYYY(invoice_date); // DD/MM/YYYY 格式
    invoice['date_yymmdd'] = formatDateYYYYMMDD(invoice_date); // YYYYMMDD 格式

    // 从第四行，读取门店信息
    if (rows.length < 4) {
      item.json.request_error_message = file.name + " invalid, missing 'Merchant' row";
      break;
    }
    var fourthRow = rows[3];
    if (fourthRow.length < 1) {
      item.json.request_error_message =
        file.name + " invalid, missing 'Merchant' information at fourth row";
      break;
    }
    var raw_merchant = fourthRow[0].toLowerCase();
    if (raw_merchant.includes('austin')) {
      invoice['id'] = 'Austin_' + invoice['date_yymmdd'];
      invoice['bill_to'] = 'Austin';
    } else if (raw_merchant.includes('sutera')) {
      invoice['id'] = 'SUTERA_' + invoice['date_yymmdd'];
      invoice['bill_to'] = 'SUTERA';
    } else if (raw_merchant.includes('eco botanic') || raw_merchant.includes('ecobotanic')) {
      invoice['id'] = 'EcoBotanic_' + invoice['date_yymmdd'];
      invoice['bill_to'] = 'EcoBotanic';
    } else {
      item.json.request_error_message =
        file.name +
        " invalid, unknown 'Merchant' information at fourth row, expect: Austin or SUTERA or Eco Botanic";
      break;
    }

    // 找到 Header Row
    var header_index = FindHeaderRow(4, rows); // 从第5行(index=4)开始找 header row
    if (!header_index) {
      item.json.request_error_message =
        file.name + " invalid, cannot find header row (begin with column 'Time')";
      break;
    }
    var header_row = rows[header_index];

    // 找到汇总行（header row 往后，第一次出现 Time 列为空的行）
    var summary_index = FindSummaryRow(header_index, rows);
    if (!summary_index) {
      item.json.request_error_message =
        file.name + ' invalid, cannot find summary row (First row with empty Time)';
      break;
    }
    var summary_row = rows[summary_index];

    invoice.product_item_list = [];
    invoice.payment_list = [];
    var foundNett = false;
    // 处理行中的每列数据
    for (var col_index = 0; col_index < header_row.length; col_index++) {
      var col_value = header_row[col_index].trim();
      var ignore_col_values = ['', 'name', 'qty', 'pax']; // 忽略这些列
      if (ignore_col_values.includes(col_value.toLowerCase())) {
        continue;
      }

      if (col_value == 'Nett') {
        foundNett = true; // Nett 列之前的属于 products，之后的属于 payments
        continue; // Nett 列也需要忽略
      }

      if (col_index >= summary_row.length) continue; // 没有对应的summary 列，跳过
      var summary_col_value = summary_row[col_index].trim(); // summary 行对应的列的值
      if (summary_col_value == '' || !isNumber(summary_col_value)) {
        // 没有统计值，或者统计值不是数字，忽略
        continue;
      }

      if (!foundNett) {
        invoice.product_item_list.push({
          name: col_value,
          total: Number(summary_col_value) || 0,
          qty: 1,
          price: Number(summary_col_value) || 0,
          tax_rate_str: ''
        });
      } else {
        invoice.payment_list.push({
          pay_type: col_value,
          transactions: 1,
          total: Number(summary_col_value) || 0
        });
      }
    }

    item.json.invoices.push(invoice);
  }
}

return $input.all();
